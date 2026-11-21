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
			"background:var(--accent-light);color:var(--accent-deep);" +
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
		{ t: "请你带着我的祝福，继续向前走吧！", f: "" },
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
		"background:var(--accent-light,#efe);color:var(--accent-deep,#1f5b8a);" +
		"padding:8px 18px;border-radius:999px;font-size:0.9rem;" +
		"box-shadow:var(--shadow-out);transition:opacity 0.6s ease;z-index:99;";
	document.body.appendChild(tip);

	setTimeout(function () {
		tip.style.opacity = "0";
		setTimeout(function () { tip.remove(); }, 650);
	}, 2600);
})();

/* 主题菜单：下拉开关 + 选中态同步（状态与持久化在 js/theme.js） */
(function () {
	"use strict";

	var menu = document.getElementById("theme-menu");
	var theme = window.CeleTheme;
	if (!menu || !theme) return;

	var trigger = document.getElementById("theme-trigger");
	var modeSegs = Array.prototype.slice.call(menu.querySelectorAll(".theme-seg[data-theme]"));
	var colorSegs = Array.prototype.slice.call(menu.querySelectorAll(".theme-seg[data-color]"));

	var MODE_TEXT = { light: "浅色", dark: "深色", system: "跟随系统" };
	var COLOR_TEXT = { blue: "海盐蓝", green: "青提绿", pink: "玫瑰粉" };

	/* 桌面端滑过即开、移开即关；触屏（无 hover）只走点击 */
	var canHover = !!window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
	var openTimer = 0;
	var closeTimer = 0;

	function isOpen() {
		return menu.classList.contains("open");
	}

	function openMenu() {
		clearTimeout(openTimer);
		clearTimeout(closeTimer);
		menu.classList.add("open");
		trigger.setAttribute("aria-expanded", "true");
	}

	function closeMenu() {
		clearTimeout(openTimer);
		clearTimeout(closeTimer);
		menu.classList.remove("open");
		trigger.setAttribute("aria-expanded", "false");
	}

	function markActive(segs, attr, current) {
		segs.forEach(function (seg) {
			var on = seg.getAttribute(attr) === current;
			seg.classList.toggle("active", on);
			seg.setAttribute("aria-checked", on ? "true" : "false");
		});
	}

	function sync() {
		markActive(modeSegs, "data-theme", theme.mode);
		markActive(colorSegs, "data-color", theme.color);
		trigger.setAttribute("title", "主题：" + MODE_TEXT[theme.mode] + " · " + COLOR_TEXT[theme.color]);
	}

	trigger.addEventListener("click", function (e) {
		e.stopPropagation();
		if (isOpen()) {
			closeMenu();
		} else {
			openMenu();
		}
	});

	modeSegs.forEach(function (seg) {
		seg.addEventListener("click", function () {
			theme.setMode(seg.getAttribute("data-theme"));
			closeMenu();
		});
	});

	colorSegs.forEach(function (seg) {
		seg.addEventListener("click", function () {
			theme.setColor(seg.getAttribute("data-color"));
			closeMenu();
		});
	});

	if (canHover) {
		menu.addEventListener("mouseenter", function () {
			clearTimeout(closeTimer);
			openTimer = setTimeout(openMenu, 90);
		});
		menu.addEventListener("mouseleave", function () {
			clearTimeout(openTimer);
			closeTimer = setTimeout(closeMenu, 160);
		});
	}

	/* 点空白处、按 Esc、Tab 出菜单时关闭 */
	document.addEventListener("click", function (e) {
		if (!menu.contains(e.target)) closeMenu();
	});

	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && isOpen()) {
			closeMenu();
			trigger.focus();
		}
	});

	menu.addEventListener("focusout", function (e) {
		if (!menu.contains(e.relatedTarget)) closeMenu();
	});

	/* 系统深浅色变化时只影响实际配色，不改变所选模式，但仍同步一次图标说明 */
	theme.onChange(sync);
	sync();
})();

/* 关于 · 来路：默认收起时间线，开关放在第一段（前言）末尾 */
(function () {
	"use strict";

	var toggle = document.getElementById("story-toggle");
	var list = document.getElementById("story-timeline");
	if (!toggle || !list) return;

	var label = toggle.querySelector(".story-toggle-label");

	function setOpen(open) {
		list.classList.toggle("is-collapsed", !open);
		toggle.setAttribute("aria-expanded", open ? "true" : "false");
		if (label) label.textContent = open ? "收起" : "展开";
	}

	toggle.addEventListener("click", function () {
		setOpen(list.classList.contains("is-collapsed"));
	});
})();
