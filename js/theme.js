/* ============================================================
 * 主题状态：模式（浅色 / 深色 / 跟随系统）+ 配色（海盐蓝 / 青提绿 / 玫瑰粉 / 曜石黑）
 *
 * 在 <head> 里同步引入：脚本先于 <body> 绘制执行，刷新时不会先闪一下浅色。
 * 这里只负责"读取 / 保存 / 套用到 <html>"，菜单 UI 在 js/main.js 订阅 CeleTheme.onChange。
 *
 *   CeleTheme.mode            "light" | "dark" | "system"
 *   CeleTheme.color           "blue" | "green" | "pink" | "black"
 *   CeleTheme.isDark()        当前实际渲染是不是深色（system 时看系统偏好）
 *   CeleTheme.setMode(mode)   切换模式并持久化
 *   CeleTheme.setColor(color) 切换配色并持久化
 *   CeleTheme.onChange(fn)    订阅变化，返回取消订阅的函数
 * ============================================================ */
(function (global) {
	"use strict";

	var MODES = ["light", "dark", "system"];
	var COLORS = ["blue", "green", "pink", "black"];
	var KEY_MODE = "theme";
	var KEY_COLOR = "theme-color";

	/* 与 css/base.css 的 --bg 对应，用来同步移动端浏览器地址栏颜色 */
	var THEME_COLOR = {
		blue: { light: "#f7fafc", dark: "#0d151d" },
		green: { light: "#f7fdfa", dark: "#06120e" },
		pink: { light: "#fdf7f9", dark: "#150a0f" },
		black: { light: "#f3f3f4", dark: "#070708" }
	};

	/* 主页背景的大花：不再单独存图，直接用 flower/js/flower.js（留言板头像
	 * 用的同一个生成器）在运行时按当前 accent 画出来。主站本来就加载了那个文件。 */
	var FLOWER_SIZE = 2048;
	/* 黑配色按深浅各给一个值：浅色下是墨线，深色下翻成白线稿。
	 * 其它三色只有一个值，深浅共用。 */
	var FLOWER_ACCENT = {
		blue: "#4696d2",
		green: "#0ea472",
		pink: "#d24673",
		black: { light: "#17181c", dark: "#f5f6f7" }
	};
	/* 背景花下面再压一份同样的轮廓、整体高斯模糊，做出类似阴影的层次。
	 * 投影只留线、不填充：带填充的重影会从半透明的花瓣里透上来，把原来的
	 * 淡蓝压成灰；只留描边，才只是给花补一圈柔和的暗部。
	 * BLUR 按 CSS 像素写（对应 css/page.css 里桌面端的 --flower-size），
	 * 生成时换算成 2048 画布内的 SVG 单位：CSS 没法只模糊背景的某一层，
	 * 烘焙进 SVG 才能让两份图共用同一套定位 / 尺寸 / 遮罩。
	 * 尺寸变化（移动端 700px）时模糊半径随图一起缩放，观感比例不变。
	 * 想让它更像真投影，可以调 css/page.css 里的 --flower-shadow-dx / dy 挪一点。 */
	var FLOWER_CSS_SIZE = 1680;
	var FLOWER_BLUR = 8;
	/* 投影颜色跟花同色（#rrggbbaa），所有配色统一 70%：
	 * 浅色黑花配黑线影，深色白花配白线影。 */
	var SHADOW_ALPHA = "B2";
	/* 黑配色花瓣填充减淡，让它读成线稿而不是一块灰面 */
	var FLOWER_FILL = { black: { light: 0.18, dark: 0.12 } };
	var flowerUrls = Object.create(null);
	var flowerShadowUrls = Object.create(null);

	function flowerAccent(color) {
		var accent = FLOWER_ACCENT[color];
		return accent && typeof accent === "object" ? accent[api.isDark() ? "dark" : "light"] : accent;
	}

	function flowerShadowColor(color) {
		return flowerAccent(color) + SHADOW_ALPHA;
	}

	function flowerFill(color) {
		var fill = FLOWER_FILL[color];
		if (!fill) return 0.25;
		return typeof fill === "object" ? fill[api.isDark() ? "dark" : "light"] : fill;
	}

	/* 黑配色深浅两版要分开缓存，否则切深浅后还挂着上一版的花 */
	function flowerKey(color) {
		if (!FLOWER_ACCENT[color] || typeof FLOWER_ACCENT[color] !== "object") return color;
		return color + "-" + (api.isDark() ? "dark" : "light");
	}

	var root = document.documentElement;
	var media = global.matchMedia ? global.matchMedia("(prefers-color-scheme: dark)") : null;
	var listeners = [];

	/* localStorage 在隐私模式 / 被禁用时会抛错，统一兜住，失败就当没存过 */
	function read(key, allowed, fallback) {
		try {
			var value = global.localStorage.getItem(key);
			if (allowed.indexOf(value) !== -1) return value;
		} catch (e) {}
		return fallback;
	}

	function write(key, value) {
		try {
			global.localStorage.setItem(key, value);
		} catch (e) {}
	}

	var api = {
		mode: read(KEY_MODE, MODES, "system"),
		color: read(KEY_COLOR, COLORS, "blue"),

		isDark: function () {
			return api.mode === "dark" || (api.mode === "system" && !!media && media.matches);
		},

		setMode: function (mode) {
			if (MODES.indexOf(mode) === -1) return;
			api.mode = mode;
			write(KEY_MODE, mode);
			apply();
		},

		setColor: function (color) {
			if (COLORS.indexOf(color) === -1) return;
			api.color = color;
			write(KEY_COLOR, color);
			apply();
		},

		onChange: function (fn) {
			listeners.push(fn);
			return function () {
				var i = listeners.indexOf(fn);
				if (i > -1) listeners.splice(i, 1);
			};
		}
	};

	function apply() {
		var dark = api.isDark();
		root.classList.toggle("dark", dark);
		root.classList.toggle("green", api.color === "green");
		root.classList.toggle("pink", api.color === "pink");
		root.classList.toggle("black", api.color === "black");
		root.setAttribute("data-mode", api.mode);
		root.setAttribute("data-color", api.color);

		var meta = document.querySelector('meta[name="theme-color"]');
		if (meta) {
			meta.setAttribute("content", THEME_COLOR[api.color][dark ? "dark" : "light"]);
		}

		paintFlower(api.color);

		for (var i = 0; i < listeners.length; i++) {
			listeners[i](api.mode, api.color);
		}
	}

	/* 主页才有花朵纹理；css/page.css 用 --flower-enabled 打标记，
	 * 子页面没有这个变量，就完全跳过（也就不会多发一次请求） */
	function flowerEnabled() {
		if (!global.getComputedStyle) return false;
		return global.getComputedStyle(root).getPropertyValue("--flower-enabled").trim() === "1";
	}

	/* 写在内联样式上：一定压过 css/page.css 里按配色写的规则 */
	function setFlowerUrl(url) {
		if (url) root.style.setProperty("--flower-img", 'url("' + url + '")');
		else root.style.removeProperty("--flower-img");
	}

	function setFlowerShadowUrl(url) {
		if (url) root.style.setProperty("--flower-shadow-img", 'url("' + url + '")');
		else root.style.removeProperty("--flower-shadow-img");
	}

	/* 把一张 SVG 的所有内容包进带高斯模糊的 <g>，得到"同位置、同图案、只多了模糊"的投影版。
	 * stdDeviation 用画布单位，所以按 --flower-size 把 CSS 像素换算进去；
	 * 移动端 --flower-size 变小，模糊半径也会等比缩小，观感保持一致。 */
	function blurSvg(svg, blurCssPx) {
		var open = svg.indexOf(">") + 1;
		var close = svg.lastIndexOf("</svg>");
		if (open <= 0 || close < open) return svg;
		var sigma = blurCssPx * FLOWER_SIZE / FLOWER_CSS_SIZE;
		return svg.slice(0, open) +
			'<defs><filter id="flower-shadow-blur" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">' +
			'<feGaussianBlur stdDeviation="' + fmtNumber(sigma) + '"/></filter></defs>' +
			'<g filter="url(#flower-shadow-blur)">' + svg.slice(open, close) + '</g></svg>';
	}

	/* 去掉浮点尾巴，避免 SVG 里出现 29.257142857142856 这种长串 */
	function fmtNumber(n) {
		return String(Math.round(n * 100) / 100);
	}

	/* 蓝 / 绿 / 粉 / 黑各画一张，缓存在内存里；FlowerGen 由 flower/js/flower.js 提供 */
	function paintFlower(color) {
		if (!flowerEnabled() || !global.FlowerGen) return;
		var key = flowerKey(color);
		if (flowerUrls[key]) {
			setFlowerUrl(flowerUrls[key]);
			setFlowerShadowUrl(flowerShadowUrls[key]);
			return;
		}
		var svg = global.FlowerGen.generate({
			size: FLOWER_SIZE,
			petals: 7,
			color: flowerAccent(color),
			fillOpacity: flowerFill(color),
			scale: 0.4,
			grid: true,
			labels: true
		});
		/* 投影只留线：填充设 0，只保留花瓣轮廓和极坐标网格的描边。
		 * 带填充的话，黑影会从半透明的花瓣里透上来，把原来的淡蓝压成灰。 */
		var shadowSvg = global.FlowerGen.generate({
			size: FLOWER_SIZE,
			petals: 7,
			color: flowerShadowColor(color),
			fillOpacity: 0,
			scale: 0.4,
			grid: true,
			labels: false
		});
		/* generate 会无条件加一行水印 <text>，投影里不要它（糊开就是一块脏） */
		shadowSvg = shadowSvg.replace(/<text[\s\S]*?<\/text>/g, "");
		flowerUrls[key] = global.URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
		flowerShadowUrls[key] = global.URL.createObjectURL(
			new Blob([blurSvg(shadowSvg, FLOWER_BLUR)], { type: "image/svg+xml" })
		);
		if (api.color === color) {
			setFlowerUrl(flowerUrls[key]);
			setFlowerShadowUrl(flowerShadowUrls[key]);
		}
	}

	/* 跟随系统：系统切换深浅时直接重套，不用重载页面 */
	if (media) {
		var onSystemChange = function () {
			if (api.mode === "system") apply();
		};
		if (media.addEventListener) {
			media.addEventListener("change", onSystemChange);
		} else if (media.addListener) {
			media.addListener(onSystemChange);
		}
	}

	api.apply = apply;
	api.apply();
	global.CeleTheme = api;

	/* 本脚本在 <head> 里执行，个别浏览器此时还没解析完样式表，
	 * 读不到 --flower-enabled；等 DOM / 资源就绪再补一次（幂等） */
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () {
			paintFlower(api.color);
		});
	}
	global.addEventListener("load", function () {
		paintFlower(api.color);
	});
})(window);
