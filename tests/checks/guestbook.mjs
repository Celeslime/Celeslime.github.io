/* 留言板：瀑布流布局不变量 + 头像预览联动 + 表单高度。
 * 数据来自 fixtures/mock-comments.json（9 条，时间从新到旧）。 */
export const title = "留言板：瀑布流布局";

export default async function run({ env, check }) {
	const page = await env.openPage();
	try {
		await page.load("/index.html");
		await page.evaluate(`
			const s = document.createElement("style");
			s.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}";
			document.head.appendChild(s);
			return 1;
		`);

		const PROBE = `
			const list = document.getElementById("comment-list");
			const items = [...list.querySelectorAll(".gb-item")];
			const lb = list.getBoundingClientRect();
			const rects = items.map((el) => {
				const b = el.getBoundingClientRect();
				return { x: Math.round(b.left - lb.left), y: Math.round(b.top - lb.top), w: Math.round(b.width), h: Math.round(b.height) };
			});
			const overlaps = [];
			for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
				const a = rects[i], b = rects[j];
				const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
				const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
				if (ox > 1 && oy > 1) overlaps.push([i, j, ox, oy]);
			}
			return {
				n: items.length,
				cols: new Set(rects.map((r) => r.x)).size,
				overlaps,
				listH: Math.round(list.getBoundingClientRect().height),
				maxBottom: Math.max(...rects.map((r) => r.y + r.h)),
				first: rects[0],
				topRow: rects.filter((r) => r.y === 0).length,
				names: items.map((el) => el.querySelector(".gb-item-name").textContent.trim())
			};
		`;

		const expected = [
			[1280, 3],
			[1000, 3],
			[900, 3],
			[820, 3],
			[700, 2],
			[560, 2],
			[430, 1]
		];

		for (const [width, cols] of expected) {
			await page.setViewport(width);
			const r = await page.evaluate(PROBE);
			check(`w=${width} 渲染 9 条`, r.n === 9, String(r.n));
			check(`w=${width} 列数=${cols}`, r.cols === cols, String(r.cols));
			check(`w=${width} 卡片不重叠`, r.overlaps.length === 0, JSON.stringify(r.overlaps));
			check(`w=${width} 容器高度贴合最长列`, Math.abs(r.listH - r.maxBottom) <= 1, `${r.listH} vs ${r.maxBottom}`);
			check(`w=${width} 最新一条在左上角`, r.first.x === 0 && r.first.y === 0, `${r.first.x},${r.first.y}`);
			if (cols > 1) check(`w=${width} 顶部横排 ${cols} 条（阅读顺序横着走）`, r.topRow === cols, String(r.topRow));
		}

		check("DOM 顺序仍是时间倒序", await page.evaluate(`
			const items = [...document.querySelectorAll("#comment-list .gb-item")];
			const times = items.map((el) => el.querySelector(".gb-item-time").textContent.trim());
			return times.every((t, i) => i === 0 || times[i - 1] >= t);
		`));

		/* 昵称输入 → 头像预览实时换图 */
		const preview = await page.evaluate(`
			const name = document.getElementById("gb-name");
			const box = document.getElementById("gb-avatar-preview");
			const before = box.querySelector("img")?.src || "";
			const beforeEmpty = box.classList.contains("is-empty");
			name.value = "小樱";
			name.dispatchEvent(new Event("input", { bubbles: true }));
			await new Promise((r) => setTimeout(r, 260));
			const after = box.querySelector("img")?.src || "";
			const afterEmpty = box.classList.contains("is-empty");
			name.value = "";
			name.dispatchEvent(new Event("input", { bubbles: true }));
			await new Promise((r) => setTimeout(r, 260));
			return { before, beforeEmpty, after, afterEmpty, restored: box.classList.contains("is-empty") };
		`);
		check("空昵称时预览是匿名花朵（.is-empty）", preview.beforeEmpty && !!preview.before);
		check("输入昵称后预览换图", !!preview.after && preview.after !== preview.before);
		check("输入昵称后去掉 .is-empty", !preview.afterEmpty);
		check("清空昵称后回到匿名态", preview.restored);

		/* 表单高度：横向 900px 时应该比卡片矮、又不至于挤压 */
		await page.setViewport(1280);
		const formH = await page.evaluate(`return Math.round(document.getElementById("comment-form").getBoundingClientRect().height);`);
		check("表单高度在 140–200px 之间", formH >= 140 && formH <= 200, formH + "px");

		check("页面无 JS 报错", page.errors.length === 0, page.errors.join(" | "));
	} finally {
		await page.close();
	}
}
