#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成湖北省参保证明红色圆章（透明底），供 PDF / HTML 预览使用。"""
from __future__ import print_function

import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
FONT_CANDIDATES = [
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',
    '/usr/share/fonts/truetype/noto/NotoSerifCJK-Bold.ttc',
    os.path.join(ASSETS, 'NotoSerifCJKsc-Regular.otf'),
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


def make_wh_seal(out_path, size=1024):
    out_size = int(size)
    size = out_size * 2
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    red = (190, 22, 30, 255)
    cx = cy = size / 2.0
    r = size * 0.455
    ring_w = max(10, int(size * 0.025))
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=red, width=ring_w)

    star_r = size * 0.145
    draw.polygon(_star_pts(cx, cy - size * 0.002, star_r), fill=red)

    font_bot = _load_font(int(size * 0.14))
    bot = '参保证明章'
    bbox = draw.textbbox((0, 0), bot, font=font_bot)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        (cx - tw / 2.0 - bbox[0], cy + size * 0.27 - th / 2.0 - bbox[1]),
        bot,
        font=font_bot,
        fill=red,
        stroke_width=max(1, int(size * 0.004)),
        stroke_fill=red,
    )

    ring = '湖北省城镇企业职工社会保险'
    font_ring = _load_font(int(size * 0.105))
    n = len(ring)
    start = -math.pi * 0.57
    end = math.pi * 0.57
    radius_text = r - size * 0.09
    for i, ch in enumerate(ring):
        t = i / float(max(1, n - 1))
        ang = start + (end - start) * t
        rx = cx + radius_text * math.sin(ang)
        ry = cy - radius_text * math.cos(ang)
        ch_img = Image.new('RGBA', (int(size * 0.16), int(size * 0.16)), (0, 0, 0, 0))
        cd = ImageDraw.Draw(ch_img)
        cb = cd.textbbox((0, 0), ch, font=font_ring)
        cd.text(
            (size * 0.008 - cb[0], size * 0.005 - cb[1]),
            ch,
            font=font_ring,
            fill=red,
            stroke_width=max(1, int(size * 0.005)),
            stroke_fill=red,
        )
        rot = -math.degrees(ang)
        ch_rot = ch_img.rotate(rot, expand=True, resample=Image.BICUBIC)
        img.alpha_composite(
            ch_rot,
            (int(rx - ch_rot.width / 2.0), int(ry - ch_rot.height / 2.0)),
        )

    img = img.resize((out_size, out_size), Image.Resampling.LANCZOS)
    img = img.filter(ImageFilter.GaussianBlur(radius=0.25))
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    img.save(out_path, 'PNG')
    return out_path


def main():
    out = os.path.join(ASSETS, 'wh_seal.png')
    make_wh_seal(out)
    print('wrote', out)


if __name__ == '__main__':
    main()
