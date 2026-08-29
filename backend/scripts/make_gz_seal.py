#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成广州社保章：版式对齐深圳章，弧上机构名为「广州市社会保险基金管理局」。"""
from __future__ import print_function

import math
import os
import shutil

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
FRONTEND_IMG = os.path.join(HERE, '..', '..', 'frontend', 'public', 'img')
OUT_ASSET = os.path.join(ASSETS, 'gz_seal.png')
OUT_WEB = os.path.join(FRONTEND_IMG, 'sbdy_gz_seal.png')

FONT_CANDIDATES = [
    os.path.join(ASSETS, 'NotoSerifCJKsc-Regular.otf'),
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSerifCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',
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


def _draw_arc_text(img, text, cx, cy, radius, start_deg, end_deg, font, fill):
    n = len(text)
    side = 48
    for i, ch in enumerate(text):
        t = i / float(max(1, n - 1))
        deg = start_deg + (end_deg - start_deg) * t
        theta = math.radians(deg)
        rx = cx + radius * math.cos(theta)
        ry = cy + radius * math.sin(theta)
        ch_img = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        cd = ImageDraw.Draw(ch_img)
        box = cd.textbbox((0, 0), ch, font=font)
        tw, th = box[2] - box[0], box[3] - box[1]
        cd.text(
            ((side - tw) / 2.0 - box[0], (side - th) / 2.0 - box[1] - 1),
            ch,
            font=font,
            fill=fill,
        )
        rot = -(deg + 90.0)
        ch_rot = ch_img.rotate(rot, expand=True, resample=Image.BICUBIC)
        img.alpha_composite(
            ch_rot,
            (int(rx - ch_rot.width / 2.0), int(ry - ch_rot.height / 2.0)),
        )


def _draw_centered_line(draw, text, cx, y, font, fill):
    box = draw.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    draw.text((cx - tw / 2.0 - box[0], y - th / 2.0 - box[1]), text, font=font, fill=fill)


def make_gz_seal(out_path=OUT_ASSET, size=167):
    img = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    red = (210, 8, 8, 255)
    cx = cy = size / 2.0
    r = size * 0.47
    ring_w = max(2, int(round(size * 0.016)))
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=red, width=ring_w)

    font_arc = _load_font(17)
    _draw_arc_text(
        img,
        u'广州市社会保险基金管理局',
        cx,
        cy,
        radius=size * 0.372,
        start_deg=-168.0,
        end_deg=2.0,
        font=font_arc,
        fill=red,
    )

    font_mid = _load_font(13)
    font_bot = _load_font(14)
    _draw_centered_line(draw, u'社保费缴纳清单', cx, cy + size * 0.12, font_mid, red)
    _draw_centered_line(draw, u'证明专用章', cx, cy + size * 0.24, font_bot, red)

    rgb = Image.new('RGB', (size, size), (255, 255, 255))
    rgb.paste(img, mask=img.split()[3])
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    rgb.save(out_path, 'PNG')
    return out_path


def main():
    path = make_gz_seal()
    print('wrote', path)
    os.makedirs(FRONTEND_IMG, exist_ok=True)
    shutil.copyfile(path, OUT_WEB)
    print('wrote', OUT_WEB)


if __name__ == '__main__':
    main()
