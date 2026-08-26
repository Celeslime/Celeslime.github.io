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

  // 圆均值：两个色相取平均（处理 0/360 边界）
  function averageHue(h1, h2) {
    const rad1 = h1 * Math.PI / 180;
    const rad2 = h2 * Math.PI / 180;
    const x = Math.cos(rad1) + Math.cos(rad2);
    const y = Math.sin(rad1) + Math.sin(rad2);
    let avg = Math.atan2(y, x) * 180 / Math.PI;
    if (avg < 0) avg += 360;
    return avg;
  }

  const ARColor = {
    roundHalfEven, rgbToHue, rgbToHsv, hsvToRgb, applyHueToGray, averageHue
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ARColor;
  }
  global.ARColor = ARColor;
})(typeof self !== 'undefined' ? self : this);