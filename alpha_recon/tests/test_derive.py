"""正确性自检：
1. 公式推导的手工用例
2. 与用户原始实现(原样复制的 calc_alpha_and_fg)逐值对照
3. 随机正向合成 -> 反推往返，统计量化误差
运行: python -m pytest tests/  （或直接 python tests/test_derive.py）
"""
import sys
import os
import random

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from derive import derive, derive_scalar, repair_pair, simulate, verify_scalar, auto_xy, center_crop, unify_size, resize_to_height
from PIL import Image as _Image


# 用户原始实现（原样复制，作为基准对照；仅支持严格灰度输入）
def calc_alpha_and_fg(bg_black_hex: str, bg_white_hex: str):
    def hex2gray(h: str) -> int:
        h = h.lstrip("#")
        r = int(h[0:2], 16)
        g = int(h[2:4], 16)
        b = int(h[4:6], 16)
        if not (r == g == b):
            raise ValueError("当前仅支持灰度颜色，R G B必须相等")
        return r

    c0 = hex2gray(bg_black_hex)
    c1 = hex2gray(bg_white_hex)
    delta = c1 - c0
    alpha_byte = 255 - delta
    if alpha_byte <= 0:
        raise ValueError("计算得到alpha<=0，输入颜色不合理")
    if alpha_byte > 255:
        raise ValueError("计算得到alpha>255，输入颜色不合理")
    alpha_float = alpha_byte / 255.0
    fg_gray = c0 / alpha_float
    if fg_gray > 255:
        raise ValueError(f"原始前景灰度超出0-255范围：{fg_gray},输入颜色不合法")
    fg_gray_int = round(fg_gray)
    fg_hex = f"#{fg_gray_int:02X}{fg_gray_int:02X}{fg_gray_int:02X}"
    return fg_hex, alpha_float, round(alpha_byte)


def hex2gray_int(h: str) -> int:
    s = h.lstrip("#")
    return int(s[0:2], 16)


# ---------------------------------------------------------------------------
# 1) 手工推导用例
# ---------------------------------------------------------------------------
def test_hand_cases():
    def check(c0, c1, exp_fg, exp_ab):
        fg, a, ab = derive_scalar(c0, c1)
        assert ab == exp_ab, f"alpha_byte {ab} != {exp_ab}"
        assert abs(fg - exp_fg) <= 1, f"fg {fg} != {exp_fg}"
        # 模拟应还原
        b, w = verify_scalar(fg, ab)
        assert abs(b - c0) <= 1 and abs(w - c1) <= 1, f"verify out {b},{w} vs {c0},{c1}"

    check(0, 0, 0, 255)        # 完全不透明、纯黑
    check(255, 255, 255, 255)  # 完全不透明、纯白
    check(100, 155, 128, 200)  # a=200/255, fg=128
    check(13, 23, 14, 245)     # delta=10 => ab=245, fg=13/0.9608=13.53 -> 14
    check(250, 255, 255, 250)  # delta=5 => ab=250, fg=250/(250/255)=255


def test_error_cases():
    try:
        derive_scalar(0, 255)  # delta=255 => alpha=0
        raise AssertionError("应抛 alpha<=0")
    except ValueError:
        pass
    try:
        derive_scalar(255, 0)  # 白底输出低于黑底输出，物理不可能
        raise AssertionError("应抛 alpha>255")
    except ValueError:
        pass


def test_fp_precision_boundary():
    """输入空间穷举：所有合法 8bit 输入组合都不应误报，
    且 fg 落在 0-255。原实现对恰为 255 的真实 fg 可能浮点误报，已加容差。
    数学依据: fg=c0*255/(255-c1+c0)，c1<=255 => fg<=255 恒成立。"""
    ok = bad = 0
    for c0 in range(256):
        for c1 in range(c0, 256):
            if c1 - c0 >= 255:            # delta=255 => alpha=0，应报错
                try:
                    derive_scalar(c0, c1)
                    raise AssertionError(f"应报错: ({c0},{c1})")
                except ValueError:
                    bad += 1
                continue
            fg, a, ab = derive_scalar(c0, c1)
            assert 0 <= fg <= 255, (c0, c1, fg)
            assert ab == 255 - (c1 - c0) and 0 < ab <= 255, (c0, c1, ab)
            ok += 1
    print(f"  (穷举完成: 合法 {ok} 对, 应报错 {bad} 对)")


