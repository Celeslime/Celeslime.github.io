/* 留言板 + 访问统计 + AI 自动回复展示：独立模块，调用 Cloudflare Pages API（cele-api.pages.dev）
   所有请求失败均静默降级，不影响页面本身
   AI 回复是提交后异步生成的（见 cele-api 的 _worker.js），因此：
   1) 每条留言渲染 ai_reply 字段（有则显示"Cele 回复"气泡）；
   2) 页面可见时每 30s 轮询一次，访客停留期间能看到回复"出现"；
   3) 刚提交的留言显示"思考中"占位，收到回复或超时后消失。 */
(function () {
	"use strict";

	var API = "https://cele-api.pages.dev";

	var listEl = document.getElementById("comment-list");
	var emptyEl = document.getElementById("comment-empty");
	var visitsEl = document.getElementById("visits");
	var pageVisitsEl = document.getElementById("page-visits");
	var formEl = document.getElementById("comment-form");
	var nameEl = document.getElementById("gb-name");
	var textEl = document.getElementById("gb-text");
	var countEl = document.getElementById("gb-count");
	var btnEl = formEl ? formEl.querySelector("button") : null;
	var btnLabelEl = btnEl ? btnEl.querySelector(".gb-btn-label") : null;

	var MAX_LEN = 500;

	/* 等待 AI 回复的留言 id（仅对"我"刚提交的留言显示"思考中"占位） */
	var thinkingId = null;
	var thinkingTimer = null;
	/* 轮询防重入：避免上一次请求未返回时又发一次 */
	var loading = false;

	var POLL_MS = 30000;             /* 页面可见时的轮询间隔 */
	var THINKING_TIMEOUT = 3 * 60 * 1000; /* "思考中"占位最多显示 3 分钟 */

	/* 转义留言内容，避免把用户输入当 HTML 渲染 */
	function esc(s) {
		var div = document.createElement("div");
		div.textContent = s == null ? "" : String(s);
		return div.innerHTML;
	}

	function pad(n) {
		return (n < 10 ? "0" : "") + n;
	}

	function fmtTime(iso) {
		try {
			var d = new Date(iso);
			if (isNaN(d.getTime())) return "";
			return (
				d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
				" " + pad(d.getHours()) + ":" + pad(d.getMinutes())
			);
		} catch (e) {
			return "";
		}
	}

	/* AI 回复区：有回复显示内容；无回复但正等自己的留言回复则显示"思考中"占位 */
	function aiBlock(c) {
		if (c.ai_reply) {
			return (
				'<div class="gb-item-ai">' +
				'<div class="gb-item-ai-head">Cele 回复</div>' +
				'<p class="gb-item-ai-text">' + esc(c.ai_reply) + "</p>" +
				"</div>"
			);
		}
		if (thinkingId && c.id === thinkingId) {
			return (
				'<div class="gb-item-ai gb-item-ai-thinking">' +
				'<div class="gb-item-ai-head">Cele 回复</div>' +
				'<p class="gb-item-ai-text">思考中，请稍候…</p>' +
				"</div>"
			);
		}
		return "";
	}

	/* 留言头像：按昵称复用 flower.js 的 generateAvatar 生成 SVG（无网格、透明、水印"鸿"）。
	   渲染失败/无依赖时静默返回空，不影响留言内容。 */
	function avatar(name) {
		if (typeof FlowerGen === "undefined" || !FlowerGen.generateAvatar) return "";
		try {
			var svg = FlowerGen.generateAvatar(name || "", { size: 72, res: 90 });
			return '<img class="gb-avatar" alt="" width="32" height="32" decoding="async" ' +
				'src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '">';
		} catch (e) {
			return "";
		}
	}

	function renderComments(comments, animate) {
		if (!listEl) return;
		listEl.innerHTML = "";
		listEl.classList.toggle("gb-settled", !animate);
		if (!comments || !comments.length) {
			if (emptyEl) emptyEl.style.display = "";
			return;
		}
		if (emptyEl) emptyEl.style.display = "none";
		comments.forEach(function (c) {
			var li = document.createElement("li");
			li.className = "gb-item";
			li.innerHTML =
				'<div class="gb-item-head">' +
				'<span class="gb-item-user">' + avatar(c.name) +
				'<span class="gb-item-name">' + esc(c.name || "匿名") + "</span></span>" +
				'<span class="gb-item-time">' + esc(fmtTime(c.time)) + "</span>" +
				"</div>" +
				'<p class="gb-item-text">' + esc(c.text) + "</p>" +
				aiBlock(c);
			listEl.appendChild(li);
		});
	}

	function clearThinking() {
		thinkingId = null;
		if (thinkingTimer) {
			clearTimeout(thinkingTimer);
			thinkingTimer = null;
		}
	}

	function loadComments(animate) {
		if (!listEl || loading) return;
		loading = true;
		fetch(API + "/api/comments")
			.then(function (r) { return r.json(); })
			.then(function (d) {
				if (d && d.ok) {
					renderComments(d.comments, animate);
					/* 自己的留言已经收到 AI 回复：结束"思考中"占位 */
					if (
						thinkingId &&
						d.comments.some(function (c) {
							return c.id === thinkingId && c.ai_reply;
						})
					) {
						clearThinking();
					}
				}
			})
			.catch(function () {})
			.finally(function () { loading = false; });
	}

	function postStats() {
		if (!visitsEl && !pageVisitsEl) return;
		/* 记录本次访问，顺带返回全站与当前页计数 */
		fetch(API + "/api/stats?path=" + encodeURIComponent(location.pathname), { method: "POST" })
			.then(function (r) { return r.json(); })
			.then(function (d) {
				if (!d || !d.ok) return;
				if (visitsEl) visitsEl.textContent = d.total;
				if (pageVisitsEl && d.page) pageVisitsEl.textContent = d.page.count;
			})
			.catch(function () {});
	}

	if (formEl) {
		formEl.addEventListener("submit", function (e) {
			e.preventDefault();
			var name = (nameEl ? nameEl.value : "").trim().slice(0, 20);
			var text = (textEl ? textEl.value : "").trim().slice(0, 500);
			if (!text) return;
			var btn = formEl.querySelector("button");
			if (btn) { btn.disabled = true; }
			if (btnLabelEl) { btnLabelEl.textContent = "发布中…"; }
			fetch(API + "/api/comments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: name, text: text })
			})
				.then(function (r) { return r.json(); })
				.then(function (d) {
					if (d && d.ok) {
						if (textEl) textEl.value = "";
						/* 标记刚提交的这条留言等待 AI 回复（异步生成，稍候才有） */
						if (d.comment && d.comment.id) {
							thinkingId = d.comment.id;
							if (thinkingTimer) clearTimeout(thinkingTimer);
							thinkingTimer = setTimeout(clearThinking, THINKING_TIMEOUT);
						}
						loadComments(true);
					} else {
						alert(d && d.error ? d.error : "留言失败，请稍后再试");
					}
				})
				.catch(function () { alert("留言失败，请检查网络或稍后再试"); })
				.finally(function () {
					if (btn) { btn.disabled = false; }
					if (btnLabelEl) { btnLabelEl.textContent = "发布留言"; }
					if (textEl) updateCount();
				});
		});
	}

	/* 轮询：AI 回复是异步生成的，页面可见时定期刷新；后台标签页暂停以省流量 */
	setInterval(function () {
		if (document.hidden) return;
		loadComments();
	}, POLL_MS);

	/* 字符计数：随输入实时更新 "n / 500" */
	function updateCount() {
		if (!textEl || !countEl) return;
		var n = textEl.value.length;
		countEl.textContent = n + " / " + MAX_LEN;
		countEl.style.opacity = n > MAX_LEN * 0.9 ? "1" : "0.5";
	}

	/* 空状态提示可点击：点击后聚焦输入框（帮助发现留言入口） */
	if (emptyEl) {
		emptyEl.addEventListener("click", function () {
			if (textEl) textEl.focus();
			if (formEl) formEl.scrollIntoView({ behavior: "smooth", block: "center" });
		});
	}

	if (textEl) {
		textEl.addEventListener("input", updateCount);
	}

	postStats();
	loadComments(true);
})();
