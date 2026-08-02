#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""管理后台 · 离职证明演示 PDF（高分栅格正文 + 清晰公章，嵌入 A4 PDF）。"""
from __future__ import print_function

import json
import math
import os
import sys
import tempfile

import fitz
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
NOTO_SERIF = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc'
NOTO_SANS_BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
PAGE_W, PAGE_H = 595.32, 841.92


def get_serif(px):
    for path, idx in (
        (os.path.join(HERE, '..', 'assets', 'sbdy', 'NotoSerifCJKsc-Regular.otf'), 0),
        (NOTO_SERIF, 2),
        (NOTO_SERIF, 0),
    ):
        if not os.path.isfile(path):
            continue
        try:
            return ImageFont.truetype(path, px, index=idx)
        except Exception:
            try:
                return ImageFont.truetype(path, px)
            except Exception:
                pass
    return ImageFont.load_default()


def get_seal_font(px):
    """优先简体 CJK（ttc index=2）+ Black/Bold，印章笔画更清晰。"""
    candidates = (
        ('/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc', 2),
        (NOTO_SANS_BOLD, 2),
        (NOTO_SANS_BOLD, 0),
        ('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc', 2),
        (os.path.join(HERE, '..', 'assets', 'sbdy', 'NotoSerifCJKsc-Regular.otf'), 0),
        (NOTO_SERIF, 2),
        (NOTO_SERIF, 0),
    )
    for path, idx in candidates:
        if not os.path.isfile(path):
            continue
        try:
            font = ImageFont.truetype(path, size=px, index=idx)
            bb = ImageDraw.Draw(Image.new('L', (8, 8))).textbbox((0, 0), '公章', font=font)
            if bb[2] - bb[0] > 8:
                return font
        except Exception:
            try:
                return ImageFont.truetype(path, size=px)
            except Exception:
                pass
    return ImageFont.load_default()


