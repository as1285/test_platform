#!/usr/bin/env python3
"""
生成 Cordova Android 所需应用图标（1024 PNG），供：
- config.xml <icon src="res/icon/icon.png" />
- Android 12+ SplashScreen 中心图（AndroidWindowSplashScreenAnimatedIcon）

替换品牌时：直接覆盖 res/icon/icon.png 后重新打包 APK 即可。
依赖：pip install Pillow
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw

BLUE = (30, 111, 255)
WHITE = (255, 255, 255)


def render_icon(size: int = 1024) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = int(size * 0.18)
    draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=int(size * 0.2), fill=BLUE)
    cx, cy = size // 2, size // 2
    r = int(size * 0.22)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    bw = max(3, size // 40)
    bh = int(r * 1.15)
    draw.rounded_rectangle(
        [cx - bw // 2, cy - bh // 2, cx + bw // 2, cy + bh // 2],
        radius=bw // 2,
        fill=BLUE,
    )
    return img


def main() -> int:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    icon_dir = os.path.join(root, "res", "icon")
    os.makedirs(icon_dir, exist_ok=True)
    icon_path = os.path.join(icon_dir, "icon.png")
    render_icon(1024).save(icon_path, "PNG", optimize=True)
    print("wrote", icon_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
