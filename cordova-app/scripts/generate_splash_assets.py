#!/usr/bin/env python3
"""
- res/icon/icon.png：APK 桌面图标（保持仓库内文件，不覆盖）
- res/splash/splash.png：Android 12+ 系统闪屏居中图（由 www/start.png 生成，冷启动即显示）
- www/start.png：WebView 全屏启动图（index.html 使用）

依赖：pip install Pillow
"""
from __future__ import annotations

import os
import sys

from PIL import Image

BLUE = (30, 111, 255)
WHITE = (255, 255, 255)


def render_icon(size: int) -> Image.Image:
    from PIL import ImageDraw

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = int(size * 0.18)
    draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=int(size * 0.2), fill=BLUE)
    cx, cy = size // 2, size // 2
    r = int(size * 0.22)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    bw = max(1, size // 40)
    bh = int(r * 1.15)
    draw.rounded_rectangle(
        [cx - bw // 2, cy - bh // 2, cx + bw // 2, cy + bh // 2],
        radius=max(1, bw // 2),
        fill=BLUE,
    )
    return img


def compose_square_emblem(src_path: str, canvas: int, fill_ratio: float) -> Image.Image:
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

    icon_dir = os.path.join(root, "res", "icon")
    os.makedirs(icon_dir, exist_ok=True)
    icon_path = os.path.join(icon_dir, "icon.png")
    if not os.path.isfile(icon_path):
        render_icon(1024).save(icon_path, "PNG", optimize=True)
        print("wrote", icon_path)
    else:
        print("keep existing", icon_path)

    splash_dir = os.path.join(root, "res", "splash")
    os.makedirs(splash_dir, exist_ok=True)
    android_splash = os.path.join(splash_dir, "splash.png")
    compose_square_emblem(www_start, 512, fill_ratio=0.92).save(android_splash, "PNG", optimize=True)
    print("wrote", android_splash, "(from start.png for native cold start)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
