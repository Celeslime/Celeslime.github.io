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

    while (x > 0) {
      const y = 255 - x;
      let ok = true;
      for (let i = 0; i < len; i++) {
        const c0 = roundHalfEven(f1[i] * x / 255);
        const c1 = roundHalfEven(y + f2[i] * (255 - y) / 255);
        if (c1 < c0) { ok = false; break; }
      }
      if (ok) return [x, y];
      x--;
    }
    return [0, 255];
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