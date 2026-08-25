#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成江苏省养老保险权益记录单红色电子印章（透明底），供 PDF / HTML 预览使用。

圆形红章：顶部弧「江苏省社会保险局」，中心五角星，底部「电子专用章」。
打印日期为动态文案（黑色），由渲染层叠加在印章中部，不写入本 PNG。
"""
from __future__ import print_function

import math
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
FRONTEND_IMG = os.path.join(HERE, '..', '..', 'frontend', 'public', 'img')
FONT_CANDIDATES = [
    os.path.join(ASSETS, 'NotoSerifCJKsc-Regular.otf'),
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSerifCJK-Regular.ttc',
]


def _load_font(size):
    for path in FONT_CANDIDATES:
        if not os.path.isfile(path):
            continue
        try:
            return ImageFont.truetype(path, size=size, index=2 if path.endswith('.ttc') else 0)
        except Exception:
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def _star_pts(cx, cy, r, rot=-math.pi / 2):
    pts = []
    for i in range(10):
        ang = rot + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.38
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    return pts


def make_js_seal(out_path, size=1024):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    red = (214, 22, 22, 255)
    cx = cy = size / 2.0
    r = size * 0.462
    ring_w = max(10, int(size * 0.024))
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=red, width=ring_w)

    # 中心五角星（上移，给中部打印日期留出空白）
    star_r = size * 0.140
    draw.polygon(_star_pts(cx, cy - size * 0.082, star_r), fill=red)

    # 顶部弧字：江苏省社会保险局
    ring = '江苏省社会保险局'
    font_ring = _load_font(int(size * 0.108))
    n = len(ring)
    start = -math.pi * 0.60
    end = math.pi * 0.60
    radius_text = r - size * 0.104
    for i, ch in enumerate(ring):
        t = i / float(max(1, n - 1))
        ang = start + (end - start) * t
        rx = cx + radius_text * math.sin(ang)
        ry = cy - radius_text * math.cos(ang)
        ch_img = Image.new('RGBA', (int(size * 0.17), int(size * 0.17)), (0, 0, 0, 0))
        cd = ImageDraw.Draw(ch_img)
        cb = cd.textbbox((0, 0), ch, font=font_ring)
        cd.text((6 - cb[0], 4 - cb[1]), ch, font=font_ring, fill=red)
        rot = -math.degrees(ang)
        ch_rot = ch_img.rotate(rot, expand=True, resample=Image.BICUBIC)
        img.alpha_composite(
            ch_rot,
            (int(rx - ch_rot.width / 2.0), int(ry - ch_rot.height / 2.0)),
        )

    # 底部：电子专用章（红色，横排在下部）
    bot = '电子专用章'
    font_bot = _load_font(int(size * 0.104))
    spacing = size * 0.006
    widths = []
    total_w = 0.0
    for ch in bot:
        b = draw.textbbox((0, 0), ch, font=font_bot)
        w = b[2] - b[0]
        widths.append((ch, w, b))
        total_w += w + spacing
    total_w -= spacing
    x = cx - total_w / 2.0
    y_bot = cy + size * 0.224
    for ch, w, b in widths:
        h = b[3] - b[1]
        draw.text((x - b[0], y_bot - h / 2.0 - b[1]), ch, font=font_bot, fill=red)
        x += w + spacing

    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    img.save(out_path, 'PNG')
    return out_path


def main():
    out = os.path.join(ASSETS, 'js_seal.png')
    make_js_seal(out)
    print('wrote', out)
    try:
        os.makedirs(FRONTEND_IMG, exist_ok=True)
        import shutil

        dst = os.path.join(FRONTEND_IMG, 'sbdy_js_seal.png')
        shutil.copyfile(out, dst)
        print('wrote', dst)
    except Exception as e:
        print('copy to frontend failed:', e)


if __name__ == '__main__':
    main()
