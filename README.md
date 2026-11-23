# Cele 的小站

一个纯静态的个人主页，外加一堆自己写着玩的小工具入口：**没有构建步骤、没有运行时依赖、没有框架**，
改完文件直接推上 GitHub Pages 就是线上版本。

- 线上：<https://celeslime.github.io>
- 主题：浅色 / 深色 / 跟随系统 × 海盐蓝 / 青提绿 / 玫瑰粉
- 自检：`node tests/run.mjs`（零依赖，真浏览器跑 150+ 条断言）

## 目录

```
.
├── index.html            主页（欢迎、小应用卡片、关于时间线、留言板）
├── 404.html              404（复用主页样式）
├── css/                  main.css 用 @import 聚合的组件样式
│   ├── base.css            设计 token（强调色 / 中性色 / 派生值三层）与全局 reset
│   ├── page.css            页面底色 + 花朵纹理
│   ├── nav.css theme.css side-dots.css   三处悬浮容器的毛玻璃材质
│   └── …                   hero / cards / story / guestbook / footer / controls / responsive
├── js/
│   ├── theme.js            主题状态（唯一的真相来源）+ 背景花朵的生成
│   ├── main.js             导航、滚动、侧边目录、主题菜单 UI、时间线折叠
│   └── guestbook.js        留言板、访问统计、AI 回复展示
├── flower/               花朵生成器（独立页面 + FlowerGen 库 + avatar.svg iframe）
├── syw/ universe/ alpha_recon/ timer/    各小应用的静态产物
├── creepy-monitor/       油猴脚本「隔墙有耳」的介绍页（脚本本身在另一个仓库）
├── images/               favicon 与 logo 用的单色 mask 花
├── tests/                零依赖的自检脚本（见下）
└── .github/workflows/    推送到 master 后自动跑自检
```

## 设计上的几条约束

1. **无构建**：所有文件都是最终产物，浏览器直接读；改动即上线。
2. **样式按组件拆**：`css/main.css` 只是一串 `@import`，每个文件负责一块 UI；子页（flower / syw / universe / alpha_recon / creepy-monitor）复用同一套外壳。
3. **颜色只走 token**：任何颜色都不写死在组件里，全部来自 `css/base.css` 的 `--accent*` / `--bg` / `--card` / `--border` / `--text*`，所以加一套配色只需要加一个 `html.<color>` 变量块。
4. **JS 不设框架**：三个 IIFE 模块，按 `<script>` 顺序加载，`window.CeleTheme` 是唯一的跨模块接口。

## 主题系统

### 状态

`js/theme.js` 是唯一真相来源，状态存在 `localStorage`：

| key | 取值 | 说明 |
| --- | --- | --- |
| `theme` | `light` / `dark` / `system` | 模式，`system` 跟随 `prefers-color-scheme` |
| `theme-color` | `blue` / `green` / `pink` | 配色 |

它把状态同时写到 DOM 上：`html.dark` / `html.green` / `html.pink` 三个类负责样式，
`data-mode` / `data-color` 供脚本和测试读取，并顺手更新 `<meta name="theme-color">`（移动端状态栏颜色）。

对外接口是 `window.CeleTheme`：

```js
CeleTheme.mode;            // 当前模式
CeleTheme.color;           // 当前配色
CeleTheme.isDark();        // 解析后的结果（system 会跟随系统）
CeleTheme.setMode("dark");
CeleTheme.setColor("green");
CeleTheme.onChange(fn);    // 返回取消订阅的函数
```

### 防闪烁

每个页面的 `<head>` 里先同步加载 `js/theme.js`，它在解析阶段就把 class 打到 `<html>` 上，
因此不会出现"先白一下再变深色"。子页只引用同一个文件，配色跟随主页设置。

### 变量分层

`css/base.css` 里每套配色只有六块（`:root` 蓝浅、`html.green`、`html.pink`、`html.dark`、`html.dark.green`、`html.dark.pink`）：

- **强调色**：`--accent` / `--accent-dark` / `--accent-deep` / `--accent-light` / `--accent-soft` / `--accent-rgb`
- **中性色**：`--bg` / `--bg-rgb` / `--card` / `--border` / `--text` / `--text-strong`
- **派生值**：`--shadow-out` / `--shadow-hover` / `--nav-bg` / `--glass-*`

