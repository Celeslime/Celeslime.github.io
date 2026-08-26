/**
 * alpha_recon app.js — UI 控制器
 * 依赖全局 ARCore（core.js）
 */

(() => {
  'use strict';

  // ---------- 状态 ----------
  const state = {
    imgData1: null,   // 原始 ImageData
    imgData2: null,
    // 统一后灰度
    gray1: null,
    gray2: null,
    w: 0, h: 0,
    x: 0, y: 0,
    dark: null,
    light: null,
    derived: null,    // {fg, ab, valid, ...}
    previewBg: 'checker', // 'checker' | 'black' | 'white'
    checkerPattern: null,
    previewCanvas: null,
    previewCtx: null,
    fgCanvas: null,
    fgCtx: null,
  };

  // ---------- DOM ----------
  const dropZones = {
    1: document.getElementById('drop1'),
    2: document.getElementById('drop2')
  };
  const fileInputs = {
    1: document.getElementById('file1'),
    2: document.getElementById('file2')
  };
  const previewCanvas = document.getElementById('preview-canvas');
  const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true });
  const bgBtns = document.querySelectorAll('.bg-btn');
  const dlBtn = document.getElementById('dl-btn');
  const swapBtn = document.getElementById('swap-btn');
  const dlHint = document.getElementById('dl-hint');
  const metaSize = document.getElementById('meta-size');
  const metaXY = document.getElementById('meta-xy');

  // 报告字段
  const rRaw = document.getElementById('r-raw');
  const rUnified = document.getElementById('r-unified');
  const rXY = document.getElementById('r-xy');
  const rSemi = document.getElementById('r-semi');
  const rInvalid = document.getElementById('r-invalid');
  const rErr = document.getElementById('r-err');

  // ---------- 工具 ----------
  function setDzLoaded(slot, imgData) {
    const dz = dropZones[slot];
    dz.classList.add('loaded');
    // 画缩略图：保持长宽比，限制在 160x120 内
    const preview = dz.querySelector('.dz-preview');
    const maxW = 160, maxH = 120;
    const scale = Math.min(maxW / imgData.width, maxH / imgData.height, 1);
    const pw = Math.round(imgData.width * scale);
    const ph = Math.round(imgData.height * scale);
    preview.width = pw; preview.height = ph;
    const pctx = preview.getContext('2d');
    const tmp = document.createElement('canvas');
    tmp.width = imgData.width; tmp.height = imgData.height;
    tmp.getContext('2d').putImageData(imgData, 0, 0);
    pctx.drawImage(tmp, 0, 0, pw, ph);
  }

  function setDzEmpty(slot) {
    const dz = dropZones[slot];
    dz.classList.remove('loaded');
    const preview = dz.querySelector('.dz-preview');
    preview.width = preview.height = 1;
    preview.getContext('2d').clearRect(0,0,1,1);
  }

  function readFileAsImageData(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('图片解码失败'));
      };
      img.src = url;
    });
  }

  function showError(msg) {
    alert(msg); // 简化：直接 alert，也可换成 toast
  }

  // 浏览器端：统一尺寸并转灰度（用 planUnify + Canvas 绘图 + toGray）
  function unifyAndGrayBrowser(imgData1, imgData2) {
    const w1 = imgData1.width, h1 = imgData1.height;
    const w2 = imgData2.width, h2 = imgData2.height;

    const plan = ARCore.planUnify(w1, h1, w2, h2);
    const { w, h, img1, img2 } = plan;

    // 离屏 canvas 画统一后的灰度图
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // 辅助：把一张 RGBA ImageData 按 plan 画到 canvas
    function drawImg(srcData, p) {
      const tmp = document.createElement('canvas');
      tmp.width = srcData.width; tmp.height = srcData.height;
      const tctx = tmp.getContext('2d');
      tctx.putImageData(srcData, 0, 0);
      ctx.drawImage(tmp, p.sx, p.sy, p.sw, p.sh, 0, 0, p.dw, p.dh);
    }

    // 画图1并取灰度
    ctx.clearRect(0, 0, w, h);
    drawImg(imgData1, img1);
    const gray1 = ARCore.toGray(ctx.getImageData(0, 0, w, h).data, w, h);

    // 画图2并取灰度
    ctx.clearRect(0, 0, w, h);
    drawImg(imgData2, img2);
    const gray2 = ARCore.toGray(ctx.getImageData(0, 0, w, h).data, w, h);

    return { gray1, gray2, w, h, plan };
  }

  // ---------- 核心流程 ----------
  async function processPipeline() {
    if (!state.imgData1 || !state.imgData2) return;

    try {
      // 1) 统一尺寸 + 灰度（浏览器端实现：planUnify + Canvas 绘图 + toGray）
      const unified = unifyAndGrayBrowser(state.imgData1, state.imgData2);
      state.gray1 = unified.gray1;
      state.gray2 = unified.gray2;
      state.w = unified.w;
      state.h = unified.h;

      // 2) auto_xy
      const [x, y] = ARCore.autoXY(state.gray1, state.gray2);
      state.x = x; state.y = y;

      // 3) 映射
      const { dark, light } = ARCore.applyMapping(state.gray1, state.gray2, x, y);
      state.dark = dark; state.light = light;

      // 4) 反推
      const derived = ARCore.derive(dark, light);
      state.derived = derived;

      // 5) 生成重构 RGBA（离屏 canvas 缓存，用于预览合成）
      const reconData = ARCore.makeReconstructedRGBA(derived.fg, derived.ab, state.w, state.h);
      if (!state.fgCanvas) {
        state.fgCanvas = document.createElement('canvas');
        state.fgCtx = state.fgCanvas.getContext('2d');
      }
      state.fgCanvas.width = state.w; state.fgCanvas.height = state.h;
      state.fgCtx.putImageData(reconData, 0, 0);

      // 6) 生成棋盘格 pattern
      if (!state.checkerPattern) {
        state.checkerPattern = ARCore.makeCheckerPattern(16, '#ffffff', '#cccccc');
      }

      // 7) 更新 UI
      updateMeta();
      updateReport();
      renderPreview();
      enableExport();
    } catch (e) {
      console.error(e);
      showError('处理失败：' + e.message);
    }
  }

  function updateMeta() {
    metaSize.textContent = `${state.w} × ${state.h}`;
    metaXY.textContent = `dark∈[0,${state.x}] / light∈[${state.y},255] (x+y=255)`;
  }

  function updateReport() {
    const d = state.derived;
    const raw1 = `${state.imgData1.width}×${state.imgData1.height}`;
    const raw2 = `${state.imgData2.width}×${state.imgData2.height}`;
    rRaw.textContent = `图1: ${raw1} / 图2: ${raw2}`;
    rUnified.textContent = `${state.w} × ${state.h}`;
    rXY.textContent = `x=${state.x}, y=${state.y} (x+y=${state.x+state.y})`;
    rSemi.textContent = `${d.semiPct.toFixed(1)}% (${Math.round(d.validCount * d.semiPct / 100)} / ${d.validCount})`;
    const invalid = d.total - d.validCount;
    rInvalid.textContent = `${invalid} (${d.total ? (invalid/d.total*100).toFixed(2) : 0}%)`;
    const { errB, errW } = ARCore.computeErrors(state.dark, state.light, d.fg, d.ab);
    rErr.textContent = `叠黑 ${errB} / 叠白 ${errW} 灰度级`;
  }

  function renderPreview() {
    const { w, h } = state;
    previewCanvas.width = w; previewCanvas.height = h;

    // 背景
    if (state.previewBg === 'checker') {
      const pattern = previewCtx.createPattern(state.checkerPattern, 'repeat');
      previewCtx.fillStyle = pattern;
      previewCtx.fillRect(0, 0, w, h);
    } else if (state.previewBg === 'black') {
      previewCtx.fillStyle = '#000';
      previewCtx.fillRect(0, 0, w, h);
    } else {
      previewCtx.fillStyle = '#fff';
      previewCtx.fillRect(0, 0, w, h);
    }

    // 叠加重构图（带透明）
    previewCtx.drawImage(state.fgCanvas, 0, 0);
  }

  function enableExport() {
    dlBtn.disabled = false;
    swapBtn.disabled = false;
    dlHint.style.display = 'block';
  }

  function downloadReconstructed() {
    if (!state.fgCanvas) return;
    state.fgCanvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reconstructed.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  function swapAndReprocess() {
    [state.imgData1, state.imgData2] = [state.imgData2, state.imgData1];
    // 交换预览图（canvas 内容互换）
    const tmp1 = dropZones[1].querySelector('.dz-preview');
    const tmp2 = dropZones[2].querySelector('.dz-preview');
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = tmp1.width; tmpCanvas.height = tmp1.height;
    tmpCanvas.getContext('2d').drawImage(tmp1, 0, 0);
    tmp1.getContext('2d').drawImage(tmp2, 0, 0);
    tmp2.getContext('2d').drawImage(tmpCanvas, 0, 0);
    // 重新跑流程
    processPipeline();
  }

  // ---------- 事件绑定 ----------
  function setupDropZone(slot) {
    const dz = dropZones[slot];
    const input = fileInputs[slot];

    ['dragenter', 'dragover'].forEach(evt => {
      dz.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dz.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove('drag-over');
      });
    });

    dz.addEventListener('drop', async e => {
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) { showError('请放入图片文件'); return; }
      try {
        const imgData = await readFileAsImageData(file);
        state['imgData' + slot] = imgData;
        setDzLoaded(slot, imgData);
        if (state.imgData1 && state.imgData2) processPipeline();
      } catch (err) { showError(err.message); }
    });

    dz.addEventListener('click', () => input.click());
    dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') input.click(); });

    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const imgData = await readFileAsImageData(file);
        state['imgData' + slot] = imgData;
        setDzLoaded(slot, imgData);
        if (state.imgData1 && state.imgData2) processPipeline();
      } catch (err) { showError(err.message); }
    });
  }

  function setupBgButtons() {
    bgBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const bg = btn.dataset.bg;
        state.previewBg = bg;
        bgBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.bg === bg));
        renderPreview();
      });
    });
  }

  // ---------- 初始化 ----------
  setupDropZone(1);
  setupDropZone(2);
  setupBgButtons();

  dlBtn.addEventListener('click', downloadReconstructed);
  swapBtn.addEventListener('click', swapAndReprocess);

  // theme toggle（复用主站逻辑，页面已内联）
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  });
})();