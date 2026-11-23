/* ============================================================
 * 404 纠错提示：拿 /sitemap.xml 当"已知页面清单"，把当前 404 的路径
 * 和清单里的路径做比较，给出一个"你要找的可能是"的链接。
 *
 *   - 只提示，不自动跳转（是否离开当前页交给用户决定）
 *   - 大小写 / 末尾斜杠不同 → 视为几乎确定
 *   - 拼写接近、只输了路径前半截（如 /alpha → /alpha_recon）→ 给出建议
 *   - 只是"在某个已知目录里打错子路径" → 提示回目录
 *   - 差太远 → 什么都不猜，保留原来的 404 提示
 *
 * 依赖：无。sitemap 拉取失败时静默降级成普通 404。
 * 调试：window.Cele404.pick(path, urls) / normalize / score / distance
 * ============================================================ */
(function (global) {
	"use strict";

	var MIN_SCORE = 0.6; /* 低于这个分数不提示，避免"瞎猜" */
	var MAX_URLS = 2000;

	function safeDecode(value) {
		try {
			return decodeURI(value);
		} catch (e) {
			/* 路径里有残缺的百分号编码时 decodeURI 会抛错，原样用 */
			return value;
		}
	}

	/* 统一成便于比较的形式：解码、合并重复斜杠、去掉末尾斜杠和 index.html */
	function normalize(pathname) {
		var path = safeDecode(pathname || "/");
		path = path.replace(/\/{2,}/g, "/");
		path = path.replace(/\/index\.html?$/i, "/");
		if (path.length > 1) path = path.replace(/\/+$/, "");
		if (path.charAt(0) !== "/") path = "/" + path;
		return path || "/";
	}

	/* Damerau-Levenshtein（OSA）：支持相邻字符换位，syw → ysw 只算 1 步 */
	function distance(a, b) {
		var rows = a.length + 1;
		var cols = b.length + 1;
		var d = [];
		var i;
		var j;
		for (i = 0; i < rows; i++) {
			d[i] = [];
			for (j = 0; j < cols; j++) d[i][j] = 0;
		}
		for (i = 0; i < rows; i++) d[i][0] = i;
		for (j = 0; j < cols; j++) d[0][j] = j;

		for (i = 1; i < rows; i++) {
			for (j = 1; j < cols; j++) {
				var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
				d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
				if (
					i > 1 &&
					j > 1 &&
					a.charAt(i - 1) === b.charAt(j - 2) &&
					a.charAt(i - 2) === b.charAt(j - 1)
				) {
					d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
				}
			}
		}
		return d[a.length][b.length];
	}

	function score(requested, candidate) {
		var a = requested.toLowerCase();
		var b = candidate.toLowerCase();
		if (a === b) return requested === candidate ? 1 : 0.96;

		/* 请求的是已知目录下面的子路径：提示回目录 */
		if (candidate !== "/" && a.indexOf(b + "/") === 0) return 0.75;

		/* 只输了路径的前半截，例如 /alpha → /alpha_recon */
		if (a.length >= 3 && b.indexOf(a) === 0) return 0.8;

		/* 路径整体拼不出来，但末端名字能对上：/recon → /alpha_recon */
		var segA = a.slice(a.lastIndexOf("/") + 1);
		var segB = b.slice(b.lastIndexOf("/") + 1);
		if (segA && segB) {
			if (segA === segB) return 0.9;
			if (segA.length >= 3 && segB.indexOf(segA) === 0) return 0.85;
			if (segA.length >= 4 && segB.slice(-segA.length) === segA) return 0.85;
		}

		var max = Math.max(a.length, b.length);
		if (!max) return 1;
		return Math.max(0, 1 - distance(a, b) / max);
	}

	/* requested：当前路径；urls：[{ href, path }]，path 已 normalize */
	function pick(requested, urls) {
		var req = normalize(requested);
		var best = null;
		var i;

		for (i = 0; i < urls.length; i++) {
			var item = urls[i];
			/* sitemap 里列了这条路径，说明站点数据比线上新：不猜，免得绕圈 */
			if (item.path === req) return null;

			var value = score(req, item.path);
			if (!best || value > best.score || (value === best.score && item.path.length < best.path.length)) {
				best = { href: item.href, path: item.path, score: value };
			}
		}

		return best && best.score >= MIN_SCORE ? best : null;
	}

	function readSitemap(text) {
		var doc = new DOMParser().parseFromString(text, "application/xml");
		if (doc.getElementsByTagName("parsererror").length) return [];

		var nodes = doc.getElementsByTagName("loc");
		var seen = Object.create(null);
		var urls = [];
		for (var i = 0; i < nodes.length && urls.length < MAX_URLS; i++) {
			var loc = (nodes[i].textContent || "").trim();
			if (!loc) continue;
			var url;
			try {
				url = new URL(loc, global.location.href);
			} catch (e) {
				continue;
			}
			/* 只取路径：sitemap 里写的是正式域名，本地自检 / 预览域名也要能用 */
			if (url.protocol !== "http:" && url.protocol !== "https:") continue;

			var path = normalize(url.pathname);
			if (seen[path]) continue;
			seen[path] = 1;
			urls.push({ href: url.pathname, path: path });
		}
		return urls;
	}

	/* 只展示建议，不替用户跳转 */
	function showSuggestion(best) {
		var box = document.getElementById("error_suggest");
		if (!box) return;
		box.textContent = "";

		var label = document.createElement("span");
		label.className = "suggest-label";
		label.textContent = "你要找的可能是";

		var link = document.createElement("a");
		link.className = "suggest-link";
		link.href = best.href;
		link.textContent = best.href;

		box.appendChild(label);
		box.appendChild(link);
		box.hidden = false;
	}

	function init() {
		/* 直接展示路径本身，比整条 URL 更容易读；完整地址放进 title */
		var shown = document.getElementById("error_a");
		if (shown) {
			shown.textContent = safeDecode(global.location.pathname + global.location.search) || "/";
			shown.title = safeDecode(global.location.href);
		}

		if (!global.fetch || !global.DOMParser) return;

		global
			.fetch("/sitemap.xml", { credentials: "same-origin" })
			.then(function (res) {
				return res.ok ? res.text() : "";
			})
			.then(function (text) {
				if (!text) return;
				var best = pick(global.location.pathname, readSitemap(text));
				if (best) showSuggestion(best);
			})
			.catch(function () {
				/* 离线 / sitemap 不可用：保留普通 404 即可 */
			});
	}

	global.Cele404 = {
		normalize: normalize,
		distance: distance,
		score: score,
		pick: pick
	};

	init();
})(window);
