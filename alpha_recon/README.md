# alpha_recon — 灰度叠色反推（前景色 + Alpha）

根据两张图片，按以下流程逐像素反推原始前景灰度与 Alpha，并输出合成图：

```
1. 自动统一尺寸：高的大图等比缩放到小图高度（不变形），
   再对较宽图中心裁剪左右两端 -> 转灰度
   1_grey.png / 2_grey.png
2. 自动计算映射区间并映射   -> 1_grey_dark.png / 2_grey_light.png
3. 原算法直接反推前景色+alpha
4. 合成一张图片（黑底/白底呈现）-> reconstructed.png / side_by_side.png
```

**值域映射 + 自动 repair**（关键步骤）：把灰度分别映射到
`dark = g1*x/255 ∈ [0,x]` 与 `light = y + g2*(255-y)/255 ∈ [y,255]`，
其中 **x、y 由程序自动计算**（非用户参数），满足 `x+y=255` 且取满足自洽的
**最大 x / 最小 y**（压缩最少）：

```
自洽要求所有像素 c1>=c0；最坏情形 g1=g1_max、g2=g2_min：
x <= 255^2 / (255 - g2_min + g1_max)   →  最大 x 取该上界，y = 255-x
```

因此两张图动态范围越接近，自动 x 越大、压缩越少（内容一致且范围受限时可
`x>128`，优于固定 `[0,128]/[128,255]`）。`delta=255`（c0=0,c1=255）的像素为
合法透明像素（alpha=0）。有测试覆盖随机输入的自洽性与最大性。

## 用法

### Python 版（本地跑）
```bash
pip install pillow numpy
python main.py [图1] [图2] [输出目录]
# 省略参数时默认项目目录下 1.png 2.png；尺寸统一与 x,y 全自动，无需任何参数
# 自检（数学正确性测试）：
python tests/test_derive.py
```

### 网页版（纯前端，无依赖）
直接打开 `index.html`（或部署到 GitHub Pages 访问 `https://celeslime.github.io/alpha_recon/`）：
- 拖入/点击选择两张图（图1=叠黑观察、图2=叠白观察）
- 自动统一尺寸、计算映射、反推前景+Alpha
- 右侧预览可在 **棋盘格 / 黑底 / 白底** 间切换
- 点击“下载 reconstructed.png”导出带透明通道的 RGBA 图
- “⇄ 交换顺序”可一键交换两图角色（对应 `main.bat` 的反序调用）
- 无上传、全本地运算，隐私安全

> 网页版核心算法在 `js/core.js`，与 Python 版逐像素对拍通过（`tests/test_web_parity.py` + Node 校验）。

输出到 `images/`：

| 文件 | 内容 |
|---|---|
| `1_grey.png` / `2_grey.png` | 两张原图转灰度 |
| `1_grey_dark.png` / `2_grey_light.png` | 值域映射后的观察对（0-128 / 128-255） |
| `reconstructed.png` | 反推出的合成色前景 RGBA（RGB=前景灰度, A=alpha） |
| `side_by_side.png` | 合成的一张图：左半黑底呈现、右半白底呈现 |
| `verification.png` | 观察对 vs 反推模拟 四宫格对比 |
| `checkerboard_preview.png` | 棋盘格底预览，直观看到半透明 |

## 说明

- **自动 repair**：x、y 由程序按两张图自动计算（`x+y=255`、满足自洽的最大 x 最小 y），
  因此观察对天然自洽、直接反推，**不需要任何参数，也不做任何逐像素调整**。
- 内容相同时反推的 `fg` 有意义；内容不同时 `fg` 是两图内容的混合（无单一物理含义）。
- `derive.repair_pair(...)` 作为独立函数仍保留在 `derive.py`（tests 覆盖其数学行为），
  但 `main.py` 流程已完全不使用它。

## 数学原理

非预乘 alpha、8bit 灰度值域线性 over 混合：

```
c0 = round(fg * a)              # 叠黑
c1 = round(fg * a + 255(1-a))   # 叠白
=> a  = 1 - (c1-c0)/255
=> fg = c0 / a
```

## 正确性结论（tests/test_derive.py 验证）

1. ✅ **推导正确**：与用户原始 `calc_alpha_and_fg` 逐值对照 3000 例一致。
2. ✅ **输入空间穷举**：全部 32895 组合合法，1 组合（0,255）应报错 alpha=0。
3. ✅ **随机往返 20 万例**：反推结果再模拟叠黑/叠白，输出与原输入误差 ≤1（100% 保真）；信息充分像素（a≥0.1 且黑底非黑）fg 误差 ≤ 1.5/a+1。
4. ✅ **实际图验证**：合法像素上模拟输出与输入误差 ≤1 占 100%。

## 网页版对拍（tests/test_web_parity.py + web_parity_check.mjs）

- 运行 `python tests/test_web_parity.py`（需 Node.js）：生成随机向量 → 调用 Node 校验 JS 核心算法
- 覆盖：autoXY、applyMapping、derive、simulate、computeErrors、toGray（对齐 PIL）、planUnify
- 结果：**166/166 通过**，JS 与 Python 逐像素完全一致（含 banker's rounding 对齐）

## 发现的问题

- **浮点假阳性（已修复）**：原始实现中真实 fg 恰为 255 时（如输入 254,255），`255/（254/255）` 浮点算出 `255.00000000000003` 被误报"前景超界"。已加 `1e-9` 容差（数学上 fg≤255 恒成立：`fg=c0·255/(255-c1+c0) ≤ 255 ⟺ c1 ≤ 255`）。
- **低 alpha 区域 fg 不可靠（固有）**：a 很小时黑底输出仅 1~2 个灰度阶，fg=c0/a 的量化噪声被 1/a 放大（实测最大误差 ~48）。但**再合成输出始终 ≤1 保真**，即"重现输入"用途不受影响。
- **注释歧义**：原注释"线性over、sRGB线性计算"实际是对 8bit sRGB 值直接线性混合，未做 sRGB→linear gamma 解码；若真实合成发生在线性光空间需先解码，灰度场景影响小。

## 使用前提（重要）

自动 repair 使任何两张图都能反推出**自洽**结果（无矛盾、模拟误差 0），但只有
两张输入是 **同一前景内容分别叠纯黑、叠纯白** 的合成结果时，反推出的 `fg`
才具有"前景色"的物理含义；否则 `fg` 是两图内容的混合（无单一物理含义）。