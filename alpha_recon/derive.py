"""灰度过拟合反推：根据叠黑/叠白两个观察结果，反推原始前景色(fg)与 alpha。

理论公式（非预乘 alpha，8bit 灰度值域上的线性 over 混合）：
    c0   = round(fg * a)                              # 叠黑背景 (bg=0)
    c1   = round(fg * a + 255 * (1 - a))              # 叠白背景 (bg=255)
  => delta   = c1 - c0 = 255 * (1 - a)
  => a       = 1 - delta / 255
  => fg      = c0 / a            （a == 0 时 fg 无意义）

本模块同时提供：
  - derive_scalar() : 与用户原始代码逐行等价的单值版本（用于对照测试）
  - derive()        : numpy 向量化版本，逐像素处理整张灰度图
"""
from __future__ import annotations

import numpy as np

from PIL import Image


# ---------------------------------------------------------------------------
# 单值版本（等价于原始 calc_alpha_and_fg + verify，仅用于对照）
# ---------------------------------------------------------------------------
def derive_scalar(gray_black: int, gray_white: int) -> tuple[int, float, int]:
    """输入两个 0-255 灰度观察值，返回 (fg_byte, alpha_float, alpha_byte)。"""
    c0, c1 = int(gray_black), int(gray_white)
    delta = c1 - c0
    alpha_byte = 255 - delta
    if alpha_byte <= 0:
        raise ValueError("计算得到 alpha<=0（输入色差 >=255），输入颜色不合理")
    if alpha_byte > 255:
        raise ValueError("计算得到 alpha>255，输入颜色不合理（白底输出不应低于黑底输出）")
    alpha_float = alpha_byte / 255.0
    fg = c0 / alpha_float
    # 容差：真实值恰为 255 时，浮点除法可能得到 255.00000000000003，
    # 不加容差会误报"前景超界"（用户原实现的缺陷）。
    if fg > 255.0 + 1e-9:
        raise ValueError(f"原始前景灰度超出 0-255 范围：{fg}, 输入颜色不合法")
    fg_int = round(np.clip(fg, 0.0, 255.0))
    return fg_int, alpha_float, alpha_byte


def verify_scalar(fg: int, alpha_byte: int) -> tuple[int, int]:
    """用 (fg, alpha) 重新模拟叠黑、叠白输出（与原始 verify 等价）。"""
    a = alpha_byte / 255.0
    out_black = round(fg * a + 0 * (1 - a))
    out_white = round(fg * a + 255 * (1 - a))
    return out_black, out_white


# ---------------------------------------------------------------------------
# 向量化版本（逐像素处理灰度图）
# ---------------------------------------------------------------------------
def derive(gray_black: np.ndarray, gray_white: np.ndarray):
    """逐像素反推。

    参数: 两张相同尺寸的 0-255 uint8 灰度数组（叠黑观察、叠白观察）。
    返回: (fg, alpha_byte, valid)
        fg         : uint8 前景灰度（无效像素置 0）
        alpha_byte : uint8 alpha（无效像素置 0）
        valid      : bool 掩码，True=反推有效（0<=delta<=254 且 fg 在 0-255）
    """
    gb = gray_black.astype(np.float64)
    gw = gray_white.astype(np.float64)
    delta = gw - gb
    alpha_byte = 255.0 - delta

    valid = (alpha_byte > 0) & (alpha_byte <= 255)
    alpha_float = np.where(valid, alpha_byte / 255.0, 1.0)  # 无效处置 1 避免除零

    fg = np.where(valid, gb / alpha_float, 0.0)
    valid &= fg <= 255.0 + 1e-9      # fg 越界判无效（含浮点容差，见 derive_scalar）
    fg = np.clip(np.round(fg), 0, 255).astype(np.uint8)
    alpha_byte = np.clip(np.round(alpha_byte), 0, 255).astype(np.uint8)
    return fg, alpha_byte, valid


def simulate(fg: np.ndarray, alpha_byte: np.ndarray):
    """用反推结果模拟叠黑/叠白输出，返回两张 uint8 数组。"""
    a = alpha_byte.astype(np.float64) / 255.0
    f = fg.astype(np.float64)
    out_black = np.round(f * a)
    out_white = np.round(f * a + 255.0 * (1.0 - a))
    return out_black.astype(np.uint8), out_white.astype(np.uint8)


def to_gray(img: Image.Image) -> np.ndarray:
    """RGBA/RGB -> 灰度图 -> 0-255 uint8 ndarray。"""
    return np.asarray(img.convert("L"), dtype=np.uint8)


def center_crop(im: Image.Image, w: int, h: int) -> Image.Image:
    """从图像中心裁剪出 w x h 的区域（超出则取整幅）。"""
    w = min(w, im.width)
    h = min(h, im.height)
    left = (im.width - w) // 2
    top = (im.height - h) // 2
    return im.crop((left, top, left + w, top + h))


def resize_to_height(im: Image.Image, h: int) -> Image.Image:
    """等比缩放（不变形）到指定高度，宽度按比例取整。"""
    if im.height == h:
        return im
    w = max(1, round(im.width * h / im.height))
    return im.resize((w, h), Image.Resampling.LANCZOS)


