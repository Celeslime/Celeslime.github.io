/* 主题：默认值 / 持久化 / 八套配色 / 三处毛玻璃一致 / 花朵背景跟着配色走 / 子页面。
 * 断言值就是 css/base.css 里的设计 token，改配色时记得同步这里。 */
export const title = "主题与毛玻璃";

const ACCENT = {
	"light-blue": "#4696d2",
	"light-green": "#0ea472",
	"light-pink": "#d24673",
	"light-black": "#17181c",
	"dark-blue": "#63aadd",
	"dark-green": "#34d399",
	"dark-pink": "#e2608a",
	"dark-black": "#e8e9ec"
};

const THEME_COLOR = {
	"light-blue": "#f7fafc",
	"light-green": "#f7fdfa",
	"light-pink": "#fdf7f9",
	"light-black": "#f3f3f4",
	"dark-blue": "#0d151d",
	"dark-green": "#06120e",
	"dark-pink": "#150a0f",
	"dark-black": "#070708"
};

/* 背景花朵：蓝 / 绿 / 粉深浅共用一张，黑配色浅色墨线、深色白线稿各一张 */
const FLOWER_ACCENT = {
	green: "#0ea472",
	pink: "#d24673",
	black: { light: "#17181c", dark: "#f5f6f7" }
};

const flowerAccent = (color, mode) => {
	const accent = FLOWER_ACCENT[color];
	return accent && typeof accent === "object" ? accent[mode] : accent;
};

const state = (page) =>
	page.evaluate(`
		const html = document.documentElement;
		const menu = document.getElementById("theme-menu");
		const panel = document.querySelector(".theme-menu-panel");
		const cs = panel ? getComputedStyle(panel) : null;
		const navEl = document.querySelector(".nav");
		const navBefore = navEl ? getComputedStyle(navEl, "::before") : null;
		const rail = document.querySelector(".side-dots-rail");
		const railCs = rail ? getComputedStyle(rail) : null;
		return {
			dark: html.classList.contains("dark"),
			green: html.classList.contains("green"),
			pink: html.classList.contains("pink"),
			black: html.classList.contains("black"),
			mode: html.getAttribute("data-mode"),
			color: html.getAttribute("data-color"),
			accent: getComputedStyle(html).getPropertyValue("--accent").trim(),
			stored: [localStorage.getItem("theme"), localStorage.getItem("theme-color")],
			panelBg: cs ? cs.backgroundColor : "no-panel",
			panelFilter: cs ? (cs.backdropFilter || cs.webkitBackdropFilter || "none") : "no-panel",
			navBg: navBefore ? navBefore.backgroundColor : "no-nav",
			navFilter: navBefore ? (navBefore.backdropFilter || navBefore.webkitBackdropFilter || "none") : "no-nav",
			railBg: railCs ? railCs.backgroundColor : "no-rail",
			railBorder: railCs ? railCs.borderTopColor : "no-rail",
			railShadow: railCs ? railCs.boxShadow : "no-rail",
			railFilter: railCs ? (railCs.backdropFilter || railCs.webkitBackdropFilter || "none") : "no-rail",
			panelVisible: !!cs && cs.visibility === "visible" && Number(cs.opacity) > 0.9,
			open: !!menu && menu.classList.contains("open"),
			expanded: menu ? document.getElementById("theme-trigger").getAttribute("aria-expanded") : "no-menu",
			active: Array.from(document.querySelectorAll(".theme-seg.active")).map((n) => n.dataset.theme || n.dataset.color),
			checked: Array.from(document.querySelectorAll('.theme-seg[aria-checked="true"]')).length,
			meta: (document.querySelector('meta[name="theme-color"]') || {}).content,
			legend: Array.from(document.querySelectorAll(".theme-field-label")).map((n) => n.textContent.trim()),
			flower: getComputedStyle(document.body).getPropertyValue("--flower-img").trim()
		};
	`);

