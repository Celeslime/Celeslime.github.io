/**
 * alpha_recon math — 纯数学函数（Node/浏览器通用）
 * 无任何 DOM/Canvas 依赖
 */

(function (global) {
  'use strict';

  // Python np.round: round half to even (banker's rounding)
  function roundHalfEven(x) {
    const f = Math.floor(x);
    const diff = x - f;
    if (diff > 0.5) return f + 1;
    if (diff < 0.5) return f;
    return (f & 1) === 0 ? f : f + 1;
  }

  // 灰度转换（对齐 PIL convert('L')）：L = (R*19595 + G*38470 + B*7471 + 32768) >> 16
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

  // 尺寸统一：计算统一后几何（不做实际像素操作）
  // 返回: { w, h, img1: {sx, sy, sw, sh, dw, dh}, img2: {...} }
  function planUnify(w1, h1, w2, h2) {
    const h = Math.min(h1, h2);

    function scaledW(origW, origH) {
      if (origH === h) return origW;
      const s = h / origH;
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
        sx: cropX / s, sy: 0, sw: w / s, sh: origH, dw: w, dh: h
      };
    }

    return {
      w, h,
      img1: params(w1, h1, vw1),
      img2: params(w2, h2, vw2)
    };
  }

  // auto_xy：自动计算映射区间边界 x,y（x+y=255，满足自洽的最大 x / 最小 y）
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

    let lo = x, hi = 255;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (check(mid)) lo = mid;
      else hi = mid - 1;
    }
    x = lo;

    return [x, 255 - x];
  }

  // 映射：把 g1->[0,x], g2->[y,255]
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

  // derive：反推前景灰度 + alpha
  function derive(dark, light) {
    const len = dark.length;
    const fg = new Uint8Array(len);
    const ab = new Uint8Array(len);
    const valid = new Uint8Array(len);
    let validCount = 0, semiCount = 0;

    for (let i = 0; i < len; i++) {
      const delta = light[i] - dark[i];
      let alphaByte = 255 - delta;

      let isValid = (alphaByte > 0) && (alphaByte <= 255);
      let aFloat = isValid ? alphaByte / 255 : 1.0;
      let fgFloat = isValid ? dark[i] / aFloat : 0.0;

      if (isValid && fgFloat > 255.0 + 1e-9) isValid = false;

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

  // simulate：用反推结果模拟叠黑/叠白
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

  // 合成到背景
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

  // 误差统计
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

  // 导出
  const ARMath = {
    roundHalfEven, toGray, planUnify, autoXY, applyMapping,
    derive, simulate, composite, computeErrors
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ARMath;
  }
  global.ARMath = ARMath;
})(typeof self !== 'undefined' ? self : this);