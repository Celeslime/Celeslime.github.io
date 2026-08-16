/* 滚动位置感知：scrollspy 高亮 + 顶部进度条 + QQ 复制 */
(function () {
	"use strict";

	var sections = Array.prototype.slice.call(document.querySelectorAll(".card-section"));
	var dots = Array.prototype.slice.call(document.querySelectorAll(".side-dots a"));
	var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
	var progress = document.getElementById("progress");
	var qqBtn = document.getElementById("qq-btn");

	/* scrollspy：找出当前视口中部所在的分区，高亮侧边目录与导航 */
	function spy() {
		var mark = window.scrollY + window.innerHeight * 0.35;
		var current = null;
		for (var i = 0; i < sections.length; i++) {
			if (sections[i].offsetTop <= mark) {
				current = sections[i];
			}
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

	/* 顶部滚动进度条 */
	function updateProgress() {
		var h = document.documentElement.scrollHeight - window.innerHeight;
		var p = h > 0 ? (window.scrollY / h) * 100 : 0;
		if (progress) progress.style.width = p + "%";
	}

	function onScroll() {
		spy();
		updateProgress();
	}
	window.addEventListener("scroll", onScroll, { passive: true });
	onScroll();

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
