#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成「深圳新」参保证明用的两枚红色电子章（透明底 PNG，演示品质）。

1. 深圳市社会保险基金管理局 / 社保费缴纳清单证明专用章
2. 深圳市医疗保障基金管理中心 / 医疗与生育保险业务专用章

日期在 HTML/PDF 渲染时叠印，章面本身不写死日期。
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
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttf',
    '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
    '/usr/share/fonts/truetype/arphic/uming.ttc',
]

SIZE = 1000
RED = (196, 48, 52, 255)


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


def render_seal(arc_text, bottom_text, out_path):
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx = cy = SIZE / 2.0
    ring_r = SIZE / 2.0 - 10
    ring_w = 38
    draw.ellipse(
        [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
        outline=RED,
        width=ring_w,
    )
    draw.ellipse(
        [cx - ring_r + 52, cy - ring_r + 52, cx + ring_r - 52, cy + ring_r - 52],
        outline=RED,
        width=8,
    )
    draw_star(draw, cx, cy - 36, r_out=148, color=RED)
    arc_font = load_font(72 if len(arc_text) > 13 else 82)
    draw_arc_text(
        img,
        arc_text,
        cx,
        cy,
        radius=ring_r - ring_w - 58,
        font=arc_font,
        color=RED,
        a_start=148.0,
        a_end=392.0,
    )
    # 底部专用章名：较长时两行
    if len(bottom_text) > 8:
        mid = max(4, len(bottom_text) // 2)
        # 尽量在「证明 / 业务」附近断行
        for cut in (7, 8, 6, 9, mid):
            if 4 <= cut < len(bottom_text):
                mid = cut
                break
        lines = [bottom_text[:mid], bottom_text[mid:]]
    else:
        lines = [bottom_text]
    bot_font = load_font(54 if len(bottom_text) > 8 else 68)
    y0 = cy + 0.38 * ring_r
    for i, line in enumerate(lines):
        tb = draw.textbbox((0, 0), line, font=bot_font)
        tw = tb[2] - tb[0]
        th = tb[3] - tb[1]
        draw.text(
            (cx - tw / 2.0 - tb[0], y0 + i * (th + 6) - th / 2.0 - tb[1]),
            line,
            font=bot_font,
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
    si = os.path.join(ASSETS, 'sz_new_si_seal.png')
    mi = os.path.join(ASSETS, 'sz_new_mi_seal.png')
    render_seal('深圳市社会保险基金管理局', '社保费缴纳清单证明专用章', si)
    render_seal('深圳市医疗保障基金管理中心', '医疗与生育保险业务专用章', mi)
    try:
        copy_frontend(si, 'sbdy_sz_new_si_seal.png')
        copy_frontend(mi, 'sbdy_sz_new_mi_seal.png')
    except Exception as e:
        print('copy to frontend failed:', e)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