def make_seal(company):
    SS = 2200
    RED = (196, 18, 18, 255)
    seal = Image.new('RGBA', (SS, SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(seal)
    c = SS / 2.0
    R_out, R_in = SS * 0.455, SS * 0.418
    d.ellipse([c - R_out, c - R_out, c + R_out, c + R_out], outline=RED, width=28)
    d.ellipse([c - R_in, c - R_in, c + R_in, c + R_in], outline=RED, width=13)

    def star(cx, cy, ro, ri, rot=-math.pi / 2):
        pts = []
        for i in range(10):
            a = rot + i * math.pi / 5
            rr = ro if i % 2 == 0 else ri
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        return pts

    chars = list((company or '北京外企市场营销顾问有限公司西安分公司').strip()) or list('专用章')
    n = len(chars)
    # 上弧跨度：短名收在顶部、长名展到约半圈
    if n <= 4:
        arc_deg = 100.0
    elif n <= 8:
        arc_deg = 112.0 + (n - 4) * 7.0
    elif n <= 14:
        arc_deg = 150.0 + (n - 8) * 7.0
    else:
        arc_deg = min(230.0, 195.0 + (n - 14) * 2.5)

    # 略靠内，避免笔画压到内圈
    text_r = (R_out + R_in) / 2.0 * 0.94
    arc_len = math.radians(arc_deg) * text_r
    font_size = int(max(70, min(arc_len / n * 0.82, 128)))
    font = get_seal_font(font_size)

    # 等角分布（公章常用），从左到右沿上弧
    for i, ch in enumerate(chars):
        ang_deg = 90.0 + arc_deg / 2.0 - (arc_deg * (i + 0.5) / n)
        ang = math.radians(ang_deg)
        # 固定画布绕中心旋转，避免 expand=True 导致字心漂移/重叠
        pad = font_size * 3
        g = Image.new('RGBA', (pad, pad), (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        bb = gd.textbbox((0, 0), ch, font=font)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        gx = (pad - tw) / 2.0 - bb[0]
        gy = (pad - th) / 2.0 - bb[1]
        gd.text((gx, gy), ch, font=font, fill=RED)
        # 字头朝外、字脚朝圆心
        rot = ang_deg - 90.0
        g = g.rotate(rot, resample=Image.Resampling.BICUBIC, center=(pad / 2.0, pad / 2.0), expand=False)
        x = c + text_r * math.cos(ang)
        y = c - text_r * math.sin(ang)
        seal.alpha_composite(g, (int(round(x - pad / 2.0)), int(round(y - pad / 2.0))))

    d = ImageDraw.Draw(seal)
    d.polygon(star(c, c, SS * 0.125, SS * 0.048), fill=RED)
    foot = '专用章'
    foot_font = get_seal_font(max(52, int(font_size * 0.55)))
    fbb = d.textbbox((0, 0), foot, font=foot_font)
    fw, fh = fbb[2] - fbb[0], fbb[3] - fbb[1]
    d.text((c - fw / 2 - fbb[0], c + SS * 0.22 - fh / 2 - fbb[1]), foot, font=foot_font, fill=RED)
    d.ellipse([c - R_out, c - R_out, c + R_out, c + R_out], outline=RED, width=28)
    d.ellipse([c - R_in, c - R_in, c + R_in, c + R_in], outline=RED, width=13)
    return seal.resize((1400, 1400), Image.Resampling.LANCZOS)


def render_page(payload):
    name = str(payload.get('name') or '').strip() or '王嵩嵩'
    id_number = str(payload.get('id_number') or '').strip() or '610404199112165515'
    hire_date = str(payload.get('hire_date') or '').strip() or '2025/12/15'
    leave_date = str(payload.get('leave_date') or '').strip() or '2026/7/10'
    issue_date = str(payload.get('issue_date') or '').strip() or '2026 年 7 月 13 日'
    company = (
        str(payload.get('company_name') or payload.get('company') or '').strip()
        or '北京外企市场营销顾问有限公司西安分公司'
    )
    note = str(payload.get('note') or '').strip() or '注：此证明只开具一份，遗失不补。'

    DPI = 220
    W = int(210 / 25.4 * DPI)
    H = int(297 / 25.4 * DPI)
    scale = DPI / 72.0
    img = Image.new('RGB', (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    def measure(text, font):
        b = draw.textbbox((0, 0), text, font=font)
        return b[2] - b[0], b[3] - b[1]

    def draw_text(x, y, text, font, fill=(0, 0, 0)):
        draw.text((x, y), text, font=font, fill=fill)
        return measure(text, font)[0]

    def draw_ul(x, y, text, font, fill=(0, 0, 0)):
        w = draw_text(x, y, text, font, fill)
        b = draw.textbbox((x, y), text, font=font)
        uy = b[3] + max(2, int(1.1 * scale))
        draw.line([(x, uy), (x + w, uy)], fill=fill, width=max(2, int(0.85 * scale)))
        return w

    title_font = get_serif(int(22 * scale))
    body = get_serif(int(14 * scale))
    note_font = get_serif(int(11 * scale))
    demo_font = get_serif(int(10 * scale))

    title = '离职证明'
    tw, _ = measure(title, title_font)
    draw_text((W - tw) / 2, int(70 * scale), title, title_font)

    left = int(72 * scale)
    y1 = int(145 * scale)
    x = left + int(28 * scale)
    for text, ul in [
        ('兹证明', False),
        ('   ', False),
        (name, True),
        ('     ', False),
        ('（身份证号码：', False),
        (id_number, True),
        (' ）自', False),
    ]:
        x += draw_ul(x, y1, text, body) if ul else draw_text(x, y1, text, body)

    y2 = int(180 * scale)
    x = left + int(6 * scale)
    for text, ul in [
        (hire_date, True),
        ('     开始在我司任职，  ', False),
        (leave_date, True),
        ('  与我司劳动关系解除。', False),
    ]:
        x += draw_ul(x, y2, text, body) if ul else draw_text(x, y2, text, body)

    draw_text(left + int(28 * scale), int(215 * scale), '特此证明。', body)

    # 落款：公司名在章上方、日期在章下方，避免透进章心看起来「章不对」
    right = int(62 * scale)
    seal_px = int(148 * scale)
    seal = make_seal(company)
    stamp = seal.resize((seal_px, seal_px), Image.Resampling.LANCZOS)
    sa = stamp.split()[-1].point(lambda v: int(v * 0.94))
    stamp.putalpha(sa)

    cw, ch = measure(company, body)
    dw, dh = measure(issue_date, body)
    sx = int(W - right - seal_px + 8 * scale)
    sy = int(268 * scale)
    # 公司名压在章顶内侧上方（章外），日期在章底外侧
    company_x = min(W - right - cw, sx + (seal_px - cw) / 2)
    company_y = sy - ch - int(10 * scale)
    date_x = min(W - right - dw, sx + (seal_px - dw) / 2)
    date_y = sy + seal_px + int(14 * scale)

    draw_text(company_x, company_y, company, body)
    img.paste(stamp, (int(sx), int(sy)), stamp)
    draw_text(date_x, date_y, issue_date, body)

    note_y = int(max(date_y + dh + 36 * scale, 430 * scale))
    draw_text(int(50 * scale), note_y, note, note_font)
    draw_text(int(50 * scale), note_y + int(22 * scale), '（演示样例，非正式离职证明）', demo_font)
    return img


def render(payload, out_pdf):
    img = render_page(payload or {})
    tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
    tmp_path = tmp.name
    tmp.close()
    try:
        img.save(tmp_path, optimize=True)
        doc = fitz.open()
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        page.insert_image(page.rect, filename=tmp_path)
        doc.save(out_pdf, garbage=4, deflate=True, deflate_images=True)
        doc.close()
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


def main():
    if len(sys.argv) < 3:
        print('usage: lizhi_render_pdf.py in.json out.pdf', file=sys.stderr)
        sys.exit(2)
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)
    payload = data.get('payload') if isinstance(data, dict) else data
    if not isinstance(payload, dict):
        payload = {}
    render(payload, sys.argv[2])
    print('ok')


if __name__ == '__main__':
    main()
