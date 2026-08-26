"""入口：两张图片 -> 自动统一尺寸(中心裁剪 min 高宽) -> 转灰度 -> 自动 repair -> 原算法直接反推合成

流程：
  1. 自动统一尺寸：取两张图 min(高)、min(宽)，各自从中心裁剪 -> 转灰度
     1_grey.png / 2_grey.png
  2. 自动计算映射区间并映射（真正的 repair 逻辑）：
       1_grey_dark  = g1 映射到 [0, x]    （叠黑观察 c0）
       2_grey_light = g2 映射到 [y, 255]  （叠白观察 c1）
       其中 x+y=255，取满足自洽的最大 x / 最小 y：
         x = floor(255^2 / (255 - g2_min + g1_max))，y = 255-x
     -> 1_grey_dark.png / 2_grey_light.png
  3. 原算法反推前景色+alpha（不做任何逐像素调整）
  4. 合成 reconstructed.png（前景 RGBA）+ side_by_side.png（黑底/白底呈现）

用法: python main.py [图1] [图2] [输出目录]
  x、y 与裁剪尺寸均由程序自动计算，无需用户指定。
"""
import sys
import os
from PIL import Image, ImageDraw, ImageFont
import numpy as np

from derive import to_gray, derive, simulate, composite, fg_rgba_image, auto_xy, unify_size


def _font(size: int):
    for p in (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\arial.ttf"):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


def labeled_tile(img: Image.Image, label: str, bg: int):
    rgb = Image.merge("RGB", (img, img, img))
    canvas = Image.new("RGB", (img.width, img.height + 20), (bg, bg, bg))
    canvas.paste(rgb, (0, 20))
    d = ImageDraw.Draw(canvas)
    d.text((4, 2), label, fill=(255 - bg, 255 - bg, 255 - bg), font=_font(14))
    return canvas


def main():
    args = sys.argv[1:]
    _base = os.path.dirname(os.path.abspath(__file__))
    if len(args) >= 2:
        p1, p2 = args[0], args[1]
    else:
        p1, p2 = os.path.join(_base, "1.png"), os.path.join(_base, "2.png")
    out_dir = args[2] if len(args) >= 3 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "images")
    os.makedirs(out_dir, exist_ok=True)

    # ---- 1) 自动统一尺寸（取两张图中心部分的 min 高宽）并转灰度 ----
    im1 = Image.open(p1)
    im2 = Image.open(p2)
    raw1, raw2 = im1.size, im2.size
    im1, im2 = unify_size(im1, im2)          # 各自中心裁剪到 (min_w, min_h)
    print(f"== 1/3 尺寸统一: {raw1} & {raw2} -> 中心裁剪 {im1.size} ==")
    g1 = to_gray(im1)
    g2 = to_gray(im2)
    Image.fromarray(g1).save(os.path.join(out_dir, "1_grey.png"))
    Image.fromarray(g2).save(os.path.join(out_dir, "2_grey.png"))
    print(f"  转灰度 -> 1_grey.png / 2_grey.png")

    # ---- 2) 自动计算 x,y 并映射（真正的 repair） ----
    x, y = auto_xy(g1, g2)
    g1d = np.round(g1.astype(np.float64) * x / 255.0).astype(np.uint8)          # [0,x]
    g2l = np.round(y + g2.astype(np.float64) * (255 - y) / 255.0).astype(np.uint8)  # [y,255]
    Image.fromarray(g1d).save(os.path.join(out_dir, "1_grey_dark.png"))
    Image.fromarray(g2l).save(os.path.join(out_dir, "2_grey_light.png"))
    print(f"== 2/3 自动 repair: g1_max={int(g1.max())}, g2_min={int(g2.min())} ==")
    print(f"  映射区间: dark->[0,{x}]  light->[{y},255]  (x+y={x+y})")
    print(f"  实际范围: dark {g1d.min()}~{g1d.max()}, light {g2l.min()}~{g2l.max()}")

    d = g2l.astype(int) - g1d.astype(int)
    assert (d >= 0).all() and (d <= 255).all(), "自动 x,y 未满足自洽（不应发生）"

    # ---- 3) 原算法直接反推 ----
    fg, ab, valid = derive(g1d, g2l)
    sim_b, sim_w = simulate(fg, ab)
    H, W = fg.shape
    n_invalid = int((~valid).sum())
    err_b = np.abs(sim_b.astype(int) - g1d.astype(int)).max()
    err_w = np.abs(sim_w.astype(int) - g2l.astype(int)).max()
    print(f"== 3/3 反推 + 合成 ==")
    print(f"反推前景灰度: {fg.min()}~{fg.max()}, alpha: {ab.min()}~{ab.max()}, "
          f"半透明(alpha<255) {100*(ab<255).mean():.1f}%")
    print(f"无效像素: {n_invalid} ({100*n_invalid/(H*W):.2f}%) | "
          f"模拟叠黑/叠白与观察对最大差: {err_b}/{err_w}")

    rgba = fg_rgba_image(fg, ab)
    rgba.save(os.path.join(out_dir, "reconstructed.png"))

    check = Image.new("RGB", (W, H))
    px = check.load()
    for y in range(H):
        for x in range(W):
            c = 200 if ((x // 8 + y // 8) % 2 == 0) else 235
            px[x, y] = (c, c, c)
    check.paste(rgba, (0, 0), rgba)
    ImageDraw.Draw(check).text((2, 2), "棋盘格预览(透明可见)", fill=(255, 0, 0), font=_font(14))
    check.save(os.path.join(out_dir, "checkerboard_preview.png"))

    side = Image.new("RGB", (W * 2 + 3, H), (128, 128, 128))
    side.paste(Image.merge("RGB", [Image.fromarray(composite(fg, ab, 0))] * 3), (0, 0))
    side.paste(Image.merge("RGB", [Image.fromarray(composite(fg, ab, 255))] * 3), (W + 3, 0))
    labeled = Image.new("RGB", (W * 2 + 3, H + 20), (128, 128, 128))
    labeled.paste(side, (0, 20))
    d = ImageDraw.Draw(labeled)
    d.text((4, 2), "黑底呈现", fill=(255, 255, 255), font=_font(16))
    d.text((W + 7, 2), "白底呈现", fill=(0, 0, 0), font=_font(16))
    labeled.save(os.path.join(out_dir, "side_by_side.png"))

    tiles = [
        labeled_tile(Image.fromarray(g1d), "叠黑观察(1_grey_dark)", 0),
        labeled_tile(Image.fromarray(g2l), "叠白观察(2_grey_light)", 255),
        labeled_tile(Image.fromarray(sim_b), "反推模拟:叠黑", 0),
        labeled_tile(Image.fromarray(sim_w), "反推模拟:叠白", 255),
    ]
    tw, th = tiles[0].width, tiles[0].height
    grid = Image.new("RGB", (tw * 2, th * 2), (128, 128, 128))
    grid.paste(tiles[0], (0, 0)); grid.paste(tiles[1], (tw, 0))
    grid.paste(tiles[2], (0, th)); grid.paste(tiles[3], (tw, th))
    grid.save(os.path.join(out_dir, "verification.png"))

    print(f"输出目录: {out_dir}")
    print("  reconstructed.png(合成色前景) / side_by_side.png(黑白底呈现) / verification.png / checkerboard_preview.png")


if __name__ == "__main__":
    main()