/**
 * alpha_recon color — 色相/色彩空间转换（Node/浏览器通用）
 * 无任何 DOM/Canvas 依赖
 */

(function (global) {
  'use strict';

  // Python np.round: round half to even
  function roundHalfEven(x) {
    const f = Math.floor(x);
    const diff = x - f;
    if (diff > 0.5) return f + 1;
    if (diff < 0.5) return f;
    return (f & 1) === 0 ? f : f + 1;
  }

  // RGB (0-255) -> Hue [0, 360)
  function rgbToHue(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0) return 0;
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

  // 将灰度前景按色相着色
  function applyHueToGray(fg, ab, hue, saturation = 1.0) {
    const len = fg.length;
    const rgb = new Uint8ClampedArray(len * 3);
    for (let i = 0; i < len; i++) {
      const v = fg[i] / 255;
      const [r, g, b] = hsvToRgb(hue, saturation, v);
      rgb[i * 3] = r;
      rgb[i * 3 + 1] = g;
      rgb[i * 3 + 2] = b;
    }
    return rgb;
  }

  // 圆均值（加权）：两个色相取平均，返回 {h, r} 其中 r 是合成向量长度（0-2，越小越不稳定）
  function averageHue(h1, h2, w1 = 1, w2 = 1) {
    const rad1 = h1 * Math.PI / 180;
    const rad2 = h2 * Math.PI / 180;
    const x = w1 * Math.cos(rad1) + w2 * Math.cos(rad2);
    const y = w1 * Math.sin(rad1) + w2 * Math.sin(rad2);
    const r = Math.hypot(x, y); // 合成向量长度，0-2
    let h = Math.atan2(y, x) * 180 / Math.PI;
    if (h < 0) h += 360;
    return { h, r }; // r 接近 0 表示反向色，结果不可靠
  }

  // 平滑阶跃函数
  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  // 计算最短色相差（0-180）
  function hueDiff(h1, h2) {
    let d = Math.abs(h1 - h2) % 360;
    return d > 180 ? 360 - d : d;
  }

  // 自适应色相平均：根据色相差自动选择混合空间
  // h1, h2: 色相 [0,360)
  // s1, s2: 饱和度 [0,1] (用作权重)
  // 返回 {h, s} 最终色相和饱和度
  function adaptiveHueAverage(h1, h2, s1 = 1, s2 = 1) {
    const diff = hueDiff(h1, h2);
    
    // 简单加权圆均值（用于 diff < 90）
    const circ = averageHue(h1, h2, s1, s2);
    
    if (diff <= 90) {
      // 近似色相：直接用饱和度加权圆均值
      return { h: circ.h, s: (s1 + s2) / 2 };
    }
    
    if (diff >= 150) {
      // 反向色相：用 RGB 空间线性混合（避免绕色相圆）
      // 这里用 HSV 插值近似：取饱和度更高的色相，饱和度取平均
      const h = s1 >= s2 ? h1 : h2;
      return { h, s: (s1 + s2) / 2 };
    }
    
    // 过渡区 90~150：平滑混合 圆均值 和 取主导色相
    const t = smoothstep(90, 150, diff);
    const domH = s1 >= s2 ? h1 : h2; // 主导色相
    const h = circ.h * (1 - t) + domH * t;
    const s = (s1 + s2) / 2;
    return { h, s };
  }

  const ARColor = {
    roundHalfEven, rgbToHue, rgbToHsv, hsvToRgb, applyHueToGray, averageHue,
    smoothstep, hueDiff, adaptiveHueAverage
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ARColor;
  }
  global.ARColor = ARColor;
})(typeof self !== 'undefined' ? self : this);