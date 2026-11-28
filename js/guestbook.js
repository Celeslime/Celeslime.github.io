/* 留言板 + 访问统计 + AI 自动回复展示：独立模块，调用 Cloudflare Pages API（cele-api.pages.dev）
   所有请求失败均静默降级，不影响页面本身
   AI 回复是提交后异步生成的（见 cele-api 的 _worker.js），因此：
   1) 每条留言渲染 ai_reply 字段（有则显示"Cele 回复"气泡）；
   2) 页面可见时每 30s 轮询一次，访客停留期间能看到回复"出现"；
   3) 刚提交的留言显示"思考中"占位，收到回复或超时后消失。 */
(function () {
	"use strict";

	var API = "https://cele-api.pages.dev";
	/* cele-api 的 CORS 只放行下面这几个来源；本地 Live Server（127.0.0.1:5500 / localhost:5500）
	   也加进了白名单，所以本地预览同样能看留言、发留言。
	   其它环境（file://、随机端口等）一律静默跳过，避免控制台刷一串 CORS 报错。 */
	var ALLOWED_HOSTS = ["celeslime.github.io", "127.0.0.1", "localhost", "192.168.3.10"];
	function apiEnabled() {
		try { return ALLOWED_HOSTS.indexOf(location.hostname) !== -1; } catch (e) { return false; }
	}

	var listEl = document.getElementById("comment-list");
	var emptyEl = document.getElementById("comment-empty");
	var visitsEl = document.getElementById("visits");
	var formEl = document.getElementById("comment-form");
	var nameEl = document.getElementById("gb-name");
	var textEl = document.getElementById("gb-text");
	var countEl = document.getElementById("gb-count");
	var previewEl = document.getElementById("gb-avatar-preview");
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
				'<p class="gb-item-ai-text">思考中，请稍候</p>' +
				"</div>"
			);
		}
		return "";
	}

	/* 留言头像：按昵称复用 flower.js 的 generateAvatar 生成 SVG（无网格、透明、水印"鸿"）。
	   渲染失败/无依赖时静默返回空，不影响留言内容。 */
	function avatar(name, extraClass) {
		if (typeof FlowerGen === "undefined" || !FlowerGen.generateAvatar) return "";
		try {
			var svg = FlowerGen.generateAvatar(name || "", { size: 72, res: 90 });
			return '<img class="gb-avatar' + (extraClass ? " " + extraClass : "") +
				'" alt="" width="32" height="32" decoding="async" ' +
				'src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '">';
		} catch (e) {
			return "";
		}
	}

	/* 输入框左侧的头像预览：跟着昵称实时重绘。
	   去抖 90ms，连续输入（尤其拼音）时不至于每敲一下都重算 SVG。 */
	var previewTimer = null;

	function updatePreview() {
		previewTimer = null;
		if (!previewEl) return;
		var name = nameEl ? nameEl.value.trim() : "";
		previewEl.classList.toggle("is-empty", !name);
		previewEl.innerHTML = avatar(name, "gb-avatar-preview-img");
	}

	function schedulePreview() {
		if (previewTimer) clearTimeout(previewTimer);
		previewTimer = setTimeout(updatePreview, 90);
	}

	/* ---------- 瀑布流排版 ----------
	   留言已按时间倒序，逐条放进"当前最短的一列"（同高取靠左），
	   于是最新的一条总在左上角，阅读顺序变成从左到右、从上到下，
	   而不是 CSS columns 那样先填满左列再跳到下一列。
	   卡片宽度、高度仍由内容自然决定，视觉样式与多列瀑布一致。 */
	var MASONRY = { minWidth: 230, maxCols: 3, gap: 14 };

	function layoutMasonry() {
		if (!listEl) return;
		var items = listEl.getElementsByClassName("gb-item");
		if (!items.length) {
			listEl.style.height = "";
			return;
		}
		var width = listEl.clientWidth;
		if (!width) return;
		var cols = Math.max(1, Math.min(
			MASONRY.maxCols,
			Math.floor((width + MASONRY.gap) / (MASONRY.minWidth + MASONRY.gap))
		));
		var colWidth = (width - MASONRY.gap * (cols - 1)) / cols;
		var heights = [];
		var i;
		for (i = 0; i < cols; i++) heights.push(0);
		for (i = 0; i < items.length; i++) {
			var el = items[i];
			el.style.width = colWidth + "px";
			var h = el.offsetHeight;
			var col = 0;
			for (var c = 1; c < cols; c++) {
				if (heights[c] < heights[col] - 0.5) col = c;
			}
			el.style.left = col * (colWidth + MASONRY.gap) + "px";
			el.style.top = heights[col] + "px";
			heights[col] += h + MASONRY.gap;
		}
		var tallest = 0;
		for (i = 0; i < heights.length; i++) {
			if (heights[i] > tallest) tallest = heights[i];
		}
		listEl.style.height = (tallest - MASONRY.gap) + "px";
	}

	/* ---------- 结构化标签 ----------
	   后端异步打标（类型：观测/判断/决议/提问；议题：T1-T8；依据：A1-A3），
	   刚提交的留言可能还没有 tags，没有就整块不渲染。
	   想临时隐藏标签只改 SHOW_TAGS 一处（不动后端数据）。 */
	var SHOW_TAGS = true;
	var TAG_TOPIC = {
		T1: "判断与决策", T2: "自我审查", T3: "能量与耗竭", T4: "价值与意义",
		T5: "关系与他者", T6: "时间与计划", T7: "建模与工具", T8: "站点与记录"
	};

	function tagBlock(c) {
		if (!SHOW_TAGS || !c.tags || !c.tags.type) return "";
		var topic = TAG_TOPIC[c.tags.topic] || "";
		var html = '<div class="gb-item-tags">' +
			'<span class="gb-tag gb-tag-type" data-type="' + esc(c.tags.type) + '">' + esc(c.tags.type) + "</span>";
		if (topic) html += '<span class="gb-tag">' + esc(topic) + "</span>";
		if (c.tags.basis) html += '<span class="gb-tag gb-tag-basis">' + esc(c.tags.basis) + "</span>";
		return html + "</div>";
	}

	function renderComments(comments, animate) {
		if (!listEl) return;
		listEl.innerHTML = "";
		listEl.classList.toggle("gb-settled", !animate);
		if (!comments || !comments.length) {
			if (emptyEl) emptyEl.style.display = "";
			layoutMasonry();
			return;
		}
		if (emptyEl) emptyEl.style.display = "none";
		/* 最新留言在最前面：按 time 降序，不依赖后端返回顺序 */
		comments = comments.slice().sort(function (a, b) {
			return (new Date(b.time).getTime() || 0) - (new Date(a.time).getTime() || 0);
		});
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
				tagBlock(c) +
				aiBlock(c);
			listEl.appendChild(li);
		});
		layoutMasonry();
	}

	function clearThinking() {
		thinkingId = null;
		if (thinkingTimer) {
			clearTimeout(thinkingTimer);
			thinkingTimer = null;
		}
	}

	function loadComments(animate) {
		if (!apiEnabled() || !listEl || loading) return;
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
		if (!apiEnabled() || !visitsEl) return;
		/* 记录本次访问，顺带返回全站计数；credentials 让浏览器回传 cookie，10 分钟去重才生效 */
		fetch(API + "/api/stats?path=" + encodeURIComponent(location.pathname), { method: "POST", credentials: "include" })
			.then(function (r) { return r.json(); })
			.then(function (d) {
				if (!d || !d.ok) return;
				visitsEl.textContent = d.total;
			})
			.catch(function () {});
	}

	if (formEl) {
		formEl.addEventListener("submit", function (e) {
			e.preventDefault();
			/* 本地环境发请求必被 CORS 拦截，直接提示而不是触发一串网络报错 */
			if (!apiEnabled()) {
				alert("留言功能只在正式站点和本地预览（127.0.0.1 / localhost）可用。");
				return;
			}
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
					if (btnLabelEl) { btnLabelEl.textContent = "发布"; }
					if (textEl) updateCount();
				});
		});
	}

	/* 轮询：AI 回复是异步生成的，页面可见时定期刷新；后台标签页暂停以省流量 */
	setInterval(function () {
		if (document.hidden) return;
		loadComments();
	}, POLL_MS);

	/* 字符计数：随输入实时更新 "n / 500"；顺带让输入框随内容长高
	   （无边框的输入区不该固定占一大块空白，写长留言时再自然变高） */
	function updateCount() {
		if (!textEl) return;
		if (countEl) {
			var n = textEl.value.length;
			countEl.textContent = n + " / " + MAX_LEN;
			countEl.style.opacity = n > MAX_LEN * 0.9 ? "1" : "0.5";
		}
		textEl.style.height = "auto";
		textEl.style.height = Math.min(textEl.scrollHeight, 260) + "px";
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

	/* 昵称变化 → 头像预览实时跟着换；无昵称时显示匿名花朵 */
	if (nameEl) {
		nameEl.addEventListener("input", schedulePreview);
	}
	updatePreview();
	updateCount();

	/* 窗口尺寸变化后重排瀑布流（去抖；列数或宽度变了才需要重算） */
	var masonryTimer = null;
	window.addEventListener("resize", function () {
		if (masonryTimer) clearTimeout(masonryTimer);
		masonryTimer = setTimeout(layoutMasonry, 120);
	});
	/* 字体/图片就绪后高度可能微调，再排一次 */
	window.addEventListener("load", layoutMasonry);

	postStats();
	loadComments(true);
})();
