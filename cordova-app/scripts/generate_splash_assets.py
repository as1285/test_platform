#!/usr/bin/env python3
"""
若仓库中尚无 res/icon/icon.png，则用程序绘制一张默认图标并保存。
桌面启动器图标已在 config.xml 中为 ldpi～xxxhdpi 各声明同一文件，
由 cordova-android 复制到各 mipmap-*。

每次运行会基于当前 icon.png 重新生成：
- res/splash/splash.png → AndroidWindowSplashScreenAnimatedIcon（图标在方块内尽量放大，便于系统裁切圆内仍显眼）
- www/splash.png → WebView 内启动层用的竖屏底图（图案占屏比例更大，配合 index.html 的响应式缩放）

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
    """将图标缩放后居中贴在正方形透明画布上（供 Android 12+ 启动图标）。"""
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


def compose_portrait_splash(src_path: str, width: int, height: int, fill_ratio: float) -> Image.Image:
    """竖屏白底， emblem 按屏宽比例放大居中（供 www/splash.png）。"""
    emblem = Image.open(src_path).convert("RGBA")
    canvas = Image.new("RGB", (width, height), WHITE)
    target = int(min(width, height) * fill_ratio)
    tw = max(emblem.size)
    scale = target / tw
    nw = max(1, int(round(emblem.width * scale)))
    nh = max(1, int(round(emblem.height * scale)))
    emblem = emblem.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (width - nw) // 2
    y = (height - nh) // 2
    canvas.paste(emblem, (x, y), emblem)
    return canvas


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
    compose_square_emblem(icon_path, 512, fill_ratio=0.86).save(android_splash, "PNG", optimize=True)
    print("wrote", android_splash)

    www_splash = os.path.join(root, "www", "splash.png")
    compose_portrait_splash(icon_path, 1080, 1920, fill_ratio=0.5).save(www_splash, "PNG", optimize=True)
    print("wrote", www_splash)

    return 0


if __name__ == "__main__":
    sys.exit(main())
