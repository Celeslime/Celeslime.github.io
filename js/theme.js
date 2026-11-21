/* ============================================================
 * 主题状态：模式（浅色 / 深色 / 跟随系统）+ 配色（海盐蓝 / 青提绿 / 玫瑰粉）
 *
 * 在 <head> 里同步引入：脚本先于 <body> 绘制执行，刷新时不会先闪一下浅色。
 * 这里只负责"读取 / 保存 / 套用到 <html>"，菜单 UI 在 js/main.js 订阅 CeleTheme.onChange。
 *
 *   CeleTheme.mode            "light" | "dark" | "system"
 *   CeleTheme.color           "blue" | "green" | "pink"
 *   CeleTheme.isDark()        当前实际渲染是不是深色（system 时看系统偏好）
 *   CeleTheme.setMode(mode)   切换模式并持久化
 *   CeleTheme.setColor(color) 切换配色并持久化
 *   CeleTheme.onChange(fn)    订阅变化，返回取消订阅的函数
 * ============================================================ */
(function (global) {
	"use strict";

	var MODES = ["light", "dark", "system"];
	var COLORS = ["blue", "green", "pink"];
	var KEY_MODE = "theme";
	var KEY_COLOR = "theme-color";

	/* 与 css/base.css 的 --bg 对应，用来同步移动端浏览器地址栏颜色 */
	var THEME_COLOR = {
		blue: { light: "#f7fafc", dark: "#0d151d" },
		green: { light: "#f7fdfa", dark: "#06120e" },
		pink: { light: "#fdf7f9", dark: "#150a0f" }
	};

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
		root.setAttribute("data-mode", api.mode);
		root.setAttribute("data-color", api.color);

		var meta = document.querySelector('meta[name="theme-color"]');
		if (meta) {
			meta.setAttribute("content", THEME_COLOR[api.color][dark ? "dark" : "light"]);
		}

		for (var i = 0; i < listeners.length; i++) {
			listeners[i](api.mode, api.color);
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
})(window);
