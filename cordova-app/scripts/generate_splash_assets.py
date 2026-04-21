#!/usr/bin/env python3
"""
若仓库中尚无 res/icon/icon.png，则用程序绘制一张默认图标并保存。
桌面启动器图标已在 config.xml 中为 ldpi～xxxhdpi 各声明同一文件，
由 cordova-android 复制到各 mipmap-*（避免仅 mdpi 生效、其它密度仍为默认「i」图标）。

启动屏中心图同样使用 res/icon/icon.png（AndroidWindowSplashScreenAnimatedIcon）。

依赖：pip install Pillow
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw

BLUE = (30, 111, 255)
WHITE = (255, 255, 255)


def render_icon(size: int) -> Image.Image:
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


def main() -> int:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    icon_dir = os.path.join(root, "res", "icon")
    os.makedirs(icon_dir, exist_ok=True)
    icon_path = os.path.join(icon_dir, "icon.png")
    if os.path.isfile(icon_path):
        print("keep existing", icon_path)
        return 0
    render_icon(1024).save(icon_path, "PNG", optimize=True)
    print("wrote", icon_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
