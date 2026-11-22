# 站点自检脚本

纯 Node 写的一组检查，零 npm 依赖，直接对着真实页面跑（自己起静态服务 + headless Chrome + CDP）。
目的是把「改完得手动点一遍」的东西固化下来：瀑布流布局、主题六套配色、毛玻璃一致性、菜单与折叠交互。

```bash
node tests/run.mjs                    # 全部
node tests/run.mjs --only theme       # 只跑某项，逗号分隔可多选
npm test                              # 等价于全部
```

全部通过退出码 0，有失败退出码 1（可以直接挂到 CI）。

## 需要什么

- Node 20+（用到了全局 `fetch` / `WebSocket`）
- 本机一个 Chrome 或 Chromium。查找顺序：
  1. `CHROME_PATH` 环境变量
  2. Playwright 的浏览器缓存（`npx playwright install chromium` 装的那个）
  3. 系统安装路径（Chrome / Edge / Chromium）
- 不需要联网：`cele-api.pages.dev` 的请求会被 CDP 拦下来喂 `fixtures/` 里的假数据

```bash
# 没装过浏览器时（CI 里也是这条）
npx playwright install --with-deps chromium
```

## 目录

| 文件 | 作用 |
| --- | --- |
| `run.mjs` | 入口：起环境、按顺序跑 `checks/` 下所有模块、汇总结果 |
| `lib/server.mjs` | 以仓库根为根的静态文件服务（随机端口） |
| `lib/chrome.mjs` | 找 Chrome 并以 headless + CDP 端口启动 |
| `lib/harness.mjs` | 页面封装：`load()` / `evaluate()` / `setViewport()` / `send()`，并 mock 留言与访问量接口 |
| `checks/guestbook.mjs` | 7 个宽度下的瀑布流不变量、时间倒序、昵称→头像预览、表单高度 |
| `checks/theme.mjs` | 默认值、6 套配色、meta theme-color、三处毛玻璃同款、花朵背景跟着配色生成、子页面 |
| `checks/interaction.mjs` | 主题面板开合（点击 / 空白 / Esc / Tab 移出）、`#story` 折叠、日期胶囊与圆点对齐 |
| `fixtures/*.json` | 留言接口的假数据 |

## 写新检查

在 `checks/` 里放一个模块，默认导出 `run({ env, check, wait })`：

```js
export const title = "我的检查";

export default async function run({ env, check, wait }) {
	const page = await env.openPage();
	try {
		await page.load("/index.html", { theme: "dark", "theme-color": "green" });
		check("深色绿生效", await page.evaluate(`return document.documentElement.classList.contains("dark");`));
	} finally {
		await page.close();
	}
}
```

`check(名字, 条件, 出错时的补充信息)`，条件为假就记一条失败，跑完统一汇总。
`page.evaluate()` 里可以直接写 `await`（内部包了一层 async），最后 `return` 值。

## 维护注意

- `checks/theme.mjs` 顶部的 `ACCENT` / `THEME_COLOR` / `FLOWER_ACCENT` 是 `css/base.css` 与 `js/theme.js` 里设计 token 的副本，改配色时要一起改。
- 背景花朵是运行时用 `flower/js/flower.js` 生成的 Blob（仓库里不再存这张 SVG），断言只校验「是 blob URL + 上了当前配色 + 301 段花瓣路径」，不比对像素。
- 断言尽量写「不变量」而不是像素值，避免一改样式就红。
