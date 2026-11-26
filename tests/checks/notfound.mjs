/* 404 纠错提示：sitemap → 最近页面、路径前缀、目录提示；只提示不跳转。 */
export const title = "404 自动矫正";

export default async function run({ env, check, wait }) {
	const page = await env.openPage();

	const go = async (pathname, ms = 1200) => {
		await page.send("Page.navigate", { url: env.SITE + pathname });
		await wait(ms);
	};

	const state = () =>
		page.evaluate(`
			const box = document.getElementById("error_suggest");
			const link = box ? box.querySelector("a") : null;
			const err = document.getElementById("error_a");
			const main = document.querySelector(".error_box");
			return {
				path: location.pathname,
				suggest: box && !box.hidden ? box.textContent.trim() : "",
				href: link ? link.getAttribute("href") : null,
				display: main ? getComputedStyle(main).display : "no-page",
				err: err ? err.textContent : ""
			};
		`);

	try {
		/* 深层路径：样式必须仍然加载（404 的静态资源要用根路径） */
		await go("/syw/tpy");
		let s = await state();
		check("404 页在子路径下正常渲染", s.display === "flex", s.display);
		check("页面显示请求路径", s.err.includes("/syw/tpy"), s.err);
		check("提示最接近的目录", s.href === "/syw/", String(s.href));
		check("提示文案带目标", s.suggest.includes("/syw/"), s.suggest);

		/* 差太远就别猜 */
		await go("/zzzzzz");
		s = await state();
		check("差太远时不乱猜", !s.suggest, s.suggest);

		/* 只输了路径前半截：/alpha 应该提示 /alpha-recon/ */
		await go("/alpha");
		s = await state();
		check("路径前缀能匹配到完整页面", s.href === "/alpha-recon/", String(s.href));
		check("前缀提示文案自然", s.suggest.includes("你要找的可能是") && s.suggest.includes("/alpha-recon/"), s.suggest);
		check("前缀提示不自动跳转", s.path === "/alpha", s.path);

		/* 路径整体不对，但末端名字能对上：/recon → /alpha-recon/ */
		await go("/recon");
		s = await state();
		check("只写末端名字也能匹配", s.href === "/alpha-recon/", String(s.href));
		check("末端匹配提示文案自然", s.suggest.includes("/alpha-recon/"), s.suggest);

		/* 拼写错误：只给建议，等用户自己点 */
		await go("/univeres/");
		s = await state();
		check("拼写纠正给出目标", s.href === "/universe/", String(s.href));
		check("提示里没有倒计时", !/秒后自动跳转|已取消/.test(s.suggest), s.suggest);
		await wait(3300);
		s = await state();
		check("停留 3 秒也不会自动跳转", s.path === "/univeres/", s.path);

		/* 只差大小写：同样只提示。Windows 的文件系统不区分大小写，
		 * 本地自检时 /Timer/ 会直接命中 timer/index.html，所以这里先探测。 */
		const caseSensitive = !(await fetch(env.SITE + "/Timer/")).ok;
		if (caseSensitive) {
			await go("/Timer/");
			s = await state();
			check("大小写不同也给出建议", s.href === "/timer/", String(s.href));
			check("大小写建议不自动跳转", s.path === "/Timer/", s.path);
		} else {
			await go("/syw/tpy");
			const exact = await page.evaluate(`
				const hit = window.Cele404.pick("/Timer/", [{ href: "/timer/", path: "/timer" }]);
				return hit ? hit.score : 0;
			`);
			check("大小写差异计为几乎确定", exact >= 0.96, String(exact));
		}

		/* 已知目录里的错误子路径：提示回目录 */
		await go("/alpha-recon/guide");
		s = await state();
		check("目录下的错误子路径提示回目录", s.href === "/alpha-recon/", String(s.href));

		const realErrors = page.errors.filter((e) => !/status of 404|ERR_ABORTED|favicon\.ico/.test(e));
		check("404 页无 JS 报错", realErrors.length === 0, realErrors.join(" | "));
	} finally {
		await page.close();
	}
}
