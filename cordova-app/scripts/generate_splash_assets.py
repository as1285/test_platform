#!/usr/bin/env python3
"""
- res/icon/icon.png：APK 桌面图标（保持仓库内文件，本脚本不覆盖已有 icon）
- res/splash/splash.png：Android 12+ 系统闪屏用透明图（避免显示桌面小图标）
- www/start.png：WebView 全屏启动图（仅 index.html 使用，本脚本不修改）

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


def write_transparent_splash_icon(path: str, size: int = 48) -> None:
    """系统闪屏中间图标：透明，仅保留白底，全屏启动交给 www/start.png。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.save(path, "PNG", optimize=True)


def main() -> int:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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
    write_transparent_splash_icon(android_splash, 48)
    print("wrote", android_splash, "(transparent, native splash icon hidden)")

    www_start = os.path.join(root, "www", "start.png")
    if os.path.isfile(www_start):
        print("keep www/start.png for WebView fullscreen startup")
    else:
        print("warning: missing", www_start, file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
