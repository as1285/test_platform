#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""深圳新参保证明双章：优先从样张直接扣红章（透明底、硬边清晰）。

源图（官方下载件同款清晰章）：
  assets/sbdy/sz_new_si_seal_user_src.png
  assets/sbdy/sz_new_mi_seal_user_src.png

章面不写日期；PDF/HTML 在章上方写机构名、章心叠黑色打印日期。
源图过小（手机截图像素不足）时，用完整 CJK 宋体按官方版式矢量重绘兜底。
"""
from __future__ import print_function

import math
import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
FRONTEND_IMG = os.path.join(HERE, '..', '..', 'frontend', 'public', 'img')

SI_SRC = os.path.join(ASSETS, 'sz_new_si_seal_user_src.png')
MI_SRC = os.path.join(ASSETS, 'sz_new_mi_seal_user_src.png')

SIZE = 1024
# 官方朱红
RED = (210, 42, 42, 255)

# 仓库内 SimSun.ttf 缺「深/圳/金/理/局」等字，不能当印章正文字体
FONT_CANDIDATES = [
    os.path.join(ASSETS, 'NotoSerifCJKsc-Regular.otf'),
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSerifCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
]


def _font_covers(path, sample='深圳市社会保险基金管理局医疗与生育'):
    try:
        font = ImageFont.truetype(path, size=48, index=0)
        for ch in sample:
            bb = font.getbbox(ch)
            if not bb or (bb[3] - bb[1]) < 8:
                return False
        return True
    except Exception:
        return False


def load_font(size):
    for path in FONT_CANDIDATES:
        if not os.path.isfile(path):
            continue
        if not _font_covers(path):
            continue
        try:
            return ImageFont.truetype(path, size=size, index=0)
        except Exception:
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def _is_seal_ink(r, g, b):
    if r < 95:
        return False
    if r <= g + 22 or r <= b + 22:
        return False
    if min(g, b) > 175 and (r - min(g, b)) < 50:
        return False
    return True


def _ink_alpha(r, g, b):
    strength = (r - max(g, b)) + max(0, r - 140) * 0.4
    return max(0, min(255, int(strength * 3.6)))


def _extract_seal(im_rgb):
    im = im_rgb.convert('RGB')
    w, h = im.size
    px = im.load()
    red = []
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if _is_seal_ink(r, g, b):
                red.append((x, y))
    if len(red) < 40:
        raise RuntimeError('source image has no red seal pixels')
    xs = [p[0] for p in red]
    ys = [p[1] for p in red]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    cx0 = (minx + maxx) / 2.0
    cy0 = (miny + maxy) / 2.0
    half = max(maxx - minx, maxy - miny) / 2.0 + 2
    minx = int(max(0, cx0 - half))
    maxx = int(min(w - 1, cx0 + half))
    miny = int(max(0, cy0 - half))
    maxy = int(min(h - 1, cy0 + half))
    crop = im.crop((minx, miny, maxx + 1, maxy + 1)).convert('RGBA')
    cw, ch = crop.size
    cp = crop.load()
    for y in range(ch):
        for x in range(cw):
            r, g, b, _a = cp[x, y]
            if not _is_seal_ink(r, g, b):
                cp[x, y] = (0, 0, 0, 0)
                continue
            a = _ink_alpha(r, g, b)
            if a < 24:
                cp[x, y] = (0, 0, 0, 0)
            else:
                cp[x, y] = (210, 42, 42, a)

    cx, cy = cw / 2.0, ch / 2.0
    rs = [
        math.hypot(x - cx, y - cy)
        for y in range(ch)
        for x in range(cw)
        if cp[x, y][3] > 50
    ]
    R = (sorted(rs)[int(len(rs) * 0.992)] + 0.5) if rs else min(cw, ch) / 2.0
    for y in range(ch):
        for x in range(cw):
            d = math.hypot(x - cx, y - cy)
            r, g, b, a = cp[x, y]
            if d > R + 0.6:
                cp[x, y] = (0, 0, 0, 0)
            elif d > R:
                cp[x, y] = (r, g, b, int(a * 0.12))
    return crop


def _clear_date_band(im):
    """清掉样张中心日期，留给渲染层动态叠印。"""
    w, h = im.size
    px = im.load()
    cx, cy = w / 2.0, h / 2.0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # 中心横条：原章日期所在带
            if abs(y - cy) < h * 0.055 and abs(x - cx) < w * 0.38:
                px[x, y] = (0, 0, 0, 0)
            elif abs(y - cy) < h * 0.08 and abs(x - cx) < w * 0.32 and a < 200:
                px[x, y] = (0, 0, 0, 0)
    return im


def _harden(im, alpha_cut=48):
    """硬边：半透明印泥收成实心朱红，去掉灰晕；阈值宜低以免吃掉宋体细笔。"""
    px = im.load()
    w, h = im.size
    cx, cy = w / 2.0, h / 2.0
    strong = [
        math.hypot(x - cx, y - cy)
        for y in range(h)
        for x in range(w)
        if px[x, y][3] >= 100
    ]
    R = sorted(strong)[int(len(strong) * 0.995)] if strong else min(w, h) / 2.0 - 2
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = math.hypot(x - cx, y - cy)
            if a < alpha_cut or d > R + 1.5:
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (210, 42, 42, 255)
    return im


def _scrub_noise(im):
    """去掉孤立噪点（不做大面积腐蚀，避免伤细笔）。"""
    px = im.load()
    w, h = im.size
    snap = im.copy()
    sp = snap.load()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if sp[x, y][3] == 0:
                continue
            n = 0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    if sp[x + dx, y + dy][3] >= 200:
                        n += 1
            if n < 1:
                px[x, y] = (0, 0, 0, 0)
    return im


def make_from_user_src(src_path, out_path, size=512):
    """直接扣运营清晰章：保留原始朱红与抗锯齿，单次干净放大到 512（PDF/retina HTML 均足够），
    不做二值硬边、不做 unsharp，避免把宋体细笔啃糊或缩放两次发虚。"""
    crop = _extract_seal(Image.open(src_path))
    crop = _clear_date_band(crop)
    # 单次干净放大；不再 unsharp/硬边
    out = crop.resize((int(size), int(size)), Image.Resampling.LANCZOS)
    out = _clear_date_band(out)
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    out.save(out_path, 'PNG')
    return out_path


def paste_rotated_char(base, ch, font, x, y, rot_deg, color):
    pad = 12
    bbox = font.getbbox(ch)
    w = (bbox[2] - bbox[0]) + pad * 2
    h = (bbox[3] - bbox[1]) + pad * 2
    tile = Image.new('RGBA', (int(w), int(h)), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile)
    td.text(
        (pad - bbox[0], pad - bbox[1]),
        ch,
        font=font,
        fill=color,
        stroke_width=1,
        stroke_fill=color,
    )
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


def render_seal_vector(arc_text, line1, line2, out_path, size=SIZE):
    """样张缺失/过小时的宋体矢量章（版式对齐官方：无星、双圈、底两行、中心留白给日期）。"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx = cy = size / 2.0
    ring_r = size / 2.0 - 12
    ring_w = max(22, int(size * 0.032))
    # 外圈实心环 + 内细圈（官方双线；内圈略往里以免硬边吃掉）
    draw.ellipse(
        [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
        outline=RED,
        width=ring_w,
    )
    inner_r = ring_r - ring_w - 4
    draw.ellipse(
        [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
        outline=RED,
        width=max(6, int(size * 0.008)),
    )
    n = len(arc_text)
    arc_font = load_font(int(size * (0.072 if n > 13 else 0.082)))
    # 弧字跨上半圈两侧，接近官方样张
    a0, a1 = (152.0, 388.0) if n <= 13 else (148.0, 392.0)
    draw_arc_text(
        img,
        arc_text,
        cx,
        cy,
        radius=ring_r - ring_w - int(size * 0.048),
        font=arc_font,
        color=RED,
        a_start=a0,
        a_end=a1,
    )
    bot_font = load_font(int(size * 0.058))
    y0 = cy + size * 0.16
    for i, line in enumerate([line1, line2]):
        tb = draw.textbbox((0, 0), line, font=bot_font)
        tw = tb[2] - tb[0]
        th = tb[3] - tb[1]
        # 轻微描边加粗，印泥感更实、缩小时更清晰
        xy = (cx - tw / 2.0 - tb[0], y0 + i * (th + size * 0.014) - tb[1])
        draw.text(xy, line, font=bot_font, fill=RED, stroke_width=1, stroke_fill=RED)
    # 轻量硬边：保留细笔，去掉最淡的灰边
    img = _harden(img, alpha_cut=36)
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    img.save(out_path, 'PNG')
    return out_path


def copy_frontend(src, name):
    os.makedirs(FRONTEND_IMG, exist_ok=True)
    dst = os.path.join(FRONTEND_IMG, name)
    shutil.copyfile(src, dst)
    print('wrote', dst)


def _src_too_small(src_path, min_side=120):
    try:
        w, h = Image.open(src_path).size
        return min(w, h) < min_side
    except Exception:
        return True


def build_one(src_path, out_name, arc, line1, line2):
    """优先直接用运营提供的清晰章图（第二张白底双章）；源图存在即扣章，不再改画矢量。"""
    out = os.path.join(ASSETS, out_name)
    if os.path.isfile(src_path) and not _src_too_small(src_path):
        make_from_user_src(src_path, out)
        print('wrote (from photo)', out)
    else:
        render_seal_vector(arc, line1, line2, out)
        print('wrote (vector fallback)', out)
    return out


def main():
    # 文案/版式对齐用户提供的官方参保证明截图双章
    si = build_one(
        SI_SRC,
        'sz_new_si_seal.png',
        '深圳市社会保险基金管理局',
        '社保费缴纳清单',
        '证明专用章',
    )
    mi = build_one(
        MI_SRC,
        'sz_new_mi_seal.png',
        '深圳市医疗保险基金管理中心',
        '医疗与生育保险',
        '业务专用章',
    )
    try:
        copy_frontend(si, 'sbdy_sz_new_si_seal.png')
        copy_frontend(mi, 'sbdy_sz_new_mi_seal.png')
    except Exception as e:
        print('copy to frontend failed:', e)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
