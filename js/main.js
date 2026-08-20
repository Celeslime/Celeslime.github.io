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
	var dots = Array.prototype.slice.call(document.querySelectorAll(".side-dots a"));
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
		{ t: "喜欢你，是我做过最勇敢的事", f: "(๑•̀ㅂ•́)و✧" },
		{ t: "心里的她替你完成了所有期待，现实中的她却在教你学会接纳。", f: "(´-ω-`)" },
		{ t: "爱一个人，有时不是爱她本身，而是爱她刚好接住了你的想象。", f: "(｡•́︿•̀｡)" },
		{ t: "理想化不是深情，是还没准备好面对真实。", f: "(⇀‸↼‶)" },
		{ t: "我们常常不是被对方困住，而是被自己投射出的影子困住。", f: "(´･_･`)" },
		{ t: "现实中的她不需要完美，只需要被完整地看见。", f: "(˶ᵕ ᵕ˶)" },
		{ t: "情绪价值不是谁哄谁，而是两个人的感受都被允许存在。", f: "(´｡• ᵕ •｡`)" },
		{ t: "男生不是不需要情绪价值，只是很少被允许表达需要。", f: "(￣～￣;)" },
		{ t: "很多情绪需求的性别差异，不是天生如此，而是被期待如此。", f: "(´-ι_-｀)" },
		{ t: "把照顾情绪默认交给某一方，是关系里最隐蔽的不公平。", f: "( •̥́ ˍ •̀ू )" },
		{ t: "社会对女性情绪表达的宽容，有时也变成一种变相的情绪劳动期待。", f: "(´-ω-`)" },
		{ t: "一个人越早识别自己的感受，就越少要求别人替他承担感受。", f: "(•ө•)♡" },
		{ t: "我们谈论情绪价值，有时只是在谈如何被满足，而不是如何共处。", f: "(⇀‸↼‶)" },
		{ t: "真正的亲密不是没有差异，而是不把差异变成谁更高明的证明。", f: "(｡•̀ᴗ-)✧" },
		{ t: "心里的她如果太完美，现实里的她就会太辛苦。", f: "(˶‾᷄ ⁻̫ ‾᷅˵)" },
		{ t: "别让被爱变成一场考试，对方不是出题人，你也不是。", f: "✧(≖ ◡ ≖✿)" },
		{ t: "你渴望被接住的情绪，也许正是别人也曾不被允许表达的部分。", f: "(⁄ ⁄•⁄ω⁄•⁄ ⁄)" }
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

/* 主题切换：点击导航按钮在深浅模式间切换，并持久化到 localStorage */
(function () {
	"use strict";

	var btn = document.getElementById("theme-toggle");
	if (!btn) return;

	btn.addEventListener("click", function () {
		var root = document.documentElement;
		var dark = root.classList.toggle("dark");
		/* 显式存 light/dark：用户手动选择后不再跟随系统偏好 */
		try {
			localStorage.setItem("theme", dark ? "dark" : "light");
		} catch (e) {}
	});
})();
