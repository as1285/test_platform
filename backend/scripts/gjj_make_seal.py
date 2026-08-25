#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成「杭州住房公积金管理中心 电子专用章」圆形红色印章 PNG（演示用）。

版式：外圈红环 + 中心五角星 + 上弧机构名（环绕）+ 下方「电子专用章」。
输出透明底 PNG，供 PDF（PyMuPDF）与 HTML 页复用。
用法：python3 gjj_make_seal.py [out.png]
"""
from __future__ import print_function

import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = os.path.join(HERE, '..', 'assets', 'sbdy', 'NotoSerifCJKsc-Regular.otf')
FONT_FALLBACKS = [
    FONT_PATH,
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc',
    '/usr/share/fonts/truetype/arphic/uming.ttc',
]

SIZE = 1000
CENTER = (SIZE / 2.0, SIZE / 2.0)
# 对齐真实样张：亮红（实测核心色 ≈ RGB 216,60,72），勿用暗深红
RED = (211, 56, 62, 255)

ARC_TEXT = '杭州住房公积金管理中心'
BOTTOM_TEXT = '电子专用章'


def load_font(size):
    for path in FONT_FALLBACKS:
        try:
            if os.path.isfile(path):
                return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def draw_star(draw, cx, cy, r_out, color):
    r_in = r_out * 0.400
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
        rot = 270.0 - a  # PIL 正角度逆时针；顶部直立、两侧沿切线
        paste_rotated_char(base, ch, font, x, y, rot, color)


def render(out_path):
    """尺寸比例均按真实样张实测（外径归一化）：
    环厚≈4.3%D，星外径≈0.45R，弧字从左下 145° 经顶到右下 385°，
    「电子专用章」中心位于圆心下方 0.59R。
    """
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = CENTER

    # 外圈红环（PIL outline 由外缘向内加厚）
    ring_r = SIZE / 2.0 - 8
    ring_w = 42
    draw.ellipse(
        [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
        outline=RED,
        width=ring_w,
    )

    # 中心五角星（真实样张星较大，约 0.45R）
    draw_star(draw, cx, cy, r_out=222, color=RED)

    # 弧形机构名：左下绕过顶部到右下（实测 145°-385°），字贴环内缘
    arc_font = load_font(132)
    draw_arc_text(img, ARC_TEXT, cx, cy, radius=ring_r - ring_w - 78, font=arc_font,
                  color=RED, a_start=145.0, a_end=385.0)

    # 下方「电子专用章」：中心位于圆心下方 0.59R
    bot_font = load_font(118)
    tb = draw.textbbox((0, 0), BOTTOM_TEXT, font=bot_font)
    tw = tb[2] - tb[0]
    th = tb[3] - tb[1]
    draw.text(
        (cx - tw / 2.0 - tb[0], cy + 0.59 * ring_r - th / 2.0 - tb[1]),
        BOTTOM_TEXT,
        font=bot_font,
        fill=RED,
    )

    img.save(out_path)
    print('saved', out_path, img.size)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'assets', 'gjj', 'seal.png')
    out = os.path.abspath(out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    render(out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
