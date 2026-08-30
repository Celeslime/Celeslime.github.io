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
  // tolerance: 允许违规的像素比例 (0~100)，默认 0
  // 返回 [x, y, violatingIndices]
  function autoXY(g1, g2, tolerance = 0) {
    const len = g1.length;

    // 快速路径：完全相同的图片直接返回最大映射
    let identical = true;
    for (let i = 0; i < len; i++) {
      if (g1[i] !== g2[i]) { identical = false; break; }
    }
    if (identical) return [255, 0, new Uint32Array(0)];

    // 关键推导：c1-c0 = (g1-g0)*(255-x)/255
    // 当 x<255 时，c1>=c0 的充分必要条件是 g1>=g0
    // 违规像素 = g1<g0 的像素，数量与 x 无关（x<255 时恒定）
    // x=255 时 c1=c0=0，无违规

    const diffs = new Int16Array(len);
    const violating = [];
    for (let i = 0; i < len; i++) {
      diffs[i] = g1[i] - g2[i];
      if (g1[i] < g2[i]) violating.push(i);
    }

    const maxViolations = Math.floor(len * tolerance / 100);

    if (violating.length <= maxViolations) {
      return [255, 0, new Uint32Array(violating)];
    }

    // 容差不足，用排序找最优 x
    // 排序所有像素的 (g1-g0) 值，按从小到大
    const sorted = Array.from(diffs);
    sorted.sort((a, b) => a - b);

    // 取第 maxViolations 个分位数作为阈值 threshold
    // 对于 x < 255，违规像素数 = diffs 中 < 0 的数量（恒定）
    // 但 x 影响 c0/c1 的计算精度（roundHalfEven），所以仍需二分
    const threshold = sorted[maxViolations] || -1;

    function countViolations(xVal) {
      const yVal = 255 - xVal;
      let count = 0;
      for (let i = 0; i < len; i++) {
        const c0 = roundHalfEven(g1[i] * xVal / 255);
        const c1 = roundHalfEven(yVal + g2[i] * (255 - yVal) / 255);
        if (c1 < c0) count++;
      }
      return count;
    }

    // 二分搜索最大 x，使违规数 <= maxViolations
    let lo = 0, hi = 255;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (countViolations(mid) <= maxViolations) lo = mid;
      else hi = mid - 1;
    }
    const x = lo;

    // 收集最终违规像素
    const finalViolating = [];
    const yVal = 255 - x;
    for (let i = 0; i < len; i++) {
      const c0 = roundHalfEven(g1[i] * x / 255);
      const c1 = roundHalfEven(yVal + g2[i] * (255 - yVal) / 255);
      if (c1 < c0) finalViolating.push(i);
    }

    return [x, 255 - x, new Uint32Array(finalViolating)];
  }

  // 映射：把 g1->[0,x], g2->[y,255]
  // violatingSet: 违规像素索引集合（用 (g0+g1)/2 代替）
  function applyMapping(g1, g2, x, y, violatingSet) {
    const len = g1.length;
    const dark = new Uint8Array(len);
    const light = new Uint8Array(len);
    const inv255 = 1 / 255;

    // 构建违规查找表
    const isViolating = violatingSet ? new Uint8Array(len) : null;
    if (violatingSet) {
      for (let k = 0; k < violatingSet.length; k++) {
        isViolating[violatingSet[k]] = 1;
      }
    }

    for (let i = 0; i < len; i++) {
      if (isViolating && isViolating[i]) {
        const avg = roundHalfEven((g1[i] + g2[i]) / 2);
        dark[i] = avg;
        light[i] = avg;
      } else {
        dark[i]  = roundHalfEven(g1[i] * x * inv255);
        light[i] = roundHalfEven(y + g2[i] * (255 - y) * inv255);
      }
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

      // 容差放宽：fg 略超 255（如 256）时 clamp 到 255，不判无效
      // 这是 auto_xy 容差让 x 增大后的正常边界效应
      if (isValid && fgFloat > 255.0 + 1e-9) {
        fgFloat = 255.0;
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