const flowerText = (page) =>
	page.evaluate(`
		const raw = getComputedStyle(document.body).getPropertyValue("--flower-img").trim();
		const m = /url\\("?([^")]+)"?\\)/.exec(raw);
		const href = m ? m[1] : "";
		const text = href.startsWith("blob:") ? await (await fetch(href)).text() : "";
		return { href, text };
	`);

/* 花的投影：同一张 SVG 被包进带 feGaussianBlur 的 <g>，压在花下面 */
const flowerShadowText = (page) =>
	page.evaluate(`
		const raw = getComputedStyle(document.body).getPropertyValue("--flower-shadow-img").trim();
		const m = /url\\("?([^")]+)"?\\)/.exec(raw);
		const href = m ? m[1] : "";
		const text = href.startsWith("blob:") ? await (await fetch(href)).text() : "";
		return { href, text };
	`);

/* 头像：黑配色换成线稿遮罩，颜色直接取纯黑 / 纯白 */
const avatarStyle = (page) =>
	page.evaluate(`
		const el = document.querySelector("#profile .flower-mark");
		const cs = el ? getComputedStyle(el) : null;
		return {
			bg: cs ? cs.backgroundColor : "no-avatar",
			mask: cs ? (cs.maskImage || cs.webkitMaskImage || "") : ""
		};
	`);

