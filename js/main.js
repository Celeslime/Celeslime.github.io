/* 分区进入视口浮现动画 + 导航 scrollspy 高亮 */
(function () {
	"use strict";

	var sections = Array.prototype.slice.call(document.querySelectorAll(".card-section"));
	var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));

	if ("IntersectionObserver" in window) {
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting) {
					entry.target.classList.add("visible");
					var nav = entry.target.getAttribute("data-nav");
					if (nav) {
						navLinks.forEach(function (link) {
							link.classList.toggle("active", link.getAttribute("href") === "#" + nav);
						});
					}
				}
			});
		}, { rootMargin: "-30% 0px -50% 0px" });
		sections.forEach(function (s) { io.observe(s); });
	} else {
		/* 不支持 IntersectionObserver 时直接显示全部 */
		sections.forEach(function (s) { s.classList.add("visible"); });
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