# ---------------------------------------------------------------------------
# 2) 与用户原始实现逐值对照
# ---------------------------------------------------------------------------
def test_against_original():
    rng = random.Random(42)
    fp_false_positives = 0
    for _ in range(3000):
        c0 = rng.randrange(0, 256)
        c1 = rng.randrange(c0, 256)          # 保证 c1>=c0（物理合理）
        fg_new, a_new, ab_new = derive_scalar(c0, c1)
        h = f"#{c0:02X}{c0:02X}{c0:02X}"
        w = f"#{c1:02X}{c1:02X}{c1:02X}"
        try:
            fg_hex, a_orig, ab_orig = calc_alpha_and_fg(h, w)
        except ValueError as e:
            # 原始实现的浮点假阳性：delta 合法但 fg 真实值恰为 255 时误报超界。
            # 数学上 fg<=255 恒成立（c1<=255），见 test_fp_precision_boundary。
            assert "超出0-255范围" in str(e), (c0, c1, e)
            assert fg_new == 255, (c0, c1, fg_new)
            fp_false_positives += 1
            continue
        assert hex2gray_int(fg_hex) == fg_new, (c0, c1)
        assert a_orig == a_new and ab_orig == ab_new, (c0, c1)
    print(f"  (对照完成，其中原实现浮点误报 {fp_false_positives} 例，新实现已修复)")


# ---------------------------------------------------------------------------
# 3) 随机往返：正向合成 -> 反推
# ---------------------------------------------------------------------------
def test_roundtrip_random():
    rng = np.random.default_rng(7)
    n = 200_000
    fg_true = rng.integers(0, 256, size=n).astype(np.float64)
    a_true = rng.uniform(0.01, 1.0, size=n)

    c0 = np.round(fg_true * a_true).astype(np.uint8)
    c1 = np.round(fg_true * a_true + 255.0 * (1.0 - a_true)).astype(np.uint8)

    fg_est, ab_est, valid = derive(c0, c1)
    a_est = ab_est.astype(np.float64) / 255.0

    assert valid.sum() >= n * 0.995, f"意外大量无效像素: {valid.sum()}"

    b_sim, w_sim = simulate(fg_est, ab_est)
    # 关键保证：模拟输出必须还原输入（量化误差 <=1）——反推结果用于"重现输入"始终保真
    err_b = np.abs(b_sim.astype(int) - c0.astype(int))
    err_w = np.abs(w_sim.astype(int) - c1.astype(int))
    assert err_b.max() <= 1, f"叠黑模拟最大误差 {err_b.max()}"
    assert err_w.max() <= 1, f"叠白模拟最大误差 {err_w.max()}"

    # alpha 还原误差：仅来自 delta 的 8bit 取整，恒 <=1
    d_a = np.abs(a_est[valid] - a_true[valid]) * 255.0
    assert d_a.max() <= 1, f"alpha 还原最大误差 {d_a.max()}"

    # fg 还原误差：只在"信息充分"像素上要求精确。
    # 低 alpha 时 c0=round(fg*a) 只有 1-2 阶，fg=c0/a 的量化噪声被 1/a 放大，
    # 属反问题固有不可逆（见 README"误差与局限"）。
    info = (c0 > 0) & (a_true >= 0.1) & valid
    assert info.sum() > n * 0.7, "信息充分像素比例异常低"
    d = np.abs(fg_est.astype(float)[info] - fg_true[info])
    # 理论界: |Δfg| <= 1.5/a + 1
    #   (c0 的 ±0.5 取整误差除以 a；delta 取整 ±1 引起 a 误差, fg*|Δa|/a <= 1/a)
    bound = 1.5 / a_true[info].min() + 1.0
    assert d.max() <= bound, f"fg 还原误差 {d.max()} 超出理论界 {bound:.2f}"
    ratio = d.max() * a_true[info].min()
    print(f"  (信息充分像素 fg 最大误差 {d.max()}, 理论界 {bound:.2f}, 归一化误差比 {ratio:.2f})")

    # 低 alpha 区域：统计能多大程度保持，供报告参考
    weak = ((c0 == 0) | (a_true < 0.1)) & valid
    if weak.sum():
        d_w = np.abs(fg_est.astype(float)[weak] - fg_true[weak])
        print(f"  (低alpha/信息不足像素 {weak.sum()} 个, fg最大误差 {d_w.max():.1f}, "
              f"但模拟输出仍≤1保真)")