export default async function run({ env, check, wait }) {
	const page = await env.openPage();
	const load = (pathname, storage) => page.load(pathname, storage);
	const site = "";
	try {
		/* 1. 无存储：跟随系统 + 海盐蓝 */
		await load("/index.html", {});
		let s = await state(page);
		check("默认 mode=system", s.mode === "system", s.mode);
		check("默认 color=blue", !s.green && !s.pink && !s.black, String(s.color));
		check("面板默认收起", !s.panelVisible && !s.open);
		check(
			"nav 毛玻璃在 ::before 上（否则会形成 backdrop root，面板采样不到页面）",
			s.navBg === "rgba(247, 250, 252, 0.8)" && /blur\(10px\)/.test(s.navFilter),
			s.navBg + " / " + s.navFilter
		);
		check("面板底色与 nav 一致", s.panelBg === s.navBg, s.panelBg + " vs " + s.navBg);
		check("面板模糊半径与 nav 一致", s.panelFilter === s.navFilter, s.panelFilter);
		check(
			"右侧目录收起时完全透明",
			s.railBg === "rgba(0, 0, 0, 0)" && s.railBorder === "rgba(0, 0, 0, 0)" && s.railShadow === "none",
			s.railBg + " / " + s.railBorder + " / " + s.railShadow
		);
		check("右侧目录收起时无模糊", s.railFilter === "none", s.railFilter);
		check("两组标签：模式 / 配色", s.legend.join("/") === "模式/配色", s.legend.join("/"));

		/* 2. 八套组合：class / data 属性 / 选中态 / meta / accent / 花朵背景 */
		for (const mode of ["light", "dark"]) {
			for (const color of ["blue", "green", "pink", "black"]) {
				const key = `${mode}-${color}`;
				await load("/index.html", { theme: mode, "theme-color": color });
				s = await state(page);
				check(
					`${key}: html 类`,
					s.dark === (mode === "dark") &&
						s.green === (color === "green") &&
						s.pink === (color === "pink") &&
						s.black === (color === "black")
				);
				check(`${key}: data-mode/data-color`, s.mode === mode && s.color === color, `${s.mode}/${s.color}`);
				check(`${key}: 选中态`, s.active.join(",") === `${mode},${color}`, s.active.join(","));
				check(`${key}: aria-checked=2`, s.checked === 2, String(s.checked));
				check(`${key}: meta theme-color`, s.meta === THEME_COLOR[key], s.meta);
				check(`${key}: --accent`, s.accent === ACCENT[key], s.accent);
				check(`${key}: 只持久化一个配色`, s.stored.join(",") === `${mode},${color}`, s.stored.join(","));

				const flower = await flowerText(page);
				check(`${key}: 花朵背景是运行时生成的 blob`, flower.href.startsWith("blob:"), flower.href.slice(0, 24));
				const accent = flowerAccent(color, mode);
				const hits = (flower.text.match(new RegExp(accent, "gi")) || []).length;
				check(`${key}: 花朵用该配色上色`, hits > 300, hits + " 处 " + accent);
				check(
					`${key}: 花瓣路径数与 flower.min.svg 一致（301）`,
					(flower.text.match(/<path/g) || []).length === 301,
					String((flower.text.match(/<path/g) || []).length)
				);
				if (color !== "blue") check(`${key}: 没有残留海盐蓝`, !/#4696d2/i.test(flower.text));
				if (color === "blue") check(`${key}: 不再请求 images/flower.min.svg`, !/flower\.min\.svg/.test(flower.href));

				const shadow = await flowerShadowText(page);
				check(`${key}: 花朵投影是运行时生成的 blob`, shadow.href.startsWith("blob:"), shadow.href.slice(0, 24));
				check(`${key}: 投影带高斯模糊`, /<feGaussianBlur\b/.test(shadow.text), shadow.text.slice(0, 40));
				check(
					`${key}: 投影与花共用同一朵花（301 条花瓣路径）`,
					(shadow.text.match(/<path/g) || []).length === 301,
					String((shadow.text.match(/<path/g) || []).length)
				);
				check(`${key}: 投影只留线（填充 0）`, /fill-opacity="0"/i.test(shadow.text), shadow.text.slice(0, 80));
				check(`${key}: 投影不带文字标签`, !/<text/i.test(shadow.text));
				if (color === "black") {
					/* 深色下是白花，投影也跟着变白；只保留 20% alpha，避免发光 */
					const shadowAccent = mode === "dark" ? "#f5f6f7" : "#17181c";
					check(
						`${key}: 投影跟花同色`,
						new RegExp(shadowAccent, "i").test(shadow.text),
						shadow.text.slice(0, 60)
					);
				}
			}
		}

		/* 3. 交互：hover 打开、点击打开、选深色后收起并持久化、点空白 / Esc 关闭 */
		await load("/index.html", { theme: "light", "theme-color": "green" });
		const trigger = await page.evaluate(`
			const r = document.getElementById("theme-trigger").getBoundingClientRect();
			return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
		`);
		await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: trigger.x, y: trigger.y });
		await wait(220);
		check("鼠标移入后打开", (await state(page)).open);
		await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: trigger.x - 60, y: trigger.y + 420 });
		await wait(320);
		check("鼠标移出后关闭", !(await state(page)).open);

		await page.evaluate(`document.getElementById("theme-trigger").click(); return 1;`);
		await wait(250);
		s = await state(page);
		check("点击后打开面板", s.open && s.panelVisible && s.expanded === "true");
		await page.evaluate(`document.querySelector('.theme-seg[data-theme="dark"]').click(); return 1;`);
		await wait(250);
		s = await state(page);
		check("选深色后 html.dark", s.dark);
		check("选深色后菜单收起", !s.open && s.expanded === "false");
		check("深色下 meta theme-color", s.meta === THEME_COLOR["dark-green"], s.meta);

		await page.evaluate(`document.getElementById("theme-trigger").click(); return 1;`);
		await wait(200);
		await page.evaluate(`document.querySelector('.theme-seg[data-color="pink"]').click(); return 1;`);
		await wait(250);
		s = await state(page);
		check("切粉色后只剩 pink 类", s.pink && !s.green && !s.black);
		check("切粉色后持久化", s.stored.join(",") === "dark,pink", s.stored.join(","));

		/* 黑配色的花按深浅分两张：切模式后必须换成另一张，不能继续挂缓存 */
		await load("/index.html", { theme: "light", "theme-color": "black" });
		const blackLightFlower = await flowerText(page);
		check("黑配色浅色花朵是墨线", /#17181c/i.test(blackLightFlower.text), blackLightFlower.text.slice(0, 60));
		const lightAvatar = await avatarStyle(page);
		check(
			"黑配色浅色头像用纯黑",
			lightAvatar.bg === "rgb(0, 0, 0)" && /flower\.p\.min\.svg/.test(lightAvatar.mask),
			`${lightAvatar.bg} ${lightAvatar.mask}`
		);
		await page.evaluate(`document.getElementById("theme-trigger").click(); return 1;`);
		await wait(200);
		await page.evaluate(`document.querySelector('.theme-seg[data-theme="dark"]').click(); return 1;`);
		await wait(300);
		const blackDarkFlower = await flowerText(page);
		check(
			"黑配色切深色后花朵换成白线稿",
			/#f5f6f7/i.test(blackDarkFlower.text) && !/#17181c/i.test(blackDarkFlower.text),
			blackDarkFlower.text.slice(0, 60)
		);
		const darkAvatar = await avatarStyle(page);
		check(
			"黑配色深色头像用纯白",
			darkAvatar.bg === "rgb(255, 255, 255)" && /flower\.p\.min\.svg/.test(darkAvatar.mask),
			`${darkAvatar.bg} ${darkAvatar.mask}`
		);

		await page.evaluate(`document.getElementById("theme-trigger").click(); document.body.click(); return 1;`);
		await wait(250);
		check("点空白处关闭", !(await state(page)).open);
		await page.evaluate(`document.getElementById("theme-trigger").click(); return 1;`);
		await wait(200);
		await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
		await wait(250);
		check("Esc 关闭", !(await state(page)).open);

		/* 4. 跟随系统 */
		await load("/index.html", { theme: "system", "theme-color": "blue" });
		await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
		await wait(300);
		check("system + 系统深色 → dark", (await state(page)).dark);
		await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
		await wait(300);
		check("系统切浅色 → 实时变浅", !(await state(page)).dark);

		/* 5. 右侧目录 hover 后展开，材质与 nav 一致 */
		await load("/index.html", { theme: "light", "theme-color": "green" });
		await page.send("DOM.enable");
		await page.send("CSS.enable");
		const doc = await page.send("DOM.getDocument", { depth: 1 });
		const node = await page.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: ".side-dots-rail" });
		await page.send("CSS.forcePseudoState", { nodeId: node.nodeId, forcedPseudoClasses: ["hover"] });
		await wait(450);
		const hov = await state(page);
		const width = await page.evaluate(`return Math.round(document.querySelector(".side-dots-rail").getBoundingClientRect().width);`);
		check("右侧目录 hover 展开到 174px", width === 174, width + "px");
		check("右侧目录 hover 底色与 nav 一致", hov.railBg === hov.navBg, hov.railBg + " vs " + hov.navBg);
		check("右侧目录 hover 模糊与 nav 一致", hov.railFilter === hov.navFilter, hov.railFilter);
		await page.send("CSS.forcePseudoState", { nodeId: node.nodeId, forcedPseudoClasses: [] });

		/* 6. 子页面没有主题面板，但配色/深色照样生效 */
		await load("/flower/index.html", { theme: "dark", "theme-color": "green" });
		s = await state(page);
		check("flower 子页套用深色绿", s.green && s.dark);
		check("flower 子页没有主题面板", s.panelBg === "no-panel");
		await load("/404.html", { theme: "light", "theme-color": "pink" });
		s = await state(page);
		check("404 套用浅色粉", s.pink && !s.dark);

		const realErrors = page.errors.filter((e) => !/cele-api\.pages\.dev|favicon\.ico|CORS policy|ERR_FAILED|status of 404/.test(e));
		check("页面无 JS 报错", realErrors.length === 0, realErrors.join(" | "));
	} finally {
		await page.close();
	}
}
