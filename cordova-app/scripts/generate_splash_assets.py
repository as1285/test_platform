#!/usr/bin/env python3
"""
基于 www/start.png（全屏启动图）生成 Android 系统启动图标与兼容用的 www/splash.png。

依赖：pip install Pillow
"""
from __future__ import annotations

import os
import shutil
import sys

from PIL import Image

WHITE = (255, 255, 255)


def compose_square_emblem(src_path: str, canvas: int, fill_ratio: float) -> Image.Image:
    """将启动图中心区域缩放后贴在正方形透明画布上（供 Android 12+ 启动图标）。"""
    emblem = Image.open(src_path).convert("RGBA")
    target = int(canvas * fill_ratio)
    tw = max(emblem.size)
    scale = target / tw
    nw = max(1, int(round(emblem.width * scale)))
    nh = max(1, int(round(emblem.height * scale)))
    emblem = emblem.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    x = (canvas - nw) // 2
    y = (canvas - nh) // 2
    out.paste(emblem, (x, y), emblem)
    return out


def main() -> int:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    www_start = os.path.join(root, "www", "start.png")
    if not os.path.isfile(www_start):
        print("missing", www_start, file=sys.stderr)
        return 1

    www_splash = os.path.join(root, "www", "splash.png")
    shutil.copy2(www_start, www_splash)
    print("wrote", www_splash, "(copy of start.png)")

    splash_dir = os.path.join(root, "res", "splash")
    os.makedirs(splash_dir, exist_ok=True)
    android_splash = os.path.join(splash_dir, "splash.png")
    compose_square_emblem(www_start, 512, fill_ratio=0.86).save(android_splash, "PNG", optimize=True)
    print("wrote", android_splash)

    icon_dir = os.path.join(root, "res", "icon")
    os.makedirs(icon_dir, exist_ok=True)
    icon_path = os.path.join(icon_dir, "icon.png")
    compose_square_emblem(www_start, 1024, fill_ratio=0.72).save(icon_path, "PNG", optimize=True)
    print("wrote", icon_path)

    return 0


if __name__ == "__main__":
    sys.exit(main())
