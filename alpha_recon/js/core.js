/**
 * alpha_recon core — 纯 JS 移植自 derive.py
 * 纯数学函数在 Node/浏览器均可运行；Canvas 相关函数仅在浏览器可用
 * 关键：对齐 Python np.round 的 banker's rounding (round half to even)
 */

(function (global) {
  'use strict';

  // ---------- 通用工具 ----------

  // Python np.round: round half to even (banker's rounding)
  // 输入为非负数时（本工具全是非负）的简化实现
  function roundHalfEven(x) {
    const f = Math.floor(x);
    const diff = x - f;
    if (diff > 0.5) return f + 1;
    if (diff < 0.5) return f;
    // diff === 0.5：取偶数
    return (f & 1) === 0 ? f : f + 1;
  }

  // ---------- 灰度转换（对齐 PIL convert('L')） ----------
  // PIL 使用: L = (R*19595 + G*38470 + B*7471 + 32768) >> 16 (四舍五入)
  function toGray(rgba, width, height) {
    const gray = new Uint8Array(width * height);
    let si = 0, di = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const r = rgba[si++];
        const g = rgba[si++];
        const b = rgba[si++];
        si++; // skip alpha
        gray[di++] = ((r * 19595 + g * 38470 + b * 7471 + 32768) >> 16);
      }
    }
    return gray;
  }

  // ---------- 尺寸统一：计算统一后几何（不做实际像素操作） ----------
  // 返回: { w, h, img1: {sx, sy, sw, sh, dw, dh}, img2: {...} }
  // 与 Python unify_size 逻辑等价：
  // 1) 高度大的等比缩放到较小高度（只缩小，不放大），宽度按 round(w * h_target / h) (banker's rounding)
  // 2) 两者高度一致后，取 min 宽度，对较宽者中心裁剪
  function planUnify(w1, h1, w2, h2) {
    const h = Math.min(h1, h2);

    function scaledW(origW, origH) {
      if (origH === h) return origW;
      const s = h / origH; // <= 1
      return roundHalfEven(origW * s);
    }

    const vw1 = scaledW(w1, h1);
    const vw2 = scaledW(w2, h2);

    const w = Math.min(vw1, vw2);

    function params(origW, origH, vw) {
      if (origH === h && origW === w) {
        return { sx: 0, sy: 0, sw: origW, sh: origH, dw: w, dh: h };
      }
      const s = (origH === h) ? 1 : h / origH;
      const cropX = Math.max(0, Math.floor((vw - w) / 2));
      return {
        sx: cropX / s,
        sy: 0,
        sw: w / s,
        sh: origH,
        dw: w,
        dh: h
      };
    }

    return {
      w, h,
      img1: params(w1, h1, vw1),
      img2: params(w2, h2, vw2)
    };
  }

  // ---------- auto_xy：自动计算映射区间 ----------
  // 返回 [x, y] 其中 x+y=255，满足自洽的最大 x
  function autoXY(g1, g2) {
    const len = g1.length;

    // 快速路径：完全相同的图片直接返回最大映射
    let identical = true;
    for (let i = 0; i < len; i++) {
      if (g1[i] !== g2[i]) { identical = false; break; }
    }
    if (identical) return [255, 0];

    const f1 = new Float64Array(len);
    const f2 = new Float64Array(len);
    let g1max = 0, g2min = 255;
    for (let i = 0; i < len; i++) {
      const v1 = g1[i], v2 = g2[i];
      f1[i] = v1; f2[i] = v2;
      if (v1 > g1max) g1max = v1;
      if (v2 < g2min) g2min = v2;
    }

    const denom = 255 - g2min + g1max;
    let x = (denom > 0) ? Math.min(255, Math.floor(65025 / denom)) : 255;

    // Phase 1: 递减直到找到可行解
    function check(xVal) {
      const yVal = 255 - xVal;
      for (let i = 0; i < len; i++) {
        const c0 = roundHalfEven(f1[i] * xVal / 255);
        const c1 = roundHalfEven(yVal + f2[i] * (255 - yVal) / 255);
        if (c1 < c0) return false;
      }
      return true;
    }

    while (x > 0 && !check(x)) x--;

    // Phase 2: 二分搜索 [x, 255] 寻找真正最大值
    let lo = x, hi = 255;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1; // 上中位
      if (check(mid)) lo = mid;
      else hi = mid - 1;
    }
    x = lo;

    return [x, 255 - x];
  }

  // ---------- 映射：把 g1->[0,x], g2->[y,255] ----------
  function applyMapping(g1, g2, x, y) {
    const len = g1.length;
    const dark = new Uint8Array(len);
    const light = new Uint8Array(len);
    const inv255 = 1 / 255;
    for (let i = 0; i < len; i++) {
      dark[i]  = roundHalfEven(g1[i] * x * inv255);
      light[i] = roundHalfEven(y + g2[i] * (255 - y) * inv255);
    }
    return { dark, light };
  }

  // ---------- derive：反推前景灰度 + alpha ----------
  // 返回 { fg:Uint8Array, ab:Uint8Array, valid:Uint8Array(0/1), validCount, semiPct }
  function derive(dark, light) {
    const len = dark.length;
    const fg = new Uint8Array(len);
    const ab = new Uint8Array(len);
    const valid = new Uint8Array(len);
    let validCount = 0;
    let semiCount = 0;

    for (let i = 0; i < len; i++) {
      const delta = light[i] - dark[i];
      let alphaByte = 255 - delta;

      let isValid = (alphaByte > 0) && (alphaByte <= 255);
      let aFloat = isValid ? alphaByte / 255 : 1.0;

      let fgFloat = isValid ? dark[i] / aFloat : 0.0;

      if (isValid && fgFloat > 255.0 + 1e-9) {
        isValid = false;
      }

      if (isValid) {
        validCount++;
        if (alphaByte < 255) semiCount++;
      }

      fg[i] = isValid ? roundHalfEven(Math.max(0, Math.min(255, fgFloat))) : 0;
      ab[i] = roundHalfEven(Math.max(0, Math.min(255, alphaByte)));
      valid[i] = isValid ? 1 : 0;
    }

    return {
      fg, ab, valid,
      validCount,
      semiPct: validCount ? (semiCount / validCount * 100) : 0,
      total: len
    };
  }

  // ---------- simulate：用反推结果模拟叠黑/叠白 ----------
  function simulate(fg, ab) {
    const len = fg.length;
    const black = new Uint8Array(len);
    const white = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const a = ab[i] / 255;
      const f = fg[i];
      black[i] = roundHalfEven(f * a);
      white[i] = roundHalfEven(f * a + 255 * (1 - a));
    }
    return { black, white };
  }

  // ---------- 合成到背景（用于误差统计/调试） ----------
  function composite(fg, ab, bg) {
    const len = fg.length;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const a = ab[i] / 255;
      const f = fg[i];
      out[i] = roundHalfEven(Math.max(0, Math.min(255, f * a + bg * (1 - a))));
    }
    return out;
  }

  // ---------- 色相相关 ----------
  // RGB (0-255) -> Hue [0, 360)
  function rgbToHue(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0) return 0; // 灰度无色相
    let h;
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = h * 60;
    if (h < 0) h += 360;
    return h;
  }

  // Hue [0, 360) + saturation + value -> RGB
  function hsvToRgb(h, s, v) {
    h = h / 60;
    const c = v * s;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = v - c;
    let r, g, b;
    if (h < 1) { r = c; g = x; b = 0; }
    else if (h < 2) { r = x; g = c; b = 0; }
    else if (h < 3) { r = 0; g = c; b = x; }
    else if (h < 4) { r = 0; g = x; b = c; }
    else if (h < 5) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return [
      roundHalfEven((r + m) * 255),
      roundHalfEven((g + m) * 255),
      roundHalfEven((b + m) * 255)
    ];
  }

  // 将灰度前景按色相着色（保留明度 fg/255，饱和度可配置）
  function applyHueToGray(fg, ab, hue, saturation = 1.0) {
    const len = fg.length;
    const rgb = new Uint8ClampedArray(len * 3);
    for (let i = 0; i < len; i++) {
      const v = fg[i] / 255; // 明度 = 前景灰度归一化
      const [r, g, b] = hsvToRgb(hue, saturation, v);
      rgb[i * 3] = r;
      rgb[i * 3 + 1] = g;
      rgb[i * 3 + 2] = b;
    }
    return rgb;
  }

  // ---------- 误差统计 ----------
  function computeErrors(dark, light, fg, ab) {
    const { black, white } = simulate(fg, ab);
    let errB = 0, errW = 0;
    for (let i = 0; i < dark.length; i++) {
      const eb = Math.abs(black[i] - dark[i]);
      const ew = Math.abs(white[i] - light[i]);
      if (eb > errB) errB = eb;
      if (ew > errW) errW = ew;
    }
    return { errB, errW };
  }

  // ---------- 导出：纯数学函数（Node/浏览器通用） ----------
  const ARCore = {
    roundHalfEven,
    toGray,
    planUnify,
    autoXY,
    applyMapping,
    derive,
    simulate,
    composite,
    computeErrors,
    // 色相相关（浏览器环境）
    rgbToHue,        // RGB -> hue [0, 360)
    hsvToRgb,        // HSV -> RGB
    applyHueToGray,  // 将灰度前景按色相着色
  };

  // ---------- 浏览器专用扩展（Canvas / ImageData） ----------
  if (typeof document !== 'undefined' && typeof ImageData !== 'undefined') {
    // 生成重构 RGBA ImageData（前景灰度=RGB, A=alpha）
    ARCore.makeReconstructedRGBA = function(fg, ab, w, h) {
      const len = fg.length;
      const data = new Uint8ClampedArray(len * 4);
      let di = 0;
      for (let i = 0; i < len; i++) {
        const v = fg[i];
        data[di++] = v;
        data[di++] = v;
        data[di++] = v;
        data[di++] = ab[i];
      }
      return new ImageData(data, w, h);
    };

    // 生成带色相的重构 RGBA：从 img1（叠黑观察）提取色相，应用到前景灰度上
    // imgData1: 原始叠黑观察的 ImageData（统一尺寸前）
    // plan: planUnify 返回的 img1 参数（含 sx, sy, sw, sh, dw, dh）
    // fg, ab: 反推得到的灰度前景和 alpha
    // saturation: 色相饱和度 0-1（默认 1.0，全饱和）
    ARCore.makeReconstructedRGBAWithHue = function(fg, ab, w, h, imgData1, plan, saturation = 1.0) {
      const len = fg.length;
      const data = new Uint8ClampedArray(len * 4);
      
      // 先把 imgData1 按 plan 画到统一尺寸
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      
      // 画 imgData1 到 canvas（与 unifyAndGrayBrowser 一致的逻辑）
      const tmp = document.createElement('canvas');
      tmp.width = imgData1.width; tmp.height = imgData1.height;
      const tctx = tmp.getContext('2d');
      tctx.putImageData(imgData1, 0, 0);
      ctx.drawImage(tmp, plan.img1.sx, plan.img1.sy, plan.img1.sw, plan.img1.sh, 0, 0, plan.img1.dw, plan.img1.dh);
      
      // 从 canvas 读取统一尺寸后的 RGB 像素
      const unifiedRgb = ctx.getImageData(0, 0, w, h).data; // RGBA
      
      // 对每个像素：从 RGB 提取色相，结合 fg(明度) 生成 RGB
      let di = 0;
      for (let i = 0; i < len; i++) {
        const r = unifiedRgb[di];
        const g = unifiedRgb[di + 1];
        const b = unifiedRgb[di + 2];
        di += 4;
        
        // 提取色相（灰度像素 hue=0）
        const hue = ARCore.rgbToHue(r, g, b);
        
        // 用 fg 作为明度，应用色相
        const v = fg[i] / 255;
        const [fr, fg_c, fb] = ARCore.hsvToRgb(hue, saturation, v);
        
        data[i * 4] = fr;
        data[i * 4 + 1] = fg_c;
        data[i * 4 + 2] = fb;
        data[i * 4 + 3] = ab[i];
      }
      return new ImageData(data, w, h);
    };

    // 棋盘格 pattern canvas
    ARCore.makeCheckerPattern = function(size = 16, c1 = '#ffffff', c2 = '#cccccc') {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const half = size / 2;
      ctx.fillStyle = c1;
      ctx.fillRect(0, 0, half, half);
      ctx.fillRect(half, half, half, half);
      ctx.fillStyle = c2;
      ctx.fillRect(half, 0, half, half);
      ctx.fillRect(0, half, half, half);
      return canvas;
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ARCore;
  }
  global.ARCore = ARCore;
})(typeof self !== 'undefined' ? self : this);