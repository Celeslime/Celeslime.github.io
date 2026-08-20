/* app.js —— 花生成器控制面板：实时预览、缓慢旋转动画、随机灵感、按昵称生成、导出 SVG/PNG */
(function () {
	"use strict";

	var FlowerGen = window.FlowerGen;
	var $ = function (id) { return document.getElementById(id); };

	/* 色相预设（快捷入口，主色改为 0-360 度色相滑块） */
	var PRESETS = [
		{ name: "海盐蓝", hue: 206 },   /* 主站默认 #4696d2 */
		{ name: "墨青",   hue: 172 },
		{ name: "樱花粉", hue: 339 },
		{ name: "暖橙",   hue: 29 },
		{ name: "紫藤",   hue: 261 },
		{ name: "薄荷",   hue: 130 },
		{ name: "石墨",   hue: 215 }
	];

	/* 色相与昵称种子逻辑统一复用 flower.js 的共享核心（FlowerGen.hueToColor / seedParams），
	   与留言板头像、avatar.svg 接口保持一致，避免多处重复实现 */

	var state = {
		size: 1680,
		petals: 7,
		hue: 206,
		fillOpacity: 0.25,
		scale: 0.4,
		grid: true,
		rays: 14,
		bg: "",
		watermark: "",
		rotation: 0,
		animate: false
	};

	var spinAngle = 0;        /* 动画当前角度 */
	var rafId = null;

	var previewSvg = $("preview-svg");
	var spinG = null;         /* 预览里负责旋转的 <g> */

	/* ---------- 渲染 ---------- */

	/* 生成"当前" SVG 字符串：动画开着取 spinAngle，否则取滑块 rotation */
	function currentOptions(withRotation) {
		return {
			size: state.size,
			petals: state.petals,
			color: FlowerGen.hueToColor(state.hue),
			fillOpacity: state.fillOpacity,
			scale: state.scale,
			grid: state.grid,
			rays: state.rays,
			bg: state.bg,
			watermark: state.watermark,
			rotation: withRotation ? (state.animate ? spinAngle : state.rotation) : 0
		};
	}

	/* 预览里单独拼背景与右下角水印（都放在旋转 <g> 之外，不随旋转） */
	function buildBgRect() {
		return state.bg ? '<rect width="100%" height="100%" fill="' + state.bg + '"/>' : "";
	}
	function buildWatermark() {
		if (!state.watermark) return "";
		var size = state.size;
		return '<text x="' + (size * 0.95).toFixed(1) + '" y="' + (size * 0.95).toFixed(1) +
			'" font-family="Arial, sans-serif" font-size="' + (size * 0.015).toFixed(1) +
			'" fill="' + FlowerGen.hueToColor(state.hue) + '" fill-opacity="0.5" text-anchor="end" dominant-baseline="auto">' +
			state.watermark + "</text>";
	}

	/* 生成静态内容（不带背景/水印，它们由上面单独拼），包进旋转 <g>，便于动画只改 transform 而不重建 DOM */
	function render() {
		var opts = currentOptions(false);
		opts.bg = "";
		opts.watermark = "";
		var svg = FlowerGen.generate(opts);
		var inner = svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));
		var cx = state.size / 2, cy = state.size / 2;
		previewSvg.setAttribute("viewBox", "0 0 " + state.size + " " + state.size);
		previewSvg.innerHTML = buildBgRect() +
			'<g id="spin" transform="rotate(' + state.rotation + " " + cx + " " + cy + ')">' + inner + "</g>" +
			buildWatermark();
		spinG = $("spin");
		$("meta-size").textContent = state.size;
		$("meta-petals").textContent = state.petals;
	}

	/* 动画：只更新 <g> 的 rotate。用固定步进而非时间差——行为可预测，任何刷新率都稳定 */
	function animateFrame() {
		if (!state.animate) return;
		spinAngle = (spinAngle + 0.15) % 360;   /* 每帧 0.15 度，60fps 约 9 度/秒 */
		if (spinG) {
			spinG.setAttribute("transform", "rotate(" + spinAngle + " " + state.size / 2 + " " + state.size / 2 + ")");
		}
		rafId = requestAnimationFrame(animateFrame);
	}

	function startAnim() {
		stopAnim();
		rafId = requestAnimationFrame(animateFrame);
	}
	function stopAnim() {
		if (rafId) cancelAnimationFrame(rafId);
		rafId = null;
	}

	/* ---------- 控件绑定 ---------- */

	function bindRange(id, key, fmtVal) {
		var el = $(id), out = $(id + "-val");
		el.addEventListener("input", function () {
			state[key] = parseFloat(el.value);
			if (fmtVal && out) out.textContent = fmtVal(state[key]);
			syncDisabled();
			render();
		});
	}

	function readState() {
		state.size = parseInt($("size-select").value, 10);
		state.petals = parseInt($("petals").value, 10);
		state.hue = parseFloat($("hue").value);
		state.fillOpacity = parseFloat($("fillopacity").value);
		state.scale = parseFloat($("scale").value);
		state.grid = $("grid").checked;
		state.rays = parseInt($("rays").value, 10);
		state.rotation = parseFloat($("rotation").value);
		state.animate = $("animate").checked;
		state.watermark = $("watermark").value;

		var bg = $("bg").value;
		state.bg = bg === "transparent" ? "" : bg;

		if (state.animate) {
			spinAngle = state.rotation;
			startAnim();
		} else {
			stopAnim();
			spinAngle = state.rotation;
		}
		updateHueUI();
		render();
	}

	function syncDisabled() {
		$("rays").disabled = !state.grid;
		$("rotation").disabled = state.animate;
		$("rotation-val").classList.toggle("dim", state.animate);
		$("animate").checked = state.animate;
	}

	/* 色相：更新滑块/hex/色板高亮 */
	function setHue(hue) {
		state.hue = ((hue % 360) + 360) % 360;
		$("hue").value = state.hue;
		updateHueUI();
		render();
	}

	function updateHueUI() {
		$("hue-val").textContent = Math.round(state.hue) + "°";
		$("color-hex").textContent = FlowerGen.hueToColor(state.hue);
		var wrap = $("swatches");
		Array.prototype.forEach.call(wrap.children, function (c) {
			var h = parseInt(c.getAttribute("data-hue"), 10);
			c.classList.toggle("active", Math.abs(h - state.hue) < 2);
		});
	}

	function buildSwatches() {
		var wrap = $("swatches");
		PRESETS.forEach(function (p) {
			var b = document.createElement("button");
			b.type = "button";
			b.className = "swatch";
			b.setAttribute("data-hue", p.hue);
			b.style.background = FlowerGen.hueToColor(p.hue);
			b.title = p.name + " " + p.hue + "°";
			b.setAttribute("aria-label", p.name);
			b.addEventListener("click", function () { setHue(p.hue); });
			wrap.appendChild(b);
		});
	}


	/* 随机灵感：只随机花瓣/色相/填充/旋转，保持用户设定的大小与网格 */
	function randomize() {
		state.petals = 4 + Math.floor(Math.random() * 7);          /* 4~10 */
		state.hue = Math.floor(Math.random() * 360);
		state.fillOpacity = Math.round((0.08 + Math.random() * 0.27) * 100) / 100;   /* 0.08~0.35 */
		state.rotation = Math.floor(Math.random() * 360);
		state.animate = false;

		/* 随机灵感是脱离昵称的：清空昵称输入，让站外链接回落到当前参数并与预览一致 */
		if ($("seed-input").value) $("seed-input").value = "";

		$("petals").value = state.petals;
		$("petals-val").textContent = state.petals;
		$("fillopacity").value = state.fillOpacity;
		$("fillopacity-val").textContent = Math.round(state.fillOpacity * 100) + "%";
		$("rotation").value = state.rotation;
		$("rotation-val").textContent = Math.round(state.rotation) + "°";
		$("animate").checked = false;
		stopAnim();
		spinAngle = state.rotation;
		setHue(state.hue);
		syncDisabled();
		render();
		updateAvatarUrlDisplay();
	}

	/* 按昵称生成：同一昵称永远同一朵花；"Cele"（不分大小写）固定为经典原图 */
	function applySeed(name) {
		var trimmed = (name || "").trim();
		/* 昵称 → 花参数统一走 flower.js 的 seedParams（Cele 不分大小写固定经典原图） */
		var p = FlowerGen.seedParams(name);

		state.petals = p.petals;
		state.hue = p.hue;
		state.fillOpacity = p.fillOpacity;
		state.rotation = p.rotation;
		state.animate = false;

		if (trimmed.toLowerCase() === "cele") {
			/* 恢复经典原图：7 瓣海盐蓝、经典网格、无旋转 */
			state.scale = 0.4;
			state.grid = true;
			state.rays = 14;
		}
		/* 非 Cele：大小与网格保持用户当前设置，不随机 */

		$("petals").value = state.petals;
		$("petals-val").textContent = state.petals;
		$("fillopacity").value = state.fillOpacity;
		$("fillopacity-val").textContent = Math.round(state.fillOpacity * 100) + "%";
		$("scale").value = state.scale;
		$("scale-val").textContent = state.scale;
		$("grid").checked = state.grid;
		$("rays").value = state.rays;
		$("rays-val").textContent = state.rays;
		$("rotation").value = state.rotation;
		$("rotation-val").textContent = Math.round(state.rotation) + "°";
		$("animate").checked = false;
		stopAnim();
		spinAngle = state.rotation;
		setHue(state.hue);
		syncDisabled();
		render();
		updateAvatarUrlDisplay();
	}

	/* ---------- 导出 ---------- */

	function download(filename, dataUrl) {
		var a = document.createElement("a");
		a.href = dataUrl;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function exportSvg() {
		var svg = FlowerGen.generate(currentOptions(true));
		download("flower-" + Date.now() + ".svg", FlowerGen.svgToDataURL(svg));
	}

	function exportPng() {
		var size = parseInt($("export-size").value, 10);
		var btn = $("png-btn");
		btn.disabled = true;
		btn.textContent = "生成中…";
		FlowerGen.svgToPng(FlowerGen.generate(currentOptions(true)), size).then(function (url) {
			download("flower-" + Date.now() + ".png", url);
			btn.disabled = false;
			btn.textContent = "下载 PNG";
		}).catch(function () {
			btn.disabled = false;
			btn.textContent = "下载 PNG";
			alert("PNG 生成失败：浏览器不支持此 SVG 特性。");
		});
	}

	/* 站外头像链接：有昵称 → avatar.svg?name=昵称；无昵称 → 用当前参数编码，保证与预览一致 */
	function avatarUrl() {
		var base = new URL("avatar.svg", location.href).href;
		var name = ($("seed-input").value || "").trim();
		var q = [];
		if (name) {
			q.push("name=" + encodeURIComponent(name));
		} else {
			q.push("color=" + encodeURIComponent(FlowerGen.hueToColor(state.hue)));
			q.push("petals=" + state.petals);
			q.push("fillopacity=" + state.fillOpacity);
			q.push("rotation=" + Math.round(state.rotation));
			if (state.grid) q.push("grid=1");
			if (state.bg) q.push("bg=" + encodeURIComponent(state.bg));
		}
		q.push("size=128");
		return base + "?" + q.join("&");
	}

	/* 把当前站外链接写入输入框（生成头像后直接更新显示） */
	function updateAvatarUrlDisplay() {
		var input = $("avatar-url");
		if (input) input.value = avatarUrl();
	}

	function copyAvatarUrl(e) {
		var url = avatarUrl();
		updateAvatarUrlDisplay();
		copyText(url, e.target);
	}

	function copyText(text, btn) {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(function () { flash(btn, "已复制"); });
		} else {
			var ta = document.createElement("textarea");
			ta.value = text;
			document.body.appendChild(ta);
			ta.select();
			try { document.execCommand("copy"); flash(btn, "已复制"); } catch (e) {}
			document.body.removeChild(ta);
		}
	}

	function flash(btn, msg) {
		var old = btn.textContent;
		btn.textContent = msg;
		setTimeout(function () { btn.textContent = old; }, 1200);
	}

	/* ---------- 主题 ---------- */

	function applyTheme() {
		var dark = false;
		try {
			dark = localStorage.getItem("theme") === "dark" ||
				(!localStorage.getItem("theme") && matchMedia("(prefers-color-scheme: dark)").matches);
		} catch (e) {}
		document.documentElement.classList.toggle("dark", dark);
		$("theme-toggle").setAttribute("aria-pressed", dark ? "true" : "false");
	}

	function bindTheme() {
		var btn = $("theme-toggle");
		btn.addEventListener("click", function () {
			var dark = document.documentElement.classList.toggle("dark");
			try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (e) {}
			btn.setAttribute("aria-pressed", dark ? "true" : "false");
		});
	}

	/* ---------- 初始化 ---------- */

	function init() {
		buildSwatches();
		bindTheme();
		applyTheme();

		bindRange("petals", "petals", function (v) { return v; });
		bindRange("fillopacity", "fillOpacity", function (v) { return Math.round(v * 100) + "%"; });
		bindRange("scale", "scale", function (v) { return v; });
		bindRange("rays", "rays", function (v) { return v; });
		bindRange("rotation", "rotation", function (v) { return Math.round(v) + "°"; });

		/* 色相滑块独立处理：更新 hex 与色板高亮 */
		var hueEl = $("hue");
		hueEl.addEventListener("input", function () {
			state.hue = parseFloat(hueEl.value);
			updateHueUI();
			render();
		});

		$("grid").addEventListener("change", readState);
		$("animate").addEventListener("change", readState);
		$("bg").addEventListener("change", readState);
		$("size-select").addEventListener("change", readState);
		$("watermark").addEventListener("input", readState);

		$("random-btn").addEventListener("click", randomize);
		$("seed-btn").addEventListener("click", function () { applySeed($("seed-input").value); });
		$("seed-input").addEventListener("keydown", function (e) {
			if (e.key === "Enter") applySeed($("seed-input").value);
		});
		/* 昵称自动转小写（avatar 接口按小写种子统一，大小写不同也能得到同一朵花），并实时刷新站外链接 */
		$("seed-input").addEventListener("input", function () {
			var el = $("seed-input");
			if (el.value !== el.value.toLowerCase()) el.value = el.value.toLowerCase();
			updateAvatarUrlDisplay();
		});

		$("svg-btn").addEventListener("click", exportSvg);
		$("png-btn").addEventListener("click", exportPng);
		$("copy-svg-btn").addEventListener("click", function (e) {
			copyText(FlowerGen.generate(currentOptions(true)), e.target);
		});
		$("copy-png-btn").addEventListener("click", function (e) {
			var btn = e.target;
			btn.disabled = true;
			FlowerGen.svgToPng(FlowerGen.generate(currentOptions(true)), state.size).then(function (url) {
				copyText(url, btn);
				btn.disabled = false;
			}).catch(function () { btn.disabled = false; });
		});
		$("avatar-url-btn").addEventListener("click", copyAvatarUrl);

		readState();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