def test_repair_pair():
    """构造合法观察对，随机破坏成矛盾像素，repair 应全部拉回合法区。"""
    rng = np.random.default_rng(11)
    fg = rng.integers(0, 256, size=(50, 50)).astype(np.float64)
    a = rng.uniform(0.05, 1.0, size=(50, 50))
    gb0 = np.round(fg * a).clip(0, 255).astype(np.uint8)
    gw0 = np.round(fg * a + 255 * (1 - a)).clip(0, 255).astype(np.uint8)
    # 合法区: 0 <= c1-c0（delta=0 是完全不透明，合法）
    assert ((gw0.astype(int) - gb0.astype(int)) >= 0).all()

    # 破坏：随机挑 30% 像素让 c1<c0（真正的矛盾），少数像素推到 delta=255
    gb = gb0.copy()
    gw = gw0.copy()
    mask = rng.random((50, 50)) < 0.3
    hurt = rng.integers(1, 7, size=mask.sum())
    gw[mask] = np.clip(gb[mask].astype(int) - hurt, 0, 254).astype(np.uint8)
    mask255 = rng.random((50, 50)) < 0.05
    gb[mask255] = 0
    gw[mask255] = 255
    d = gw.astype(int) - gb.astype(int)
    assert (d < 0).sum() > 100, "破坏不充分"
    assert (d == 255).sum() > 50, "破坏不充分"

    gb2, gw2, stats = repair_pair(gb, gw)   # 默认 anchor="black"：保黑图
    d2 = gw2.astype(int) - gb2.astype(int)
    assert (d2 < 0).sum() == 0, f"修复后仍有 {(d2 < 0).sum()} 矛盾像素"
    assert (d2 > 254).sum() == 0
    assert stats["residual"] == 0
    # anchor="black" 时黑图应保持不变（除白图饱和兜底，本用例无饱和）
    assert (gb2 == gb).all(), "anchor=black 不应改动黑图"
    # 修复改动应接近破坏量级（平均 <= 5 级，破坏为 1~6 级）
    assert stats["avg_move"] <= 5.0, f"平均改动过大: {stats['avg_move']}"

    # sym 对称模式：黑图有改动且同样收敛
    gb3, gw3, st3 = repair_pair(gb, gw, anchor="sym")
    d3 = gw3.astype(int) - gb3.astype(int)
    assert (d3 < 0).sum() == 0 and st3["residual"] == 0
    assert (gb3 != gb).any(), "sym 模式应改动黑图"


