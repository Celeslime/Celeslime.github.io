## Cele's Blog

随心情写的代码，以 JS 为主的小应用，托管于 GitHub Pages。
蓝白配色取自头像（`#4696d2`），结构参考 didilili / krislinzhao / zotero-chinese。

### 🎓 词汇学习

- [高考英语词汇 · 3500](https://celeslime.github.io/3500/) — 5500 的旧版词库，未同步更新
- [考研英语词汇 · 5500](https://celeslime.github.io/5500/) — 考研 5500 词的查询、联想与朗读

### 🎮 游戏相关

- [原神面板计算器 · syw](https://celeslime.github.io/syw/) — 原神面板计算，早期算法探索（拉格朗日方程）
- [模拟城市计算器 · simcity](https://celeslime.github.io/simcity/) — 游戏模拟城市的辅助计算器，单纯形算法

### 🧸 玩具盒子

- [星球模拟 · universe](https://celeslime.github.io/universe/) — 万有引力下的星球运动模拟
- [计时器 · timer](https://celeslime.github.io/timer/) — 极简时钟，环形倒计时原型
- [花生成器 · flower](https://celeslime.github.io/flower/) — 极坐标曲线生成七瓣花朵，在线导出 SVG/PNG 头像；`flower/avatar.svg` 可接入自定义头像：`<iframe src="flower/avatar.svg?name=Alice" width="128" height="128"></iframe>`（简单）或引入 `flower/js/flower.js` 调 `FlowerGen.generateAvatar(name)`（JS，留言板同款）；用 `<img>` 引用时脚本不执行、不会出图
- [Alpha 反推 · alpha_recon](https://celeslime.github.io/alpha_recon/) — 灰度叠色反推前景灰度与透明通道

### 💡 未上线

- 3D char Render — 3D 字符渲染实验，整理旧 demo 中
- 对话树 — wordcloud 升级版，对话任务分类树

### 仓库结构

- 各应用均为独立仓库，通过 GitHub Actions 自动部署到本仓库对应的子路径；
  `index.html` 为聚合主页，纯静态 HTML/CSS/JS，无构建依赖。
- 样式按组件拆分为 `css/` 下的模块（`base/nav/hero/cards/story/...`），`css/main.css` 为 `@import` 聚合入口；
  子页（syw / flower / alpha_recon / universe）复用主页外壳模块，主题由主页的 `localStorage` 设置继承。
- 主页「📖 关于 · 来路」板块以时间线展示站点从 2020 年至今的来路。
