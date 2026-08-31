#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""厦门市社会保险中心「业务专用章」（透明底）。

做法：以样张 PDF 内嵌的真实电子章为底（干净高清、真章字体、五角星、
「业务专用章」、底部编号全部保留），仅把顶部弧字从「厦门市同安区社会
保险中心」改成「厦门市社会保险中心」。真章底 + 顶弧重排，避免手绘失真。

底图来源：厦门市社会保险个人社保参保证明样张里 xref(RGB)+xref(SMask)
合成后的 assets/sbdy/xm_seal_base.png。
"""
from __future__ import print_function

import io
import math
import os
import shutil

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
FRONTEND_IMG = os.path.join(HERE, '..', '..', 'frontend', 'public', 'img')
BASE_PNG = os.path.join(ASSETS, 'xm_seal_base.png')
SAMPLE_PDF_CANDIDATES = [
    os.path.join(os.path.expanduser('~'), '厦门市社会保险个人社保参保证明20260831141656.pdf'),
    '/root/厦门市社会保险个人社保参保证明20260831141656.pdf',
]
RING = '厦门市社会保险中心'
MID = '业务专用章'
CODE = '3502006093204'
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


def ensure_base(size=1024):
    """从样张 PDF 抽出真实电子章底图（RGB+SMask 合成，透明底）。"""
    if os.path.isfile(BASE_PNG):
        img = Image.open(BASE_PNG).convert('RGBA')
        if img.size != (size, size):
            img = img.resize((size, size), Image.LANCZOS)
        return img
    import fitz

    pdf = next((p for p in SAMPLE_PDF_CANDIDATES if os.path.isfile(p)), None)
    if not pdf:
        raise SystemExit('missing sample PDF to extract seal base')
    doc = fitz.open(pdf)
    try:
        rgb_xref = mask_xref = None
        for i in range(1, doc.xref_length()):
            if doc.xref_get_key(i, 'Subtype')[1] != '/Image':
                continue
            cs = doc.xref_get_key(i, 'ColorSpace')[1]
            if cs == '/DeviceRGB':
                rgb_xref = i
            elif cs == '/DeviceGray':
                mask_xref = i
        rgb = Image.open(io.BytesIO(doc.extract_image(rgb_xref)['image'])).convert('RGBA')
        if mask_xref:
            mask = Image.open(io.BytesIO(doc.extract_image(mask_xref)['image'])).convert('L')
            if mask.size != rgb.size:
                mask = mask.resize(rgb.size, Image.BILINEAR)
            rgb.putalpha(mask)
        base = rgb.resize((size, size), Image.LANCZOS)
        base.save(BASE_PNG, 'PNG')
        return base
    finally:
        doc.close()


def median_ink(img):
    px = img.load()
    w, h = img.size
    rs = gs = bs = n = 0
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            r, g, b, a = px[x, y]
            if a > 150 and r > 120 and r - max(g, b) > 40:
                rs += r; gs += g; bs += b; n += 1
    if not n:
        return (223, 28, 24, 255)
    return (int(rs / n), int(gs / n), int(bs / n), 255)


def erase_all_text(img, r_lo=0.53, r_hi=0.905):
    """抹掉整条环内文字（顶弧、业务专用章、底部编号、残字），
    仅保留内部五角星(r<0.53R)与最外圈(r>0.905R)。文字全部重排，
    保证顶弧与业务专用章字体一致、干净。"""
    w, h = img.size
    cx = cy = w / 2.0
    R = w / 2.0
    px = img.load()
    lo = R * r_lo
    hi = R * r_hi
    for y in range(h):
        dy = y - cy
        for x in range(w):
            d = math.hypot(x - cx, y - cy)
            if lo <= d <= hi:
                px[x, y] = (0, 0, 0, 0)
    return img


def draw_center_text(img, text, color, y_ratio=0.712, size_ratio=0.108, gap_ratio=0.012):
    """业务专用章：星下方横排居中。"""
    w, h = img.size
    cx = w / 2.0
    font = _load_font(int(w * size_ratio))
    draw = ImageDraw.Draw(img)
    gap = w * gap_ratio
    widths = []
    total = 0.0
    for ch in text:
        b = draw.textbbox((0, 0), ch, font=font)
        cw = b[2] - b[0]
        widths.append((ch, cw, b))
        total += cw + gap
    total -= gap
    x = cx - total / 2.0
    yc = h * y_ratio
    sw = max(2, int(font.size * 0.06))
    for ch, cw, b in widths:
        ch_h = b[3] - b[1]
        draw.text((x - b[0], yc - ch_h / 2.0 - b[1]), ch, font=font,
                  fill=color, stroke_width=sw, stroke_fill=color)
        x += cw + gap
    return img


def draw_bottom_number(img, text, color, radius_ratio=0.845, span_deg=112.0,
                       size_ratio=0.05):
    """底部编号：沿下弧排布（字底朝圆心）。"""
    w, h = img.size
    cx = cy = w / 2.0
    R = w / 2.0
    radius = R * radius_ratio
    font = _load_font(int(w * size_ratio))
    n = max(1, len(text))
    start = math.radians(90.0 + span_deg / 2.0)
    end = math.radians(90.0 - span_deg / 2.0)
    for i, ch in enumerate(text):
        t = i / float(max(1, n - 1))
        theta = start + (end - start) * t
        rx = cx + radius * math.cos(theta)
        ry = cy + radius * math.sin(theta)
        side = int(font.size * 2.8)
        ch_img = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        cd = ImageDraw.Draw(ch_img)
        cb = cd.textbbox((0, 0), ch, font=font)
        tw = cb[2] - cb[0]
        th = cb[3] - cb[1]
        cd.text(((side - tw) / 2.0 - cb[0], (side - th) / 2.0 - cb[1]), ch,
                font=font, fill=color, stroke_width=1, stroke_fill=color)
        rot = -(math.degrees(theta) + 90.0) + 180.0
        ch_rot = ch_img.rotate(rot, expand=True, resample=Image.BICUBIC)
        img.alpha_composite(ch_rot, (int(rx - ch_rot.width / 2.0), int(ry - ch_rot.height / 2.0)))
    return img


def draw_arc_text(img, text, color, radius_ratio=0.735, start_deg=-165.0, end_deg=-15.0):
    w, h = img.size
    cx = cy = w / 2.0
    R = w / 2.0
    radius = R * radius_ratio
    font = _load_font(int(w * 0.118))
    n = max(1, len(text))
    start = math.radians(start_deg)
    end = math.radians(end_deg)
    sw = max(3, int(font.size * 0.07))
    for i, ch in enumerate(text):
        t = i / float(max(1, n - 1))
        theta = start + (end - start) * t
        rx = cx + radius * math.cos(theta)
        ry = cy + radius * math.sin(theta)
        side = int(font.size * 2.6)
        ch_img = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        cd = ImageDraw.Draw(ch_img)
        cb = cd.textbbox((0, 0), ch, font=font)
        tw = cb[2] - cb[0]
        th = cb[3] - cb[1]
        cd.text(
            ((side - tw) / 2.0 - cb[0], (side - th) / 2.0 - cb[1]),
            ch, font=font, fill=color, stroke_width=sw, stroke_fill=color,
        )
        rot = -(math.degrees(theta) + 90.0)
        ch_rot = ch_img.rotate(rot, expand=True, resample=Image.BICUBIC)
        img.alpha_composite(ch_rot, (int(rx - ch_rot.width / 2.0), int(ry - ch_rot.height / 2.0)))
    return img


def make_xm_seal(out_path, size=1024):
    base = ensure_base(size)
    ink = median_ink(base)
    seal = base.copy()
    erase_all_text(seal)
    draw_arc_text(seal, RING, ink)
    draw_center_text(seal, MID, ink)
    draw_bottom_number(seal, CODE, ink)
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    seal.save(out_path, 'PNG')
    return out_path


def publish(src):
    os.makedirs(ASSETS, exist_ok=True)
    os.makedirs(FRONTEND_IMG, exist_ok=True)
    dst = os.path.join(ASSETS, 'xm_seal.png')
    if os.path.abspath(src) != os.path.abspath(dst):
        shutil.copyfile(src, dst)
    shutil.copyfile(src, os.path.join(FRONTEND_IMG, 'sbdy_xm_seal.png'))
    print('wrote', dst)
    print('wrote', os.path.join(FRONTEND_IMG, 'sbdy_xm_seal.png'))


def main():
    out = os.path.join(ASSETS, 'xm_seal.png')
    make_xm_seal(out)
    publish(out)


if __name__ == '__main__':
    main()