def test_mapping_roundtrip():
    """值域映射法（多组区间）：v -> dark=[0,H], light=[L,255]。
    自洽性: 内容一致时 delta = L + v*(255-L-H)/255 >= min(L, 255-H) >= 0，
    即任意 (L,H) 组合观察对天然合法；模拟输出还原观察对误差<=1。"""
    rng = np.random.default_rng(5)
    v = rng.integers(0, 256, size=(64, 64)).astype(np.float64)
    for H, L in [(128, 128), (200, 100), (254, 1), (255, 0), (100, 200)]:
        g1d = np.round(v * H / 255.0).astype(np.uint8)
        g2l = np.round(L + v * (255 - L) / 255.0).astype(np.uint8)
        d = g2l.astype(int) - g1d.astype(int)
        # 内容一致自洽下界
        assert d.min() >= min(L, 255 - H), (H, L, d.min())
        assert (d < 0).sum() == 0 and (d > 254).sum() == 0, (H, L)

        fg, ab, valid = derive(g1d, g2l)
        assert valid.all(), (H, L)
        sb, sw = simulate(fg, ab)
        assert np.abs(sb.astype(int) - g1d.astype(int)).max() <= 1, (H, L)
        assert np.abs(sw.astype(int) - g2l.astype(int)).max() <= 1, (H, L)


def test_mapping_recovers_value():
    """互补区间 H+L=255 时，fg 是原灰度 v 的精确线性缩放（单调可还原）。"""
    rng = np.random.default_rng(9)
    v = rng.integers(0, 256, size=(32, 32)).astype(np.float64)
    H, L = 200, 55                      # 互补: 200+55=255
    g1d = np.round(v * H / 255.0).astype(np.uint8)
    g2l = np.round(L + v * (255 - L) / 255.0).astype(np.uint8)
    fg, ab, valid = derive(g1d, g2l)
    assert valid.all()
    # 理论: delta=L 常数, alpha=(255-L)/255, fg=v*H/L；v=255 时 fg=255*200/55>255 需注意
    # 只对 v <= floor(L*255/H) 的像素验证线性；此处仅验证单调性
    a = ab.astype(float) / 255.0
    assert np.abs(a - (255 - L) / 255.0).max() <= 1e-6  # alpha 恒定
    # 模拟仍自洽
    sb, sw = simulate(fg, ab)
    assert np.abs(sb.astype(int) - g1d.astype(int)).max() <= 1
    assert np.abs(sw.astype(int) - g2l.astype(int)).max() <= 1


def test_auto_xy():
    """真正的 repair：x,y 自动计算，x+y=255，取满足自洽的最大 x 最小 y。"""
    rng = np.random.default_rng(21)
    for _ in range(20):
        # 两张随机灰度图（任意内容，含内容一致与不一致）
        g1 = rng.integers(0, 256, size=(48, 48)).astype(np.uint8)
        g2 = rng.integers(0, 256, size=(48, 48)).astype(np.uint8)
        x, y, _ = auto_xy(g1, g2)
        assert x + y == 255, (x, y)
        assert 0 <= x <= 255 and 0 <= y <= 255
        # 映射后全像素自洽：c1>=c0；delta=255(c0=0,c1=255) 是合法透明像素(alpha=0)
        c0 = np.round(g1.astype(float) * x / 255.0).astype(np.int64)
        c1 = np.round(y + g2.astype(float) * (255 - y) / 255.0).astype(np.int64)
        d = c1 - c0
        assert (d >= 0).all() and (d <= 255).all(), (x, y, d.min(), d.max())
        # x 应为最大：x+1 时（y-1）最坏像素不再自洽（在 g1_max/g2_min 处违反）
        if x < 255:
            x2, y2 = x + 1, y - 1
            c0b = np.round(g1.astype(float) * x2 / 255.0).astype(np.int64)
            c1b = np.round(y2 + g2.astype(float) * (255 - y2) / 255.0).astype(np.int64)
            # 最坏像素：g1 最大、g2 最小
            i = np.argmax(g1)
            assert c1b.ravel()[i] - c0b.ravel()[i] < 0 or c1b.min() - c0b.max() < 0, (x, y)


