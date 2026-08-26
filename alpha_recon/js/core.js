/**
 * alpha_recon core — 统一入口，聚合 math/color/browser
 * 浏览器环境：依次加载 math.js -> color.js -> browser.js -> core.js
 * Node 环境：require('./math') 等自动加载
 */

(function (global) {
  'use strict';

  // 导出统一命名空间
  const ARCore = {
    // math
    roundHalfEven: global.ARMath?.roundHalfEven,
    toGray: global.ARMath?.toGray,
    planUnify: global.ARMath?.planUnify,
    autoXY: global.ARMath?.autoXY,
    applyMapping: global.ARMath?.applyMapping,
    derive: global.ARMath?.derive,
    simulate: global.ARMath?.simulate,
    composite: global.ARMath?.composite,
    computeErrors: global.ARMath?.computeErrors,
    // color
    rgbToHue: global.ARColor?.rgbToHue,
    rgbToHsv: global.ARColor?.rgbToHsv,
    hsvToRgb: global.ARColor?.hsvToRgb,
    applyHueToGray: global.ARColor?.applyHueToGray,
    averageHue: global.ARColor?.averageHue,
    // browser
    makeReconstructedRGBA: global.ARBrowser?.makeReconstructedRGBA,
    makeReconstructedRGBAWithHue: global.ARBrowser?.makeReconstructedRGBAWithHue,
    makeReconstructedRGBAWithHueFrom: global.ARBrowser?.makeReconstructedRGBAWithHueFrom,
    makeCheckerPattern: global.ARBrowser?.makeCheckerPattern,
  };

  // 兼容旧代码：直接挂载 ARCore.derive 等
  Object.assign(global, {
    ARMath: global.ARMath,
    ARColor: global.ARColor,
    ARBrowser: global.ARBrowser,
    ARCore: ARCore
  });

  if (typeof module !== 'undefined' && module.exports) {
    // Node: 直接引入三个子模块
    const ARMath = require('./math');
    const ARColor = require('./color');
    const ARBrowser = require('./browser');
    module.exports = {
      ...ARMath, ...ARColor, ...ARBrowser,
      ARMath, ARColor, ARBrowser, ARCore
    };
  }
})(typeof self !== 'undefined' ? self : this);