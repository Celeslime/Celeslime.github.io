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
			/* 页面底部：最后一个分区已进入视口时，高亮它 */
			var last = sections[sections.length - 1].getBoundingClientRect();
			if (last.top < window.innerHeight) current = sections[sections.length - 1];
			/* 顶部 hero 区：不做高亮 */
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

	window.addEventListener("scroll", spy, { passive: true });
	spy();

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
