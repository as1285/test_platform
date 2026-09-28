#!/usr/bin/env python3
"""
- res/icon/icon.png：APK 桌面图标（保持仓库内文件，不覆盖）
- res/android/launch_bg.png + launch_splash.xml：Android 冷启动全屏启动图
- res/screen/ios/Default@*~universal~*.png：iOS Launch Storyboard 启动图
- www/start.png：WebView 全屏启动图（index.html）

依赖：pip install Pillow
"""
from __future__ import annotations

import os
import sys

from PIL import Image

BLUE = (30, 111, 255)
WHITE = (255, 255, 255)

# Cordova iOS Launch Storyboard（universal，覆盖各机型）
# https://cordova.apache.org/docs/en/latest/core/features/splashscreen/
IOS_STORYBOARD_SPLASHES = (
    ("Default@2x~universal~anyany.png", 2732, 2732),
    ("Default@2x~universal~comany.png", 1278, 2732),
    ("Default@2x~universal~comcom.png", 1334, 750),
    ("Default@3x~universal~anyany.png", 2208, 2208),
    ("Default@3x~universal~anycom.png", 2208, 1242),
    ("Default@3x~universal~comany.png", 1242, 2208),
)


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


def write_fullscreen_cover(src_path: str, out_path: str, width: int, height: int) -> None:
    """竖/横屏全屏 cover 裁剪，与 WebView object-fit:cover 一致。"""
    img = Image.open(src_path).convert("RGB")
    scale = max(width / img.width, height / img.height)
    nw = max(1, int(round(img.width * scale)))
    nh = max(1, int(round(img.height * scale)))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (nw - width) // 2
    y = (nh - height) // 2
    canvas = resized.crop((x, y, x + width, y + height))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    canvas.save(out_path, "PNG", optimize=True)


def write_fullscreen_launch_bg(src_path: str, out_path: str, width: int = 1080, height: int = 2340) -> None:
    write_fullscreen_cover(src_path, out_path, width, height)


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

    android_dir = os.path.join(root, "res", "android")
    launch_bg = os.path.join(android_dir, "launch_bg.png")
    write_fullscreen_launch_bg(www_start, launch_bg)
    print("wrote", launch_bg, "(fullscreen cover for Android cold start)")

    # 兼容旧配置路径：透明占位，不再生成缩小版 emblem
    splash_dir = os.path.join(root, "res", "splash")
    os.makedirs(splash_dir, exist_ok=True)
    empty = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    empty.save(os.path.join(splash_dir, "splash.png"), "PNG", optimize=True)
    print("wrote", os.path.join(splash_dir, "splash.png"), "(transparent placeholder)")

    ios_dir = os.path.join(root, "res", "screen", "ios")
    os.makedirs(ios_dir, exist_ok=True)
    for name, w, h in IOS_STORYBOARD_SPLASHES:
        out = os.path.join(ios_dir, name)
        write_fullscreen_cover(www_start, out, w, h)
        print("wrote", out, f"({w}x{h})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
