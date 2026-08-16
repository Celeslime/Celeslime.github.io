/* 滚动位置感知：scrollspy（右侧目录 + 导航高亮）+ QQ 复制 */
(function () {
	"use strict";

	var sections = Array.prototype.slice.call(document.querySelectorAll(".card-section"));
	var dots = Array.prototype.slice.call(document.querySelectorAll(".side-dots a"));
	var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
	var qqBtn = document.getElementById("qq-btn");

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
			if (nearBottom) current = sections[sections.length - 1];
		}
		if (!current) return;

		var id = current.id;
		dots.forEach(function (d) {
			d.classList.toggle("active", d.getAttribute("data-target") === id);
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

	/* QQ：点击复制号码（无风险链接，永不失效） */
	function showTip(text) {
		var tip = document.createElement("div");
		tip.textContent = text;
		tip.style.cssText =
			"position:fixed;top:64px;left:50%;transform:translateX(-50%);" +
			"background:var(--blue-light);color:var(--blue-deep);" +
			"padding:8px 18px;border-radius:999px;font-size:0.9rem;" +
			"box-shadow:var(--shadow-out);z-index:99;transition:opacity 0.6s ease;";
		document.body.appendChild(tip);
		setTimeout(function () {
			tip.style.opacity = "0";
			setTimeout(function () { tip.remove(); }, 600);
		}, 2000);
	}

	function fallbackCopy(text) {
		var ta = document.createElement("textarea");
		ta.value = text;
		ta.style.position = "fixed";
		ta.style.opacity = "0";
		document.body.appendChild(ta);
		ta.select();
		try { document.execCommand("copy"); } catch (e) {}
		ta.remove();
	}

	if (qqBtn) {
		qqBtn.addEventListener("click", function (e) {
			e.preventDefault();
			var qq = "1575989756";
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(qq).then(
					function () { showTip("QQ 号已复制：" + qq); },
					function () { fallbackCopy(qq); showTip("QQ 号已复制：" + qq); }
				);
			} else {
				fallbackCopy(qq);
				showTip("QQ 号已复制：" + qq);
			}
		});
	}
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