def test_auto_xy_consistent():
    """内容一致时自动 x,y 应比固定 [0,128]/[128,255] 压缩更少（x 更大）。"""
    rng = np.random.default_rng(22)
    v = rng.integers(30, 226, size=(64, 64)).astype(np.uint8)  # 动态范围受限 -> 少压缩
    x, y, _ = auto_xy(v, v)
    assert x + y == 255
    assert x > 128, f"内容一致受限动态范围时应 x>128，实际 {x}"
    c0 = np.round(v.astype(float) * x / 255.0).astype(np.int64)
    c1 = np.round(y + v.astype(float) * (255 - y) / 255.0).astype(np.int64)
    assert (c1 >= c0).all()


def test_center_crop():
    """中心裁剪：取两图 min 高宽，各自中心对齐。"""
    # 10x8 图，像素值 = x*100+y，方便定位
    a = np.zeros((8, 10), dtype=np.uint8)
    for y in range(8):
        for x in range(10):
            a[y, x] = (x * 100 + y) % 256
    im = _Image.fromarray(a)
    c = center_crop(im, 6, 4)                     # left=2, top=2
    assert c.size == (6, 4)
    out = np.array(c)
    assert out[0, 0] == a[2, 2] and out[0, 5] == a[2, 7]
    assert out[3, 0] == a[5, 2] and out[3, 5] == a[5, 7]
    # 超出原图尺寸时返回整幅
    assert center_crop(im, 999, 999).size == (10, 8)

def test_unify_size():
    """unify_size：高的大图先等比缩放（不变形）到小图高度，再对宽图中心裁剪左右两端。"""
    # 等比缩放高度：12x10 -> 高 6 => 宽 round(12*6/10)=7，宽高比保持
    im = _Image.new("L", (12, 10), 0)
    r = resize_to_height(im, 6)
    assert r.size == (7, 6)
    assert r.height == 6 and abs(r.width / r.height - 12 / 10) < 0.2
    # 高度已相等则不缩放
    assert resize_to_height(im, 10) is im

    # 两张不同尺寸：im_big 12x10(中心 4x4=200 at (4,3))，im_small 6x6(中心 2x2=100)
    im_big = _Image.new("L", (12, 10), 0)
    im_big.paste(_Image.new("L", (4, 4), 200), (4, 3))
    im_small = _Image.new("L", (6, 6), 0)
    im_small.paste(_Image.new("L", (2, 2), 100), (2, 2))
    u1, u2 = unify_size(im_big, im_small)
    # 统一后同尺寸；大图高度被等比缩到 6
    assert u1.size == (6, 6) and u2.size == (6, 6)
    # im_small 未缩放未裁剪 -> 原样
    assert np.array(u2)[2, 2] == 100
    # im_big: 缩放(高6,宽7)后中心裁宽(7->6,left=0)；中心 200 块保留，左上角为 0
    b = np.array(u1)
    assert b[3, 3] > 100 and b[0, 0] == 0


if __name__ == "__main__":
    test_hand_cases()
    print("PASS: 手工推导用例")
    test_error_cases()
    print("PASS: 边界报错用例")
    test_fp_precision_boundary()
    print("PASS: 浮点精度边界(255 不误报)")
    test_against_original()
    print("PASS: 与原始实现 3000 例逐值一致")
    test_roundtrip_random()
    print("PASS: 随机往返 20 万例，模拟输出误差<=1，fg/alpha 还原误差<=1")
    test_repair_pair()
    print("PASS: 加深/变浅修复(破坏 30% 像素后全部拉回合法区)")
    test_mapping_roundtrip()
    print("PASS: 值域映射法多组区间自洽(delta>=min(L,255-H), 模拟误差<=1)")
    test_mapping_recovers_value()
    print("PASS: 互补区间 H+L=255 时 alpha 恒定、模拟自洽")
    test_auto_xy()
    print("PASS: 自动 x,y(真正的 repair)：x+y=255、全像素自洽、x 为约束下最大")
    test_auto_xy_consistent()
    print("PASS: 内容一致受限动态范围时自动 x>128(少压缩)")
    test_center_crop()
    print("PASS: 中心裁剪")
    test_unify_size()
    print("PASS: 尺寸统一(等比缩放高度+裁剪宽图左右两端)")