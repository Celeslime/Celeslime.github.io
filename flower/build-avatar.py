# -*- coding: utf-8 -*-
"""生成 avatar.svg（站外头像接口）。

原理：avatar.svg 为自包含 SVG：内置默认花内容 + 引用 js/flower.js 与 js/avatar-run.js。
作为 SVG 文档直接访问（或 iframe/object 嵌入）时，flower.js 定义 FlowerGen，
avatar-run.js 按 ?name= 等参数动态自绘并替换内容；作为 <img src> 引用时脚本
不执行，显示内置默认花（匿名的经典花：无网格/透明/水印"鸿"）。

用法：改动 flower.js 后重跑一次，默认内容与脚本保持一致。
依赖：node（以当前 flower.js 生成默认花内容）。
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
FLOWER_JS = os.path.join(HERE, "js", "flower.js")

# 用 node + 当前 flower.js 生成默认花 inner（anonymous 种子，无网格/透明/水印"鸿"）
NODE_SCRIPT = (
    "const FG=require('./js/flower.js');"
    "const s=FG.generateAvatar('',{size:128});"
    "process.stdout.write(s.slice(s.indexOf('>')+1,s.lastIndexOf('</svg>')))"
)
default_inner = subprocess.run(
    ["node", "-e", NODE_SCRIPT],
    cwd=HERE,
    capture_output=True,
    text=True,
    encoding="utf-8",
    errors="replace",
    check=True,
).stdout

TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<!--
  站外头像接口：按昵称生成花头像 SVG（无网格/透明/固定水印"© 2026 鸿"）。
  用法：https://celeslime.github.io/flower/avatar.svg?name=Alice
  可选参数：size=128  grid=1  color=%23ff0000  bg=  petals=7  rotation=45  fillopacity=0.25  res=90
  注意：水印固定为"© 2026 鸿"、射线固定为花瓣数的 2 倍，不接受参数覆盖。
  说明：SVG 内嵌脚本仅在作为文档直接访问 / iframe / object 时执行；
        若用 <img src> 引用，脚本不会执行，将显示内置默认花。
-->
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
__DEFAULT_INNER__
<script type="text/javascript" href="js/flower.js"></script>
<script type="text/javascript" href="js/avatar-run.js"></script>
</svg>
"""

out = TEMPLATE.replace("__DEFAULT_INNER__", default_inner)
with open(os.path.join(HERE, "avatar.svg"), "w", encoding="utf-8") as f:
    f.write(out)
print("avatar.svg written, %d bytes" % len(out))

