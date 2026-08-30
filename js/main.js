/* 滚动位置感知：scrollspy（右侧目录 + 导航高亮） */
(function () {
	"use strict";

	/* 关闭浏览器滚动位置自动恢复，刷新统一回到顶部，避免被残留位置/锚点带偏 */
	try {
		if ("scrollRestoration" in history) {
			history.scrollRestoration = "manual";
		}
		window.scrollTo(0, 0);
	} catch (e) {}

	var sections = Array.prototype.slice.call(document.querySelectorAll(".card-section"));
	var dots = Array.prototype.slice.call(document.querySelectorAll(".side-dots-rail a"));
	var cardLinks = Array.prototype.slice.call(document.querySelectorAll(".side-dots-card a"));
	var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));

	/* scrollspy：找视口顶部附近（100px 处）所在的分区，与锚点跳转的 scroll-margin 统一 */
	function spy() {
		var mark = 100;
		var current = null;
		for (var i = 0; i < sections.length; i++) {
			var r = sections[i].getBoundingClientRect();
			if (r.top <= mark && r.bottom > mark) {
				current = sections[i];
				break;
			}
		}
		if (!current) {
			/* 仅当滚动接近页面底部时，才高亮最后一个分区（避免顶部/跳转中途误高亮） */
			var nearBottom = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight) < 2;
			if (nearBottom) {
				current = sections[sections.length - 1];
			} else if (sections[0].getBoundingClientRect().top > mark) {
				/* 页面顶部区域（第一个分区尚未进入标记线）：高亮"回到顶部"，并清空导航高亮 */
				dots.forEach(function (d) {
					d.classList.toggle("active", d.getAttribute("data-target") === "top");
				});
				cardLinks.forEach(function (c) {
					c.classList.toggle("active", c.getAttribute("data-target") === "top");
				});
				navLinks.forEach(function (l) {
					l.classList.remove("active");
				});
				return;
			}
		}
		if (!current) return;

		var id = current.id;
		dots.forEach(function (d) {
			d.classList.toggle("active", d.getAttribute("data-target") === id);
		});
		cardLinks.forEach(function (c) {
			c.classList.toggle("active", c.getAttribute("data-target") === id);
		});
		var nav = current.getAttribute("data-nav");
		navLinks.forEach(function (l) {
			l.classList.toggle("active", l.getAttribute("href") === "#" + nav);
		});
	}

	var ticking = false;
	function onScroll() {
		if (!ticking) {
			ticking = true;
			window.requestAnimationFrame(function () {
				spy();
				ticking = false;
			});
		}
	}
	window.addEventListener("scroll", onScroll, { passive: true });
	spy();

	/* 锚点链接：平滑滚动且不写 URL hash（避免刷新时自动下滑到锚点） */
	var anchors = Array.prototype.slice.call(document.querySelectorAll('a[href^="#"]'));
	anchors.forEach(function (a) {
		a.addEventListener("click", function (e) {
			var target = document.getElementById(a.getAttribute("href").slice(1));
			if (target) {
				e.preventDefault();
				target.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		});
	});

	/* 上下键：在相邻分区之间跳转（分区矮、一屏可容多个，跳转粒度小不丢上下文）
	   保护：焦点在输入元素时放行默认行为 */
	function currentIndex() {
		/* 视口顶部已滚过（top 在 mark 线上方）的最后一个分区；
		   没有任何分区被滚过则返回 -1（页面处于顶部 hero 区） */
		var mark = 100;
		var idx = -1;
		for (var i = 0; i < sections.length; i++) {
			if (sections[i].getBoundingClientRect().top <= mark) idx = i;
		}
		return idx;
	}

	document.addEventListener("keydown", function (e) {
		if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
		var t = e.target;
		if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
		var i = currentIndex();

		if (e.key === "ArrowDown") {
			if (i < 0) {
				/* 顶部 hero 区 -> 滚到第一个分区，不跳过 learning */
				e.preventDefault();
				sections[0].scrollIntoView({ behavior: "smooth", block: "start" });
			} else if (i >= sections.length - 1) {
				/* 已是最后一个分区 -> 滚到页面底部（露出 footer） */
				e.preventDefault();
				window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
			} else {
				e.preventDefault();
				sections[i + 1].scrollIntoView({ behavior: "smooth", block: "start" });
			}
		} else {
			if (i <= 0) {
				/* 顶部 hero 或第一个分区内 -> 回页面顶部 */
				e.preventDefault();
				window.scrollTo({ top: 0, behavior: "smooth" });
			} else {
				e.preventDefault();
				sections[i - 1].scrollIntoView({ behavior: "smooth", block: "start" });
			}
		}
	});

	/* 顶部提示气泡（被"情感"彩蛋复用） */
	function showTip(text, face) {
		var tip = document.createElement("div");
		tip.style.cssText =
			"position:fixed;top:64px;left:50%;transform:translateX(-50%);" +
			"background:var(--blue-light);color:var(--blue-deep);" +
			"padding:8px 18px;border-radius:16px;font-size:0.9rem;" +
			"border:1px solid var(--border);" +
			"text-align:center;max-width:88vw;" +
			"box-shadow:var(--shadow-out);z-index:99;transition:opacity 0.6s ease;";
		/* 文案可正常折行；颜文字用 nowrap span 包住，保证永远完整不被打断 */
		tip.appendChild(document.createTextNode(text));
		if (face) {
			var faceSpan = document.createElement("span");
			faceSpan.style.whiteSpace = "nowrap";
			faceSpan.style.marginLeft = "0.5em";
			faceSpan.textContent = face;
			tip.appendChild(faceSpan);
		}
		document.body.appendChild(tip);
		setTimeout(function () {
			tip.style.opacity = "0";
			setTimeout(function () { tip.remove(); }, 600);
		}, 2000);
	}

	/* 彩蛋：只有"情感"标签可触发，随机弹一句告白 */
	var loveTips = [
		{ t: "loveTips内容优化中...过几天再试吧", f: "(♡˙︶˙♡)" },
	];
	var tags = Array.prototype.slice.call(document.querySelectorAll(".tag"));
	tags.forEach(function (t) {
		if (t.textContent.trim() !== "情感") return;
		t.addEventListener("click", function () {
			var item = loveTips[Math.floor(Math.random() * loveTips.length)];
			showTip(item.t, item.f);
		});
	});
})();

