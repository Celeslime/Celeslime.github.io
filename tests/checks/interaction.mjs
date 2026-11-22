/* 交互：主题面板开合（点击 / 空白 / Esc / 键盘 Tab 移出 / 导航链接）与"关于 · 来路"折叠。 */
export const title = "开合与折叠交互";

export default async function run({ env, check, wait }) {
	const page = await env.openPage();
	const isOpen = () => page.evaluate(`return document.getElementById("theme-menu").classList.contains("open");`);

	try {
		await page.load("/index.html", { theme: "light", "theme-color": "green" });

		/* 主题面板 */
		const beforeH = await page.evaluate(`return document.body.scrollHeight;`);
		await page.evaluate(`document.getElementById("theme-trigger").click(); return 1;`);
		await wait(200);
		check("第一次点击打开", await isOpen());
		await page.evaluate(`document.getElementById("theme-trigger").click(); return 1;`);
		await wait(200);
		check("第二次点击收起", !(await isOpen()));
		const afterH = await page.evaluate(`return document.body.scrollHeight;`);
		check("开合不改变页面高度", Math.abs(beforeH - afterH) <= 2, `${beforeH} vs ${afterH}`);

		await page.evaluate(`document.getElementById("theme-trigger").click(); return 1;`);
		await wait(200);
		await page.evaluate(`document.querySelector('.nav-links a[href="#domains"]').click(); return 1;`);
		await wait(400);
		check("点导航链接后收起", !(await isOpen()));

		/* 键盘：用真实 Tab 把焦点移出菜单（程序化 .focus() 在无窗口焦点时不触发 focusout） */
		await page.send("Page.bringToFront");
		await wait(150);
		await page.evaluate(`
			document.getElementById("theme-trigger").focus();
			document.getElementById("theme-trigger").click();
			return 1;
		`);
		await wait(220);
		check("键盘打开菜单", await isOpen());
		let leftAt = 0;
		for (let i = 1; i <= 9; i++) {
			await page.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
			await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
			await wait(150);
			const inside = await page.evaluate(`return document.getElementById("theme-menu").contains(document.activeElement);`);
			if (!inside) {
				leftAt = i;
				break;
			}
		}
		check("Tab 移出菜单后收起", leftAt > 1 && !(await isOpen()), `第 ${leftAt} 次 Tab 离开`);

		/* “关于 · 来路”折叠 */
		const story = () =>
			page.evaluate(`
				const list = document.getElementById("story-timeline");
				const items = [...list.children];
				const visible = items.filter((el) => getComputedStyle(el).display !== "none").length;
				const btn = document.getElementById("story-toggle");
				return {
					collapsed: list.classList.contains("is-collapsed"),
					height: Math.round(list.getBoundingClientRect().height),
					items: items.length,
					visible,
					label: btn ? btn.textContent.trim() : "no-button",
					expanded: btn ? btn.getAttribute("aria-expanded") : null,
					inFirstItem: btn ? items[0].contains(btn) : false
				};
			`);

		let st = await story();
		check("默认折叠", st.collapsed && st.expanded === "false");
		check("折叠时只显示第一个 li（前言不受影响）", st.visible === 1, `${st.visible}/${st.items}`);
		check("折叠开关在第一个 li 里", st.inFirstItem);
		check("折叠按钮文案含「展开」", st.label.indexOf("展开") === 0, st.label);
		check("折叠后高度很小", st.height < 200, st.height + "px");

		await page.evaluate(`document.getElementById("story-toggle").click(); return 1;`);
		await wait(300);
		st = await story();
		check("展开后显示全部 li", st.visible === st.items, `${st.visible}/${st.items}`);
		check("展开后按钮文案含「收起」", st.label.indexOf("收起") === 0, st.label);
		check("展开后 aria-expanded=true", st.expanded === "true");
		check("展开后高度明显变大", st.height > 600, st.height + "px");

		await page.evaluate(`document.getElementById("story-toggle").click(); return 1;`);
		await wait(300);
		st = await story();
		check("再点回到折叠", st.collapsed && st.visible === 1);

		/* 日期胶囊与圆点横向对齐（圆点 margin-top 4 + 10px 高 → 圆心 li.top+9） */
		const delta = await page.evaluate(`
			document.getElementById("story-toggle").click();
			await new Promise((r) => setTimeout(r, 300));
			const li = document.querySelectorAll("#story-timeline > li")[1];
			const dot = getComputedStyle(li, "::before");
			const dotTop = li.getBoundingClientRect().top + parseFloat(dot.marginTop) + parseFloat(dot.height) / 2;
			const date = li.querySelector(".tl-date").getBoundingClientRect();
			return Math.round((date.top + date.height / 2 - dotTop) * 10) / 10;
		`);
		check("日期胶囊中心与圆点中心对齐", Math.abs(delta) <= 0.6, delta + "px");

		const realErrors = page.errors.filter((e) => !/cele-api\.pages\.dev|favicon\.ico|CORS policy|ERR_FAILED|status of 404/.test(e));
		check("页面无 JS 报错", realErrors.length === 0, realErrors.join(" | "));
	} finally {
		await page.close();
	}
}
