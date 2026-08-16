/* 滚动位置感知：scrollspy（右侧目录 + 导航高亮）+ QQ 复制 */
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
	function showTip(text, face) {
		var tip = document.createElement("div");
		tip.style.cssText =
			"position:fixed;top:64px;left:50%;transform:translateX(-50%);" +
			"background:var(--blue-light);color:var(--blue-deep);" +
			"padding:8px 18px;border-radius:999px;font-size:0.9rem;" +
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

	/* 彩蛋：只有"情感"标签可触发，随机弹一句告白 */
	var loveTips = [
		{ t: "我喜欢你", f: "(♡˙︶˙♡)" },
		{ t: "遇见你，是这里最棒的事", f: "٩(♡ε♡)۶" },
		{ t: "你值得被认真对待", f: "(˶ᵕ ᵕ˶)" },
		{ t: "想把世界上的温柔都给你", f: "(´,,•ω•,,)♡" },
		{ t: "谢谢你点开这里，也谢谢你存在", f: "(˶‾᷄ ⁻̫ ‾᷅˵)" },
		{ t: "今天也在偷偷喜欢你", f: "(⁄ ⁄•⁄ω⁄•⁄ ⁄)" },
		{ t: "爱意藏在每一行代码里", f: "♡(>ᴗ•)" },
		{ t: "无论何时看到你，都会心动", f: "(๑˃ᴗ˂)ﻭ" },
		{ t: "你是我藏在心里最温柔的秘密", f: "(•ө•)♡" },
		{ t: "我的未来，希望每个日出日落都有你", f: "✧(≖ ◡ ≖✿)" },
		{ t: "我可以错过很多，但不想错过你", f: "(´｡• ᵕ •｡`)" },
		{ t: "喜欢你，是我做过最勇敢的事", f: "(๑•̀ㅂ•́)و✧" }
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