/* 首次访问欢迎提示（不阻塞页面，自动淡出） */
(function () {
	"use strict";

	if (localStorage.getItem("vis")) {
		return;
	}
	localStorage.setItem("vis", "1");

	var tip = document.createElement("div");
	tip.id = "welcome";
	tip.textContent = "欢迎光临ヾ(≧▽≦*)o";
	tip.style.cssText =
		"position:fixed;top:64px;left:50%;transform:translateX(-50%);" +
		"background:var(--blue-light,#efe);color:var(--blue-deep,#1f5b8a);" +
		"padding:8px 18px;border-radius:999px;font-size:0.9rem;" +
		"box-shadow:var(--shadow-out);transition:opacity 0.6s ease;z-index:99;";
	document.body.appendChild(tip);

	setTimeout(function () {
		tip.style.opacity = "0";
		setTimeout(function () { tip.remove(); }, 650);
	}, 2600);
})();

/* 主题模式：浅色 / 深色 / 跟随系统（hover 下拉分段按钮选择），持久化到 localStorage */
(function () {
	"use strict";

	var root = document.documentElement;
	var media = window.matchMedia("(prefers-color-scheme: dark)");
	var menu = document.getElementById("theme-menu");
	if (!menu) return;
	var trigger = document.getElementById("theme-trigger");
	var segs = menu.querySelectorAll(".theme-seg");

	/* 当前模式："light" | "dark" | "system"（未存过默认 system） */
	function getMode() {
		try {
			var m = localStorage.getItem("theme");
			if (m === "light" || m === "dark" || m === "system") return m;
		} catch (e) {}
		return "system";
	}

	function applyMode(mode) {
		var dark = mode === "dark" || (mode === "system" && media.matches);
		root.classList.toggle("dark", dark);
		for (var i = 0; i < segs.length; i++) {
			var on = segs[i].getAttribute("data-theme") === mode;
			segs[i].classList.toggle("active", on);
			segs[i].setAttribute("aria-checked", on ? "true" : "false");
		}
		try {
			localStorage.setItem("theme", mode);
		} catch (e) {}
	}

	function openMenu() {
		menu.classList.add("open");
		trigger.setAttribute("aria-expanded", "true");
	}

	function closeMenu() {
		menu.classList.remove("open");
		trigger.setAttribute("aria-expanded", "false");
	}

	segs.forEach(function (seg) {
		seg.addEventListener("click", function () {
			applyMode(seg.getAttribute("data-theme"));
			closeMenu();
		});
	});

	/* hover 之外，点击触发按钮用于触屏/键盘开关 */
	trigger.addEventListener("click", function (e) {
		e.stopPropagation();
		menu.classList.contains("open") ? closeMenu() : openMenu();
	});

	/* 点击其它处或按 Esc 关闭下拉 */
	document.addEventListener("click", function (e) {
		if (!menu.contains(e.target)) closeMenu();
	});
	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape") closeMenu();
	});

	/* 跟随系统模式下，系统偏好变化实时生效 */
	function onMediaChange() {
		if (getMode() === "system") applyMode("system");
	}
	if (media.addEventListener) {
		media.addEventListener("change", onMediaChange);
	} else if (media.addListener) {
		media.addListener(onMediaChange);
	}

	applyMode(getMode());
})();
