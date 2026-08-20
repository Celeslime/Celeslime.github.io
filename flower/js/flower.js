/* flower.js —— 把 py/ 下的极坐标花生成逻辑（svg.py / op-svg.py）移植为纯 JS。
 * 曲线：r = (2/π)·θ，θ∈[-π/2, π/2]，绕中心旋转 petals 次形成花瓣。
 * 提供参数化 SVG 生成 + SVG→PNG 导出，无任何依赖，可在 Node 中直接 require 测试。 */
(function (root, factory) {
	"use strict";
	if (typeof module === "object" && module.exports) {
		module.exports = factory();            /* Node 环境（本地测试） */
	} else {
		root.FlowerGen = factory();            /* 浏览器环境 */
	}
})(typeof self !== "undefined" ? self : this, function () {
	"use strict";

	var TWO_PI = Math.PI * 2;

	/* 默认参数（对齐主站配色 #4696d2 与 python 原版默认值） */
	var DEFAULTS = {
		size: 1680,        /* 画布边长（正方形） */
		petals: 7,         /* 花瓣数 */
		color: "#4696d2",  /* 主色 */
		fillOpacity: 0.25, /* 花瓣填充透明度 */
		strokeWidth: 0,    /* 0 = 自动取 size*0.003 */
		scale: 0.4,        /* 花占画布比例（半径归一化系数） */
		grid: true,        /* 是否绘制极坐标网格 */
		labels: true,      /* 网格射线末端的角度标尺编号（0、π/7…） */
		bg: "",            /* 背景色，"" 表示透明 */
		watermark: "",     /* 占位：generate 内部固定为「© 2026 鸿」，无需传入 */
		rotation: 0,       /* 整体旋转角度（度） */
		res: 360           /* 每条曲线的采样点数 */
	};

	/* 曲线上的原始点：r=(2/π)θ，θ∈[-π/2, π/2] */
	function originalPoint(theta) {
		var r = (2 / Math.PI) * theta;
		return [r * Math.cos(theta), r * Math.sin(theta)];
	}

	/* 绕原点旋转 */
	function rotatePoint(x, y, phi) {
		var c = Math.cos(phi), s = Math.sin(phi);
		return [x * c - y * s, x * s + y * c];
	}

	function fmt(n) {
		/* 保留 3 位小数，控制文件体积；视觉上与全精度无差 */
		return Math.round(n * 1000) / 1000;
	}

	/* ========== 共享核心：色相与昵称种子（生成器 / 留言板头像 / avatar.svg 接口共用） ========== */

	/* HSL → hex。固定 s/l 让整条色相带观感统一：h=206、s=0.608、l=0.55 恰为 #4696d2 */
	function hslToHex(h, s, l) {
		var c = (1 - Math.abs(2 * l - 1)) * s;
		var hp = h / 60;
		var x = c * (1 - Math.abs(hp % 2 - 1));
		var m = l - c / 2, r = 0, g = 0, b = 0;
		if (hp < 1) { r = c; g = x; }
		else if (hp < 2) { r = x; g = c; }
		else if (hp < 3) { g = c; b = x; }
		else if (hp < 4) { g = x; b = c; }
		else if (hp < 5) { r = x; b = c; }
		else { r = c; b = x; }
		var to2 = function (v) {
			return ("0" + Math.round((v + m) * 255).toString(16)).slice(-2);
		};
		return "#" + to2(r) + to2(g) + to2(b);
	}
	function hueToColor(hue) { return hslToHex(hue % 360, 0.608, 0.55); }

	/* 字符串 → 32 位种子（FNV-1a） */
	function hashString(str) {
		var h = 2166136261, i;
		for (i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return h >>> 0;
	}

	/* mulberry32 PRNG：种子决定，同一昵称永远得到同一朵花 */
	function mulberry32(seed) {
		var a = seed >>> 0;
		return function () {
			a |= 0; a = a + 0x6D2B79F5 | 0;
			var t = Math.imul(a ^ a >>> 15, 1 | a);
			t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		};
	}

	/* 由昵称确定的花参数（不含网格/尺寸，它们由调用方决定）：
	 * 昵称一律先转小写再参与生成，保证大小写不同的同一昵称得到同一朵花；
	 * "Cele"（不分大小写）固定为经典原图：7 瓣海盐蓝、填充 25%、不旋转。 */
	function seedParams(name) {
		var trimmed = (name || "").trim();
		var lower = trimmed.toLowerCase();
		if (lower === "cele") {
			return { petals: 7, hue: 206, fillOpacity: 0.25, rotation: 0 };
		}
		var rng = mulberry32(hashString(lower || "anonymous"));
		return {
			petals: 4 + Math.floor(rng() * 7),                                     /* 4~10 */
			hue: Math.floor(rng() * 360),
			fillOpacity: Math.round((0.08 + rng() * 0.27) * 100) / 100,            /* 0.08~0.35 */
			rotation: Math.floor(rng() * 360)
		};
	}

	/* 按昵称生成头像 SVG：默认无网格、透明背景、右下角固定水印"© 2026 鸿"。
	 * 例：generateAvatar("Cele", { size: 128 })；接口用 generateAvatar("Alice", { grid:1 }) 等。 */
	function generateAvatar(name, opts) {
		var o = opts || {};
		var p = seedParams(name);
		return generate({
			size: o.size || 128,
			res: o.res != null ? o.res : 360,
			strokeWidth: o.strokeWidth != null ? o.strokeWidth : (o.size || 128) * 0.003 * ((o.scale != null ? o.scale : 0.4) / 0.4),
			petals: o.petals != null ? o.petals : p.petals,
			color: o.color || hueToColor(o.hue != null ? o.hue : p.hue),
			fillOpacity: o.fillOpacity != null ? o.fillOpacity : p.fillOpacity,
			scale: o.scale != null ? o.scale : 0.4,
			grid: o.grid != null ? !!o.grid : false,
			labels: o.labels != null ? !!o.labels : false,
			bg: o.bg != null ? o.bg : "",
			rotation: o.rotation != null ? o.rotation : p.rotation
		});
	}

	/* 生成花瓣 path 的 d 字符串。
	 * size 为画布边长，c 为花瓣占画布比例（scale*size/2 半径逻辑与原版一致）。 */
	function petalPaths(opts) {
		var cx = opts.size / 2, cy = opts.size / 2;
		var radius = opts.scale * opts.size;
		var paths = [], k, i, theta;
		var thetaStep = Math.PI / opts.res;

		for (k = 0; k < opts.petals; k++) {
			var phi = TWO_PI * k / opts.petals;
			var parts = [];
			for (i = 0; i < opts.res; i++) {
				theta = -Math.PI / 2 + i * thetaStep;
				var p = originalPoint(theta);
				var r = rotatePoint(p[0], p[1], phi);
				var xs = cx + r[0] * radius;
				var ys = cy - r[1] * radius;   /* 翻转 y 轴，对齐屏幕坐标 */
				parts.push(fmt(xs) + "," + fmt(ys));
			}
			paths.push("M" + parts[0] + "L" + parts.slice(1).join("L") + "Z");
		}
		return paths;
	}

	/* 极坐标网格：同心圆 + 射线，透明度在 [1.0, 1.25] 归一化半径区间渐变淡出（对应 op-svg.py） */
	function gridElements(opts) {
		var cx = opts.size / 2, cy = opts.size / 2;
		var radius = opts.scale * opts.size;
		var fadeStart = 1.0, fadeEnd = 1.25, step = 1 / 12;
		var color = opts.color;
		var sw = fmt(opts.size * 0.0005);   /* 线宽随画布尺寸等比缩放，与花朵描边保持视觉比例 */
		var els = [];

		/* 同心圆 */
		var r = step;
		while (r < fadeEnd) {
			var op;
			if (r < fadeStart) {
				op = 0.5;
			} else {
				op = 0.5 * (1 - (r - fadeStart) / (fadeEnd - fadeStart));
			}
			if (op > 0.003) {
				els.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + fmt(r * radius) +
					'" fill="none" stroke="' + color + '" stroke-opacity="' + fmt(op) +
					'" stroke-width="' + sw + '"/>');
			}
			r += step;
		}

		/* 射线：固定段 + 渐变段 */
		var segs = 20, i, s;
		for (i = 0; i < opts.rays; i++) {
			var angle = TWO_PI * i / opts.rays;
			var dx = Math.cos(angle), dy = -Math.sin(angle); /* y 轴翻转 */

			els.push('<path d="M' + cx + ' ' + cy + 'L' + fmt(cx + fadeStart * radius * dx) + ' ' +
				fmt(cy + fadeStart * radius * dy) + '" stroke="' + color +
				'" stroke-opacity="0.5" stroke-width="' + sw + '" fill="none"/>');

			for (s = 0; s < segs; s++) {
				var rs = fadeStart + (fadeEnd - fadeStart) * s / segs;
				var re = fadeStart + (fadeEnd - fadeStart) * (s + 1) / segs;
				var rm = (rs + re) / 2;
				var op2 = 0.5 * (1 - (rm - fadeStart) / (fadeEnd - fadeStart));
				if (op2 <= 0.003) continue;
				els.push('<path d="M' + fmt(cx + rs * radius * dx) + ' ' + fmt(cy + rs * radius * dy) +
					'L' + fmt(cx + re * radius * dx) + ' ' + fmt(cy + re * radius * dy) +
					'" stroke="' + color + '" stroke-opacity="' + fmt(op2) +
					'" stroke-width="' + sw + '" fill="none"/>');
			}
		}
		return els;
	}

	/* 网格角度标尺：沿每条射线在归一化半径 7/6 处标注角度（0、π/7、2π/7…，对应 op-svg.py） */
	function labelElements(opts) {
		var cx = opts.size / 2, cy = opts.size / 2;
		var radius = opts.scale * opts.size;
		var color = opts.color;
		var labelRadius = 7 / 6;
		var fontSize = opts.size * 0.015;
		var den = Math.round(opts.rays / 2);
		var els = [], i;
		for (i = 0; i < opts.rays; i++) {
			var angle = TWO_PI * i / opts.rays;
			var x = cx + labelRadius * radius * Math.cos(angle);
			var y = cy - labelRadius * radius * Math.sin(angle);
			var label;
			if (i === 0) {
				label = "0";
			} else if (i === 1) {
				label = "π/" + den;
			} else if (i === opts.rays / 2) {
				label = "π";
			} else {
				label = i + "π/" + den;
			}
			els.push('<text x="' + fmt(x) + '" y="' + fmt(y) +
				'" font-family="Arial, sans-serif" font-size="' + fmt(fontSize) +
				'" fill="' + color + '" fill-opacity="0.5" text-anchor="middle" dominant-baseline="middle">' + label + '</text>');
		}
		return els;
	}

	/* 合并用户参数与默认值 */
	function resolve(opts) {
		var o = {};
		var key;
		for (key in DEFAULTS) if (DEFAULTS.hasOwnProperty(key)) o[key] = DEFAULTS[key];
		if (opts) for (key in opts) if (opts.hasOwnProperty(key) && opts[key] !== undefined && opts[key] !== null) o[key] = opts[key];
		o.size = Math.max(16, Math.round(o.size));
		o.petals = Math.max(2, Math.round(o.petals));
		o.res = Math.max(24, Math.round(o.res));
		return o;
	}

	/* 生成完整 SVG 字符串 */
	function generate(opts) {
		var o = resolve(opts);
		/* 射线数量固定为 2×花瓣数，不允许配置（含外链 avatar.svg） */
		o.rays = 2 * o.petals;
		var cx = o.size / 2, cy = o.size / 2;
		/* 花瓣描边随画布尺寸与花朵大小(scale)等比同步：scale 越大花越大，线也越粗。
		   保留小数（不 round），小尺寸时按比例变细而非强制保底 */
		var strokeWidth = o.strokeWidth > 0 ? o.strokeWidth : o.size * 0.003 * (o.scale / 0.4);
		var parts = [];

		parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + o.size + '" height="' + o.size +
			'" viewBox="0 0 ' + o.size + ' ' + o.size + '">');

		if (o.bg) {
			parts.push('<rect width="100%" height="100%" fill="' + o.bg + '"/>');
		}

		if (o.rotation) {
			parts.push('<g transform="rotate(' + fmt(o.rotation % 360) + ' ' + cx + ' ' + cy + ')">');
		}

		if (o.grid) {
			parts = parts.concat(gridElements(o));
			if (o.labels) {
				parts = parts.concat(labelElements(o));
			}
		}

		var petals = petalPaths(o);
		var i;
		for (i = 0; i < petals.length; i++) {
			parts.push('<path d="' + petals[i] + '" fill="' + o.color + '" fill-opacity="' + fmt(o.fillOpacity) +
				'" stroke="' + o.color + '" stroke-width="' + strokeWidth + '"/>');
		}

		if (o.rotation) {
			parts.push('</g>');
		}

		/* 水印固定为「© 2026 鸿」，放最外层、不随旋转，且不允许配置覆盖 */
		parts.push('<text x="' + fmt(o.size * 0.95) + '" y="' + fmt(o.size * 0.95) +
			'" font-family="Arial, sans-serif" font-size="' + fmt(o.size * 0.015) +
			'" fill="' + o.color + '" fill-opacity="0.5" text-anchor="end" dominant-baseline="auto">© 2026 鸿</text>');

		parts.push('<!-- 头像生成来源：https://celeslime.github.io/ --></svg>');
		return parts.join("");
	}

	/* SVG 字符串 → data: URL（供预览/导出用） */
	function svgToDataURL(svg) {
		return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
	}

	/* SVG → PNG dataURL。size 为目标边长（SVG 内本身带尺寸，绘制时按目标尺寸栅格化）。 */
	function svgToPng(svg, size) {
		return new Promise(function (resolvePromise, reject) {
			var img = new Image();
			var url = svgToDataURL(svg);
			img.onload = function () {
				var canvas = document.createElement("canvas");
				canvas.width = size;
				canvas.height = size;
				var ctx = canvas.getContext("2d");
				ctx.drawImage(img, 0, 0, size, size);
				/* 即使 SVG 无背景，也保留透明通道 */
				resolvePromise(canvas.toDataURL("image/png"));
			};
			img.onerror = function () {
				reject(new Error("SVG 渲染失败"));
			};
			img.src = url;
		});
	}

	return {
		DEFAULTS: DEFAULTS,
		generate: generate,
		generateAvatar: generateAvatar,
		seedParams: seedParams,
		hueToColor: hueToColor,
		hashString: hashString,
		mulberry32: mulberry32,
		svgToDataURL: svgToDataURL,
		svgToPng: svgToPng
	};
});
