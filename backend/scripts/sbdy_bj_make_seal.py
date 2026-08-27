#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成北京社保个人权益记录用的两枚红色公章（透明底 PNG）。

1. 北京市社会保险基金管理中心 / 业务专用章
2. 北京市医疗保险事务管理中心 / 个人权益专用章
"""
from __future__ import print_function

import math
import os
import shutil
import sys

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

SIZE = 1000
RED = (211, 56, 62, 255)


def load_font(size):
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


def draw_star(draw, cx, cy, r_out, color):
    r_in = r_out * 0.40
    pts = []
    for k in range(5):
        a_out = math.radians(-90 + k * 72)
        pts.append((cx + r_out * math.cos(a_out), cy + r_out * math.sin(a_out)))
        a_in = math.radians(-90 + k * 72 + 36)
        pts.append((cx + r_in * math.cos(a_in), cy + r_in * math.sin(a_in)))
    draw.polygon(pts, fill=color)


def paste_rotated_char(base, ch, font, x, y, rot_deg, color):
    pad = 8
    bbox = font.getbbox(ch)
    w = (bbox[2] - bbox[0]) + pad * 2
    h = (bbox[3] - bbox[1]) + pad * 2
    tile = Image.new('RGBA', (int(w), int(h)), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile)
    td.text((pad - bbox[0], pad - bbox[1]), ch, font=font, fill=color)
    rot = tile.rotate(rot_deg, expand=True, resample=Image.BICUBIC)
    base.alpha_composite(rot, (int(x - rot.width / 2.0), int(y - rot.height / 2.0)))


def draw_arc_text(base, text, cx, cy, radius, font, color, a_start, a_end):
    n = len(text)
    if n == 0:
        return
    for i, ch in enumerate(text):
        a = a_start + (a_end - a_start) * (i + 0.5) / n
        rad = math.radians(a)
        x = cx + radius * math.cos(rad)
        y = cy + radius * math.sin(rad)
        rot = 270.0 - a
        paste_rotated_char(base, ch, font, x, y, rot, color)


def render_seal(arc_text, bottom_text, code_text, out_path):
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx = cy = SIZE / 2.0
    ring_r = SIZE / 2.0 - 10
    ring_w = 40
    draw.ellipse(
        [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
        outline=RED,
        width=ring_w,
    )
    draw_star(draw, cx, cy, r_out=168, color=RED)
    arc_font = load_font(78 if len(arc_text) > 13 else 88)
    draw_arc_text(
        img,
        arc_text,
        cx,
        cy,
        radius=ring_r - ring_w - 62,
        font=arc_font,
        color=RED,
        a_start=145.0,
        a_end=385.0,
    )
    bot_font = load_font(72 if len(bottom_text) > 5 else 86)
    tb = draw.textbbox((0, 0), bottom_text, font=bot_font)
    tw = tb[2] - tb[0]
    th = tb[3] - tb[1]
    draw.text(
        (cx - tw / 2.0 - tb[0], cy + 0.42 * ring_r - th / 2.0 - tb[1]),
        bottom_text,
        font=bot_font,
        fill=RED,
    )
    if code_text:
        code_font = load_font(36)
        cb = draw.textbbox((0, 0), code_text, font=code_font)
        cw = cb[2] - cb[0]
        ch = cb[3] - cb[1]
        draw.text(
            (cx - cw / 2.0 - cb[0], cy + 0.68 * ring_r - ch / 2.0 - cb[1]),
            code_text,
            font=code_font,
            fill=RED,
        )
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    img.save(out_path, 'PNG')
    print('wrote', out_path)


def copy_frontend(src, name):
    os.makedirs(FRONTEND_IMG, exist_ok=True)
    dst = os.path.join(FRONTEND_IMG, name)
    shutil.copyfile(src, dst)
    print('wrote', dst)


def main():
    si = os.path.join(ASSETS, 'bj_si_seal.png')
    mi = os.path.join(ASSETS, 'bj_mi_seal.png')
    render_seal('北京市社会保险基金管理中心', '业务专用章', '1100000123456', si)
    render_seal('北京市医疗保险事务管理中心', '个人权益专用章', '1100000654321', mi)
    try:
        copy_frontend(si, 'sbdy_bj_si_seal.png')
        copy_frontend(mi, 'sbdy_bj_mi_seal.png')
    except Exception as e:
        print('copy to frontend failed:', e)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