`--accent-light`、`--accent-dark` 这类"浅底 + 同级深字"的组合是按对比度挑的（徽章、日期胶囊等），
三套配色的 L\* 与对比度都刻意对齐过，换配色不会出现某套看不清的情况。

### 毛玻璃

导航栏、主题面板、右侧目录三处悬浮容器共用同一套材质变量：

```css
--glass-bg: …;      /* 与 --nav-bg 相同 */
--glass-blur: …;    /* blur(10px) */
--glass-border: …;  /* 与 --border 相同 */
```

注意 `.nav` 自身的 `backdrop-filter` 要挂在 `.nav::before` 上：如果放在 `.nav` 上，
它就会变成后代元素的 *backdrop root*，里面主题面板的模糊只能采到导航条自己，看起来像半透明色块。

背景花朵不存图片：`js/theme.js` 调用 `flower/js/flower.js`（留言板头像用的同一个生成器）在运行时
按当前 accent 画一张 2048px 的 SVG，做成 Blob URL 写进 `--flower-img`。
主页本来就加载了那个文件，所以这部分**零额外字节**——早先三份各 62KB 的换色 SVG 已经删掉。

## 留言板

展示在一个三列瀑布流里（JS 绝对定位 + 最短列优先，保证最新的留言在左上角），每 30 秒轮询一次。

数据来自 Cloudflare Pages Functions 写的 [`cele-api`](https://cele-api.pages.dev)：

| 接口 | 用途 |
| --- | --- |
| `GET /api/comments` | 拉留言列表 |
| `POST /api/comments` | 发留言，返回后由 worker 异步写 AI 回复 |
| `POST /api/stats?path=…` | 访问计数 |

`js/guestbook.js` 里有一份允许的主机名清单（正式站 + `localhost` / `127.0.0.1` / 局域网 IP），
所以用 Live Server 在本地预览也能正常读、发留言；API 侧的 CORS 同样放行 `http://localhost:*` 与 `http://127.0.0.1:*`。
不在清单里的来源会静默禁用留言板，不会乱发请求。

## 花朵生成器

`flower/js/flower.js` 是一个 UMD 模块（浏览器挂 `window.FlowerGen`，node 里 `require` 也能用），
用极坐标曲线 `r = 2/(2π)·θ·k` 画花瓣：

```js
FlowerGen.generate({ size: 2048, petals: 7, color: "#4696d2" });  // → SVG 字符串
FlowerGen.generateAvatar("Cele", { size: 64 });                   // → data URL，留言板头像
FlowerGen.seedParams("Cele");                                     // 名字 → 稳定参数
```

同一份代码被用在三个地方：主页背景的大花、留言板的头像、`flower/` 页面的在线编辑器。
`flower/avatar.svg?name=Alice` 则是一个 iframe 版封装（`<img>` 引用不会执行脚本，必须是 iframe）。

## 自检

`tests/` 是一组零依赖的真浏览器检查：自带一个静态服务器、通过 CDP 驱动系统里的 Chromium
（找不到就自动去 Playwright 的下载缓存里翻），并把留言接口 mock 掉。

```bash
node tests/run.mjs                 # 全部
node tests/run.mjs --only theme    # 只跑某一组
npm test                           # 同上
CHROME_PATH=/path/to/chrome node tests/run.mjs   # 指定浏览器
```

覆盖范围：

| 模块 | 内容 |
| --- | --- |
| `guestbook` | 7 个宽度下的列数、卡片不重叠、最新在左上、DOM 顺序、昵称→头像预览 |
| `theme` | 六套配色的类 / 属性 / 选中态 / meta / 持久化、毛玻璃一致性、右键目录展开、菜单交互、子页继承、花朵生成 |
| `interaction` | 菜单开合与 Esc / Tab 移出、时间线折叠、日期与圆点对齐 |

推送 master 后 `.github/workflows/checks.yml` 会在 CI 里再跑一遍。

## 本地预览

任意静态服务器都行（不要用 `file://`，花朵生成与留言板依赖正常的 origin）：

```bash
python -m http.server 5500
# 或 npx serve .
```

## 部署

推送到 `master` 即由 GitHub Pages 直接发布；各小应用是独立仓库，通过各自的 Actions 部署到本仓库的子路径。
占位文件（`google*.html`、`ByteDanceVerify.html`、`robots.txt`、`sitemap.xml`）用于站点验证与收录，勿删。
