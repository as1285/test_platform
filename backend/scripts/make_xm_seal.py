#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""厦门社保「业务专用章」红色电子印章（透明底）。

版式对齐厦门市社会保险个人参保证明样张：外圈弧字、中心五角星、
横排「业务专用章」、底部机构编码。
"""
from __future__ import print_function

import math
import os
import shutil

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
FRONTEND_IMG = os.path.join(HERE, '..', '..', 'frontend', 'public', 'img')
FONT_CANDIDATES = [
    os.path.join(ASSETS, 'NotoSerifCJKsc-Regular.otf'),
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSerifCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',
]

RING = '厦门市社会保险中心'
MID = '业务专用章'
CODE = '3502121006975'
RED = (196, 32, 28, 255)


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


def _draw_arc_text(img, text, cx, cy, radius, start_deg, end_deg, font, flip=False):
    n = max(1, len(text))
    start = math.radians(start_deg)
    end = math.radians(end_deg)
    for i, ch in enumerate(text):
        t = i / float(max(1, n - 1))
        theta = start + (end - start) * t
        rx = cx + radius * math.cos(theta)
        ry = cy + radius * math.sin(theta)
        side = int(font.size * 2.4)
        ch_img = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        cd = ImageDraw.Draw(ch_img)
        cb = cd.textbbox((0, 0), ch, font=font)
        tw = cb[2] - cb[0]
        th = cb[3] - cb[1]
        cd.text(
            ((side - tw) / 2.0 - cb[0], (side - th) / 2.0 - cb[1]),
            ch,
            font=font,
            fill=RED,
            stroke_width=max(1, int(font.size * 0.04)),
            stroke_fill=RED,
        )
        rot = -(math.degrees(theta) + 90.0)
        if flip:
            rot += 180.0
        ch_rot = ch_img.rotate(rot, expand=True, resample=Image.BICUBIC)
        img.alpha_composite(
            ch_rot,
            (int(rx - ch_rot.width / 2.0), int(ry - ch_rot.height / 2.0)),
        )


def make_xm_seal(out_path, size=1024):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx = cy = size / 2.0
    r = size * 0.46
    ring_w = max(8, int(size * 0.028))
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=RED, width=ring_w)
    inner = r - ring_w * 1.6
    draw.ellipse((cx - inner, cy - inner, cx + inner, cy + inner), outline=RED, width=max(2, ring_w // 3))

    draw.polygon(_star_pts(cx, cy - size * 0.02, size * 0.145), fill=RED)

    font_ring = _load_font(int(size * 0.092))
    _draw_arc_text(img, RING, cx, cy, size * 0.355, -158, -22, font_ring)

    font_mid = _load_font(int(size * 0.088))
    mb = draw.textbbox((0, 0), MID, font=font_mid)
    mw = mb[2] - mb[0]
    mh = mb[3] - mb[1]
    draw.text(
        (cx - mw / 2.0 - mb[0], cy + size * 0.145 - mh / 2.0 - mb[1]),
        MID,
        font=font_mid,
        fill=RED,
        stroke_width=2,
        stroke_fill=RED,
    )

    font_code = _load_font(int(size * 0.046))
    _draw_arc_text(img, CODE, cx, cy, size * 0.348, 148, 32, font_code, flip=False)

    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    img.save(out_path, 'PNG')
    return out_path


def main():
    out = os.path.join(ASSETS, 'xm_seal.png')
    make_xm_seal(out)
    print('wrote', out)
    os.makedirs(FRONTEND_IMG, exist_ok=True)
    dst = os.path.join(FRONTEND_IMG, 'sbdy_xm_seal.png')
    shutil.copyfile(out, dst)
    print('wrote', dst)


if __name__ == '__main__':
    main()
