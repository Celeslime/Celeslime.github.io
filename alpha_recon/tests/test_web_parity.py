#!/usr/bin/env python3
"""
Web 核心算法对拍测试：使用 Python derive.py 作为参考实现，
生成随机测试向量，调用 Node 运行 JS core.js 对比结果。

运行: python tests/test_web_parity.py
"""
import sys
import os
import json
import tempfile
import subprocess
import random
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from derive import (
    to_gray, auto_xy, derive, simulate, composite,
    center_crop, resize_to_height, unify_size,
    derive_scalar, verify_scalar
)

# ---- 1. 生成测试向量 ----

def gen_test_cases():
    rng = np.random.default_rng(12345)
    cases = []

    # 辅助：运行参考流程得到期望值
    def run_ref(g1, g2):
        x, y = auto_xy(g1, g2)
        dark = np.round(g1.astype(np.float64) * x / 255.0).astype(np.uint8)
        light = np.round(y + g2.astype(np.float64) * (255 - y) / 255.0).astype(np.uint8)
        fg, ab, valid = derive(dark, light)
        b_sim, w_sim = simulate(fg, ab)
        errB = int(np.abs(b_sim.astype(int) - dark.astype(int)).max())
        errW = int(np.abs(w_sim.astype(int) - light.astype(int)).max())
        valid_count = int(valid.sum())
        semi = int((ab[valid] < 255).sum())
        semi_pct = round(semi / valid_count * 100, 1) if valid_count else 0.0
        invalid = int((~valid).sum())
        return {
            'x': int(x), 'y': int(y),
            'dark': dark.tolist(),
            'light': light.tolist(),
            'fg': fg.tolist(),
            'ab': ab.tolist(),
            'valid': valid.astype(int).tolist(),
            'valid_count': valid_count,
            'semi_pct': semi_pct,
            'invalid': invalid,
            'errB': errB,
            'errW': errW,
        }

    # 1) 简单标量手工用例（单像素）
    scalar_cases = [
        (np.array([0], dtype=np.uint8), np.array([0], dtype=np.uint8)),      # 纯黑
        (np.array([255], dtype=np.uint8), np.array([255], dtype=np.uint8)),  # 纯白
        (np.array([100], dtype=np.uint8), np.array([155], dtype=np.uint8)),  # 典型
        (np.array([13], dtype=np.uint8), np.array([23], dtype=np.uint8)),
        (np.array([250], dtype=np.uint8), np.array([255], dtype=np.uint8)),
    ]
    for g1, g2 in scalar_cases:
        cases.append({'name': 'scalar', 'g1': g1.tolist(), 'g2': g2.tolist(), 'ref': run_ref(g1, g2)})

    # 2) 小尺寸随机数组
    for size in [(8,8), (16,12), (32,32)]:
        h, w = size
        for _ in range(5):
            g1 = rng.integers(0, 256, size=(h,w), dtype=np.uint8)
            g2 = rng.integers(0, 256, size=(h,w), dtype=np.uint8)
            cases.append({'name': f'rand_{w}x{h}', 'g1': g1.tolist(), 'g2': g2.tolist(), 'ref': run_ref(g1, g2)})

    # 3) 内容一致的受限动态范围（测试 auto_xy x > 128）
    for _ in range(3):
        base = rng.integers(30, 226, size=(32,32), dtype=np.uint8)
        noise = rng.integers(-3, 4, size=(32,32), dtype=np.int16)
        g1 = np.clip(base + noise, 0, 255).astype(np.uint8)
        g2 = np.clip(base - noise, 0, 255).astype(np.uint8)
        cases.append({'name': 'consistent_limited', 'g1': g1.tolist(), 'g2': g2.tolist(), 'ref': run_ref(g1, g2)})

    # 4) 全常量数组
    for val in [0, 64, 128, 191, 255]:
        g = np.full((16,16), val, dtype=np.uint8)
        cases.append({'name': f'const_{val}', 'g1': g.tolist(), 'g2': g.tolist(), 'ref': run_ref(g, g)})

    # 5) 单调梯度
    grad = np.tile(np.arange(256, dtype=np.uint8), (16, 1))  # 16x256
    cases.append({'name': 'gradient', 'g1': grad.tolist(), 'g2': grad.tolist(), 'ref': run_ref(grad, grad)})

    # 6) toGray 对拍：随机 RGBA 与 PIL convert('L')
    togray_cases = []
    for _ in range(20):
        h, w = rng.integers(4, 32, size=2)
        rgba = rng.integers(0, 256, size=(h,w,4), dtype=np.uint8)
        # PIL 参考
        pil_gray = np.array(Image.fromarray(rgba, 'RGBA').convert('L'), dtype=np.uint8)
        togray_cases.append({'rgba': rgba.tolist(), 'ref_gray': pil_gray.tolist()})

    # 7) planUnify 对拍：随机尺寸对
    unify_cases = []
    for _ in range(30):
        w1 = rng.integers(10, 500)
        h1 = rng.integers(10, 500)
        w2 = rng.integers(10, 500)
        h2 = rng.integers(10, 500)
        # Python 版的 planUnify 逻辑复刻（用 derive 里的函数）
        from derive import unify_size, center_crop, resize_to_height
        im1 = Image.new('L', (w1, h1), 0)
        im2 = Image.new('L', (w2, h2), 0)
        u1, u2 = unify_size(im1, im2)
        # 计算目标尺寸和裁剪参数（对齐 core.js 的 planUnify 返回结构）
        # 这里只测试最终尺寸
        unify_cases.append({
            'w1': int(w1), 'h1': int(h1), 'w2': int(w2), 'h2': int(h2),
            'ref_w': u1.width, 'ref_h': u1.height
        })

    return {
        'pipeline': cases,
        'togray': togray_cases,
        'unify': unify_cases
    }

def main():
    print('生成测试向量...')
    vectors = gen_test_cases()
    print(f"  pipeline: {len(vectors['pipeline'])} 个")
    print(f"  togray:   {len(vectors['togray'])} 个")
    print(f"  unify:    {len(vectors['unify'])} 个")

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(vectors, f)
        vec_path = f.name

    try:
        # 调用 Node 校验脚本
        check_script = os.path.join(os.path.dirname(__file__), 'web_parity_check.mjs')
        cmd = ['node', check_script, vec_path]
        print(f'运行 Node 校验: {" ".join(cmd)}')
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        if result.returncode != 0:
            print('[FAIL] 对拍失败')
            sys.exit(1)
        print('[OK] 所有对拍通过')
    finally:
        try:
            os.unlink(vec_path)
        except OSError:
            pass

if __name__ == '__main__':
    main()