def unify_size(im1: Image.Image, im2: Image.Image):
    """自动统一两张图尺寸：
    1) 高度大的图等比缩放到与小图高度一致（不变形，保留全部内容高度）
    2) 对宽度较宽的图中心裁剪左右两端，使宽度一致（保留中心内容）
    """
    h = min(im1.height, im2.height)
    im1 = resize_to_height(im1, h)
    im2 = resize_to_height(im2, h)
    w = min(im1.width, im2.width)
    return center_crop(im1, w, h), center_crop(im2, w, h)


def auto_xy(g1: np.ndarray, g2: np.ndarray) -> tuple[int, int]:
    """自动计算映射区间边界 x,y（x+y=255，满足自洽的最大 x / 最小 y）。

    推导：dark=g1*x/255, light=y+g2*(255-y)/255。自洽要求所有像素 c1>=c0，
    最坏情形 g1=g1_max、g2=g2_min。令 y=255-x 得：
      (255-x)*(255-g2_min) + 255*g2_min >= x*g1_max
      => 255^2 >= x*(255 - g2_min + g1_max)
      => x <= 255^2 / (255 - g2_min + g1_max)
    返回满足该界且取整后全图仍自洽的最大 x，以及 y=255-x。
    """
    g1_max = int(g1.max())
    g2_min = int(g2.min())
    denom = 255 - g2_min + g1_max
    x = min(255, (255 * 255) // denom) if denom > 0 else 255
    while x > 0:                        # 取整边界兜底：逐减直到全像素自洽
        y = 255 - x
        c0 = np.round(g1.astype(np.float64) * x / 255.0).astype(np.int64)
        c1 = np.round(y + g2.astype(np.float64) * (255 - y) / 255.0).astype(np.int64)
        if (c1 >= c0).all():
            return x, y
        x -= 1
    return 0, 255


# ---------------------------------------------------------------------------
# 可视化辅助
# ---------------------------------------------------------------------------
def fg_rgba_image(fg: np.ndarray, alpha_byte: np.ndarray) -> Image.Image:
    """把反推结果编码为一张带透明通道的 PNG（RGB=fg 灰度, A=alpha）。"""
    arr = np.stack([fg, fg, fg, alpha_byte], axis=-1)
    return Image.fromarray(arr, "RGBA")


def composite(fg: np.ndarray, alpha_byte: np.ndarray, bg: int) -> np.ndarray:
    """把 (fg, alpha) 合成到纯色背景 bg (0-255) 上，返回 uint8 灰度图。"""
    a = alpha_byte.astype(np.float64) / 255.0
    f = fg.astype(np.float64)
    out = np.round(f * a + bg * (1.0 - a)).clip(0, 255).astype(np.uint8)
    return out


# ---------------------------------------------------------------------------
# 加深/变浅修复：把两张灰度图拉进"合法观察对"区间 1 <= c1-c0 <= 254
# ---------------------------------------------------------------------------
def repair_pair(gb: np.ndarray, gw: np.ndarray, iterations: int = 3, anchor: str = "black"):
    """对两张灰度图分别加深(压暗 c0)/变浅(抬亮 c1)，使每像素满足
    0 <= c1 - c0 <= 254（可反推：delta=0 即不透明 fg=c0；delta>=255 会触发
    alpha<=0 报错，也需微调），总调整量最小。

    anchor 控制优先保哪一侧原图：
      "black"（默认）: 尽量不动叠黑图，只抬/压白图 -> 黑底呈现≈图1(误差<=1)
      "white"        : 尽量不动叠白图，只压/抬黑图 -> 白底呈现≈图2(误差<=1)
      "sym"          : 两侧对称各承担一半（旧行为）

    注意：该步骤只能修复"同一内容、亮度略有偏差"的输入；
    若两张图内容无关（如样例 r=-0.26），只能强制形式合法，
    反推结果无物理意义——调用方应在报告中说明。

    返回: (gb2, gw2, stats)  stats: 修改像素数/平均变动/残差矛盾数
    """
    b = gb.astype(np.int64)
    w = gw.astype(np.int64)
    for _ in range(iterations):
        d = w - b
        need_lo = (-d).clip(min=0)     # d<0（白底观察<黑底观察）：抬 c1 / 压 c0
        need_hi = (d - 254).clip(min=0)  # d>=255（alpha=0 无法反推）：压 c1 / 抬 c0
        if anchor == "black":
            up = np.minimum(need_lo, 255 - w)   # 优先抬亮白图，保黑图
            w = w + up
            b = b - (need_lo - up)              # 白图饱和(255)时兜底压黑图
            w = w - need_hi                     # delta 过大则压白图，黑图不动
        elif anchor == "white":
            down = np.minimum(need_lo, b)       # 优先压暗黑图，保白图
            b = b - down
            w = w + (need_lo - down)            # 黑图到 0 时兜底抬白图
            b = b + need_hi                     # delta 过大则抬黑图，白图不动
        else:  # sym：两侧对称
            up = (need_lo + 1) // 2
            down = need_lo - up
            w = w + up
            b = b - down
            up2 = need_hi // 2
            down2 = (need_hi + 1) // 2
            w = w - up2
            b = b + down2
        w = np.clip(w, 0, 255)
        b = np.clip(b, 0, 255)

    changed = np.count_nonzero((b != gb) | (w != gw))
    avg_move = float((np.abs(b - gb).sum() + np.abs(w - gw).sum()) / max(changed, 1))
    d2 = w - b
    residual = int(np.count_nonzero((d2 < 0) | (d2 > 254)))
    stats = dict(changed=changed, avg_move=avg_move, residual=residual)
    return b.astype(np.uint8), w.astype(np.uint8), stats