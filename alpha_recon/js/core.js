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

  // RGB (0-255) -> HSV {h:0-360, s:0-1, v:0-1}
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h = h * 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : delta / max;
    const v = max;
    return { h, s, v };
  }

  // HSV -> RGB (0-255)
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
    rgbToHsv,        // RGB -> HSV
    hsvToRgb,        // HSV -> RGB
    applyHueToGray,  // 将灰度前景按色相着色
    // 浏览器专用扩展也在这里导出（Node 下为 undefined）
    makeReconstructedRGBA: null,
    makeReconstructedRGBAWithHue: null,
    makeReconstructedRGBAWithHueFrom: null,
    makeCheckerPattern: null,
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

    // ---------- 通用：从观察图提取 HSV 并应用到前景 ----------
    // source: 'img1' (黑底) 或 'img2' (白底)
    function reconstructWithHueFromSource(fg, ab, w, h, imgData1, imgData2, plan, source) {
      const len = fg.length;
      const data = new Uint8ClampedArray(len * 4);
      
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      
      const tmp = document.createElement('canvas');
      const srcImgData = source === 'img1' ? imgData1 : imgData2;
      const planSrc = source === 'img1' ? plan.img1 : plan.img2;
      
      tmp.width = srcImgData.width; tmp.height = srcImgData.height;
      const tctx = tmp.getContext('2d');
      tctx.putImageData(srcImgData, 0, 0);
      ctx.drawImage(tmp, planSrc.sx, planSrc.sy, planSrc.sw, planSrc.sh, 0, 0, planSrc.dw, planSrc.dh);
      
      const unifiedRgb = ctx.getImageData(0, 0, w, h).data;
      
      let di = 0;
      for (let i = 0; i < len; i++) {
        const r = unifiedRgb[di];
        const g = unifiedRgb[di + 1];
        const b = unifiedRgb[di + 2];
        di += 4;
        
        const hsv = ARCore.rgbToHsv(r, g, b);
        const useHue = hsv.s >= 0.05;
        
        const v = fg[i] / 255;
        let fr, fg_c, fb;
        if (useHue) {
          const [rr, gg, bb] = ARCore.hsvToRgb(hsv.h, hsv.s, v);
          fr = rr; fg_c = gg; fb = bb;
        } else {
          const gv = roundHalfEven(v * 255);
          fr = fg_c = fb = gv;
        }
        
        data[i * 4] = fr;
        data[i * 4 + 1] = fg_c;
        data[i * 4 + 2] = fb;
        data[i * 4 + 3] = ab[i];
      }
      return new ImageData(data, w, h);
    }

    // 圆均值：两个色相取平均（处理 0/360 边界）
    function averageHue(h1, h2) {
      // 转为单位向量求和
      const rad1 = h1 * Math.PI / 180;
      const rad2 = h2 * Math.PI / 180;
      const x = Math.cos(rad1) + Math.cos(rad2);
      const y = Math.sin(rad1) + Math.sin(rad2);
      let avg = Math.atan2(y, x) * 180 / Math.PI;
      if (avg < 0) avg += 360;
      return avg;
    }

    // 从两个源提取 HSV 并圆均值合成
    function reconstructWithHueAverage(fg, ab, w, h, imgData1, imgData2, plan) {
      const len = fg.length;
      const data = new Uint8ClampedArray(len * 4);
      
      // 先把两个观察图都画到统一尺寸
      const canvases = [];
      for (const srcName of ['img1', 'img2']) {
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        const srcImgData = srcName === 'img1' ? imgData1 : imgData2;
        const planSrc = srcName === 'img1' ? plan.img1 : plan.img2;
        
        const tmp = document.createElement('canvas');
        tmp.width = srcImgData.width; tmp.height = srcImgData.height;
        const tctx = tmp.getContext('2d');
        tctx.putImageData(srcImgData, 0, 0);
        ctx.drawImage(tmp, planSrc.sx, planSrc.sy, planSrc.sw, planSrc.sh, 0, 0, planSrc.dw, planSrc.dh);
        
        canvases.push(ctx.getImageData(0, 0, w, h).data);
      }
      
      const rgb1 = canvases[0];
      const rgb2 = canvases[1];
      
      let d1 = 0, d2 = 0;
      for (let i = 0; i < len; i++) {
        const r1 = rgb1[d1], g1 = rgb1[d1 + 1], b1 = rgb1[d1 + 2]; d1 += 4;
        const r2 = rgb2[d2], g2 = rgb2[d2 + 1], b2 = rgb2[d2 + 2]; d2 += 4;
        
        const hsv1 = ARCore.rgbToHsv(r1, g1, b1);
        const hsv2 = ARCore.rgbToHsv(r2, g2, b2);
        
        const useHue1 = hsv1.s >= 0.05;
        const useHue2 = hsv2.s >= 0.05;
        
        const v = fg[i] / 255;
        let fr, fg_c, fb;
        
        if (useHue1 && useHue2) {
          // 两者都有色相 -> 圆均值
          const avgH = averageHue(hsv1.h, hsv2.h);
          // 饱和度取平均
          const avgS = (hsv1.s + hsv2.s) / 2;
          const [rr, gg, bb] = ARCore.hsvToRgb(avgH, avgS, v);
          fr = rr; fg_c = gg; fb = bb;
        } else if (useHue1) {
          const [rr, gg, bb] = ARCore.hsvToRgb(hsv1.h, hsv1.s, v);
          fr = rr; fg_c = gg; fb = bb;
        } else if (useHue2) {
          const [rr, gg, bb] = ARCore.hsvToRgb(hsv2.h, hsv2.s, v);
          fr = rr; fg_c = gg; fb = bb;
        } else {
          const gv = roundHalfEven(v * 255);
          fr = fg_c = fb = gv;
        }
        
        data[i * 4] = fr;
        data[i * 4 + 1] = fg_c;
        data[i * 4 + 2] = fb;
        data[i * 4 + 3] = ab[i];
      }
      return new ImageData(data, w, h);
    }

    // 兼容旧 API：单源（默认 img1）
    ARCore.makeReconstructedRGBAWithHue = function(fg, ab, w, h, imgData1, plan) {
      return reconstructWithHueFromSource(fg, ab, w, h, imgData1, null, plan, 'img1');
    };

    // 新 API：指定源
    ARCore.makeReconstructedRGBAWithHueFrom = function(fg, ab, w, h, imgData1, imgData2, plan, source) {
      if (source === 'average') {
        return reconstructWithHueAverage(fg, ab, w, h, imgData1, imgData2, plan);
      }
      return reconstructWithHueFromSource(fg, ab, w, h, imgData1, imgData2, plan, source);
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