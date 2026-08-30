/**
 * alpha_recon browser — 浏览器专用（Canvas/ImageData）
 * 依赖 ARMath 和 ARColor
 */

(function (global) {
  'use strict';

  // 依赖检查
  const ARMath = global.ARMath;
  const ARColor = global.ARColor;
  if (!ARMath || !ARColor) {
    console.error('ARBrowser requires ARMath and ARColor to be loaded first');
    return;
  }

  const { roundHalfEven } = ARMath;
  const { rgbToHsv, hsvToRgb, averageHue } = ARColor;

  // 从单个源（img1 或 img2）提取 HSV 并应用到前景
  function reconstructWithHueFromSource(fg, ab, w, h, imgData1, imgData2, plan, source) {
    const len = fg.length;
    const data = new Uint8ClampedArray(len * 4);

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    const tmp = document.createElement('canvas');
    const srcImgData = source === 'img1' ? imgData1 : imgData2;
    const planSrc = source === 'img1' ? plan.img1 : plan.img2;

    console.log('[Hue Debug] reconstructWithHueFromSource:', { source, srcImgData: srcImgData.width+'x'+srcImgData.height, planSrc });

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

const hsv = ARColor.rgbToHsv(r, g, b);
      // 单源模式：根据背景类型调整策略
      // 黑底(img1)：观察色相=真实色相(仅变暗)，低饱和度也可信
      // 白底(img2)：观察色相受白底干扰，仅当 alpha 接近 1 时可信
      let useHue;
      if (source === 'img1') {
        useHue = hsv.s >= 0.08; // 黑底：低阈值即可
      } else {
        // 白底：与黑底同策略，低饱和度阈值即可，效果差用户不选
        useHue = hsv.s >= 0.08;
      }

      const v = fg[i] / 255;
      let fr, fg_c, fb;
      if (useHue) {
        const [rr, gg, bb] = ARColor.hsvToRgb(hsv.h, hsv.s, v);
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

  // 从两个源提取 HSV 并圆均值合成
  function reconstructWithHueAverage(fg, ab, w, h, imgData1, imgData2, plan) {
    const len = fg.length;
    const data = new Uint8ClampedArray(len * 4);

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

      const hsv1 = ARColor.rgbToHsv(r1, g1, b1);
      const hsv2 = ARColor.rgbToHsv(r2, g2, b2);

      const useHue1 = hsv1.s >= 0.08;
      // 白底观察：与黑底同策略，低饱和度阈值即可
      const useHue2 = hsv2.s >= 0.08;

      const v = fg[i] / 255;
      let fr, fg_c, fb;

      if (useHue1 && useHue2) {
        // 自适应色相平均：根据色相差自动选择混合空间
        const { h: finalH, s: finalS } = ARColor.adaptiveHueAverage(
          hsv1.h, hsv2.h, hsv1.s, hsv2.s
        );
        const [rr, gg, bb] = ARColor.hsvToRgb(finalH, finalS, v);
        fr = rr; fg_c = gg; fb = bb;
      } else if (useHue1) {
        const [rr, gg, bb] = ARColor.hsvToRgb(hsv1.h, hsv1.s, v);
        fr = rr; fg_c = gg; fb = bb;
      } else if (useHue2) {
        const [rr, gg, bb] = ARColor.hsvToRgb(hsv2.h, hsv2.s, v);
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

  // 生成重构 RGBA ImageData（前景灰度=RGB, A=alpha）
  function makeReconstructedRGBA(fg, ab, w, h) {
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
  }

  // 指定源生成带色相的重构 RGBA
  function makeReconstructedRGBAWithHueFrom(fg, ab, w, h, imgData1, imgData2, plan, source) {
    if (source === 'average') {
      return reconstructWithHueAverage(fg, ab, w, h, imgData1, imgData2, plan);
    }
    return reconstructWithHueFromSource(fg, ab, w, h, imgData1, imgData2, plan, source);
  }

  // 兼容旧 API：单源（默认 img1）
  function makeReconstructedRGBAWithHue(fg, ab, w, h, imgData1, plan) {
    return reconstructWithHueFromSource(fg, ab, w, h, imgData1, null, plan, 'img1');
  }

  // 棋盘格 pattern canvas
  function makeCheckerPattern(size = 16, c1 = '#ffffff', c2 = '#cccccc') {
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
  }

  const ARBrowser = {
    makeReconstructedRGBA,
    makeReconstructedRGBAWithHue,
    makeReconstructedRGBAWithHueFrom,
    makeCheckerPattern
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ARBrowser;
  }
  global.ARBrowser = ARBrowser;
})(typeof self !== 'undefined' ? self : this);