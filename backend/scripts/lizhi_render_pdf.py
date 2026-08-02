#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""离职证明 PDF：矢量正文（PyMuPDF 内置 china-s CID）+ 透明印章 PNG。

参考方向（GitHub）：
- certificate-generator / pdf-lib：正文为真实矢量字，不整页栅格化
- file_stamp：印章以透明 PNG 叠加，不压扁正文层

字体选用 china-s（简体宋体 CID）：不嵌入整包 Noto，文件小、中文可复制、字形正确。
"""
from __future__ import print_function

import json
import math
import os
import sys
import tempfile

import fitz
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
NOTO_SANS_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
PAGE_W, PAGE_H = 595.32, 841.92  # A4 pt
MARGIN_L = 72.0
MARGIN_R = 72.0
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R
BODY_FONT = "china-s"  # 简体宋体 CID，不嵌入大字体文件


def _first_existing(*paths):
    for p in paths:
        if p and os.path.isfile(p):
            return p
    return None


def font_path_seal():
    return _first_existing(
        "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc",
        os.path.join(HERE, "..", "assets", "sbdy", "NotoSerifCJKsc-Regular.otf"),
        NOTO_SANS_BOLD,
        "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
    )


def load_pil_font(path, px, prefer_index=2):
    if not path:
        return ImageFont.load_default()
    for idx in (prefer_index, 0, 1, 3):
        try:
            return ImageFont.truetype(path, size=px, index=idx)
        except Exception:
            continue
    try:
        return ImageFont.truetype(path, size=px)
    except Exception:
        return ImageFont.load_default()


def _draw_pentagram(draw, cx, cy, outer_r, inner_r, fill):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = outer_r if i % 2 == 0 else inner_r
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    draw.polygon(pts, fill=fill)


def make_seal(company):
    """生成接近常见公章样式的圆形印章 PNG（正圆裁切）。"""
    SS = 1600
    RED = (200, 16, 21, 255)
    seal = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(seal)
    c = SS / 2.0

    # 常规企业公章：单层较粗外圆
    R = SS * 0.46
    ring_w = max(28, int(SS * 0.028))

    chars = list((company or "专用章").strip()) or list("专用章")
    if len(chars) > 20:
        chars = chars[:20]
    n = len(chars)

    if n <= 4:
        arc_deg = 72.0 + n * 6.0
    elif n <= 8:
        arc_deg = 120.0 + (n - 4) * 7.0
    elif n <= 14:
        arc_deg = 155.0 + (n - 8) * 6.0
    else:
        arc_deg = min(210.0, 190.0 + (n - 14) * 2.5)

    # 文字必须落在圆环内侧，留出环宽 + 字高余量
    font_size = 90
    arc_len = math.radians(arc_deg) * (R - ring_w - font_size * 0.55)
    font_size = int(max(56, min(arc_len / max(n, 1) * 0.85, 108)))
    font = load_pil_font(font_path_seal(), font_size, prefer_index=0)
    text_r = R - ring_w - font_size * 0.72

    for i, ch in enumerate(chars):
        ang_deg = 90.0 + arc_deg / 2.0 - (arc_deg * (i + 0.5) / n)
        ang = math.radians(ang_deg)
        pad = font_size * 3
        g = Image.new("RGBA", (pad, pad), (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        bb = gd.textbbox((0, 0), ch, font=font)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        gx = (pad - tw) / 2.0 - bb[0]
        gy = (pad - th) / 2.0 - bb[1]
        gd.text((gx, gy), ch, font=font, fill=RED)
        rot = ang_deg - 90.0
        g = g.rotate(rot, resample=Image.Resampling.BICUBIC, center=(pad / 2.0, pad / 2.0), expand=False)
        x = c + text_r * math.cos(ang)
        y = c - text_r * math.sin(ang)
        seal.alpha_composite(g, (int(round(x - pad / 2.0)), int(round(y - pad / 2.0))))

    d = ImageDraw.Draw(seal)
    _draw_pentagram(d, c, c, SS * 0.100, SS * 0.040, RED)

    foot = "专用章"
    foot_font = load_pil_font(font_path_seal(), max(46, int(font_size * 0.55)), prefer_index=0)
    fbb = d.textbbox((0, 0), foot, font=foot_font)
    fw, fh = fbb[2] - fbb[0], fbb[3] - fbb[1]
    d.text(
        (c - fw / 2 - fbb[0], c + SS * 0.200 - fh / 2 - fbb[1]),
        foot,
        font=foot_font,
        fill=RED,
    )

    # 最后只画一次外圆，避免二次描边产生“双环”错觉
    d.ellipse([c - R, c - R, c + R, c + R], outline=RED, width=ring_w)

    pad_px = int(ring_w * 0.55)
    box = [
        int(c - R - pad_px),
        int(c - R - pad_px),
        int(c + R + pad_px),
        int(c + R + pad_px),
    ]
    cropped = seal.crop(box)
    side = cropped.size[0]
    # 圆形蒙版略大于外环，避免裁切出双边缘
    mask = Image.new("L", (side, side), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([0, 0, side - 1, side - 1], fill=255)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(cropped, (0, 0), mask)
    return out.resize((720, 720), Image.Resampling.LANCZOS)


def make_watermark_png():
    """单张斜向水印图，重复盖印，避免嵌入大字体。"""
    W, H = 420, 220
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = load_pil_font(font_path_seal(), 54, prefer_index=2)
    text = "演示样例"
    bb = d.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((W - tw) / 2 - bb[0], (H - th) / 2 - bb[1]), text, font=font, fill=(180, 180, 180, 70))
    return img.rotate(30, resample=Image.Resampling.BICUBIC, expand=True)


class LayoutFont(object):
    def __init__(self, fontname):
        self.name = fontname

    def width(self, text, size):
        try:
            return float(fitz.get_text_length(text or "", fontname=self.name, fontsize=size))
        except Exception:
            return len(text or "") * size * 0.55


def draw_run(page, x, y, text, font, size, underline=False, color=(0, 0, 0)):
    text = text or ""
    if not text:
        return x
    page.insert_text(
        fitz.Point(x, y),
        text,
        fontname=font.name,
        fontsize=size,
        color=color,
    )
    w = font.width(text, size)
    if underline:
        uy = y + max(1.6, size * 0.18)
        page.draw_line(fitz.Point(x, uy), fitz.Point(x + w, uy), color=color, width=0.75)
    return x + w


def wrap_company_lines(company, font, size, max_w):
    company = (company or "").strip()
    if font.width(company, size) <= max_w:
        return [company]
    # 优先在常见公司名边界断开，避免「顾|问」这类硬切
    prefer_cuts = []
    for token in ("分公司", "有限公司", "股份有限公司", "有限责任公司", "公司"):
        idx = company.find(token)
        while idx >= 0:
            cut = idx + len(token)
            if 0 < cut < len(company):
                prefer_cuts.append(cut)
            idx = company.find(token, idx + 1)
    for cut in sorted(set(prefer_cuts)):
        a, b = company[:cut], company[cut:]
        if font.width(a, size) <= max_w and font.width(b, size) <= max_w:
            return [a, b]
    best = None
    n = len(company)
    for i in range(max(1, n // 3), min(n - 1, (2 * n) // 3 + 1)):
        a, b = company[:i], company[i:]
        wa, wb = font.width(a, size), font.width(b, size)
        if wa <= max_w and wb <= max_w:
            score = abs(wa - wb)
            if best is None or score < best[0]:
                best = (score, [a, b])
    if best:
        return best[1]
    mid = n // 2
    return [company[:mid], company[mid:]]


def fit_fontsize(text, font, max_w, start, min_size):
    size = float(start)
    while size > min_size and font.width(text, size) > max_w:
        size -= 0.5
    return size


def draw_parts_wrap(page, start_x, y, parts, font, size, left, right, leading):
    """按片段顺序绘制，超出右边界自动换行；支持下划线。"""
    x = float(start_x)
    for text, underline in parts:
        text = text or ""
        i = 0
        while i < len(text):
            remain = right - x
            if remain < size * 0.55:
                y += leading
                x = float(left)
                remain = right - x
            lo, hi = 1, len(text) - i
            best = 0
            while lo <= hi:
                mid = (lo + hi) // 2
                chunk = text[i : i + mid]
                if font.width(chunk, size) <= remain:
                    best = mid
                    lo = mid + 1
                else:
                    hi = mid - 1
            if best <= 0:
                # 单字也放不下时强制换行再试
                if x > left + 0.5:
                    y += leading
                    x = float(left)
                    continue
                best = 1
            chunk = text[i : i + best]
            x = draw_run(page, x, y, chunk, font, size, underline=underline)
            i += best
            if i < len(text):
                y += leading
                x = float(left)
    return x, y


def render(payload, out_pdf):
    payload = payload or {}
    demo_value = payload.get("demo", True)
    is_demo = demo_value is not False and str(demo_value).lower() not in ("0", "false", "no")
    name = str(payload.get("name") or "").strip() or "王嵩嵩"
    id_number = str(payload.get("id_number") or "").strip() or "610404199112165515"
    hire_date = str(payload.get("hire_date") or "").strip() or "2025/12/15"
    leave_date = str(payload.get("leave_date") or "").strip() or "2026/7/10"
    issue_date = str(payload.get("issue_date") or "").strip() or "2026 年 7 月 13 日"
    company = (
        str(payload.get("company_name") or payload.get("company") or "").strip()
        or "北京外企市场营销顾问有限公司西安分公司"
    )
    position = (
        str(payload.get("position") or payload.get("job_title") or "").strip() or "职员"
    )
    note = str(payload.get("note") or "").strip() or "电子生成件，仅供个人留存，非用人单位出具。请勿用于入职、签证等正式用途。"

    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    page.insert_font(fontname=BODY_FONT)
    font = LayoutFont(BODY_FONT)
    try:
        doc.set_metadata(
            {
                "title": "离职证明（演示样例）" if is_demo else "离职证明",
                "author": "演示系统" if is_demo else "",
                "subject": "非正式离职证明 · 仅供个人留存",
                "creator": "lizhi_render_pdf",
            }
        )
    except Exception:
        pass

    # 未付费版重复盖「演示样例」水印；付费权益版不绘制该水印。
    if is_demo:
        wm = make_watermark_png()
        wm_tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        wm_path = wm_tmp.name
        wm_tmp.close()
        try:
            wm.save(wm_path, optimize=True)
            ww, hh = wm.size
            target_w = 150.0
            target_h = hh * (target_w / float(ww))
            for row in range(3):
                for col in range(2):
                    x0 = 55 + col * 250
                    y0 = 170 + row * 190
                    page.insert_image(
                        fitz.Rect(x0, y0, x0 + target_w, y0 + target_h),
                        filename=wm_path,
                        keep_proportion=True,
                        overlay=False,
                    )
        finally:
            try:
                os.remove(wm_path)
            except Exception:
                pass

    # 标题
    title = "离职证明"
    title_size = 22
    tw_title = font.width(title, title_size)
    page.insert_text(
        fitz.Point((PAGE_W - tw_title) / 2.0, 96),
        title,
        fontname=BODY_FONT,
        fontsize=title_size,
        color=(0, 0, 0),
    )

    # 正文
    body = 13.5
    leading = 28.0
    y = 168.0
    indent = 28.0

    x = MARGIN_L + indent
    x = draw_run(page, x, y, "兹证明", font, body)
    x = draw_run(page, x, y, "  ", font, body)
    x = draw_run(page, x, y, name, font, body, underline=True)
    x = draw_run(page, x, y, "  ", font, body)
    x = draw_run(page, x, y, "（身份证号码：", font, body)
    id_size = fit_fontsize(
        id_number,
        font,
        CONTENT_W - (x - MARGIN_L) - font.width(" ）自", body) - 8,
        body,
        10,
    )
    x = draw_run(page, x, y, id_number, font, id_size, underline=True)
    draw_run(page, x, y, " ）自", font, body)

    y += leading
    x, y = draw_parts_wrap(
        page,
        MARGIN_L + 6,
        y,
        [
            (hire_date, True),
            ("  起在", False),
            (company, True),
            ("担任", False),
            (position, True),
            ("，", False),
        ],
        font,
        body,
        MARGIN_L + 6,
        PAGE_W - MARGIN_R,
        leading,
    )

    y += leading
    x, y = draw_parts_wrap(
        page,
        MARGIN_L + 6,
        y,
        [
            ("至", False),
            ("  ", False),
            (leave_date, True),
            ("  与我司劳动关系解除。", False),
        ],
        font,
        body,
        MARGIN_L + 6,
        PAGE_W - MARGIN_R,
        leading,
    )

    y += leading + 6
    draw_run(page, MARGIN_L + indent, y, "特此证明。", font, body)

    # 落款：公司名 → 印章 → 日期
    seal_pt = 128.0
    right_pad = 56.0
    seal_x = PAGE_W - right_pad - seal_pt
    seal_y = max(y + 72.0, 300.0)

    company_size = 12.5
    company_max_w = seal_pt + 40
    wrap_limit = company_max_w * 1.15
    company_lines = wrap_company_lines(company, font, company_size, wrap_limit)
    while company_size > 9.5 and any(font.width(line, company_size) > wrap_limit for line in company_lines):
        company_size -= 0.5
        company_lines = wrap_company_lines(company, font, company_size, wrap_limit)

    line_gap = company_size + 4
    company_block_h = line_gap * len(company_lines)
    company_top = seal_y - 14 - company_block_h
    for i, line in enumerate(company_lines):
        lw = font.width(line, company_size)
        lx = min(PAGE_W - right_pad - lw, seal_x + (seal_pt - lw) / 2.0)
        page.insert_text(
            fitz.Point(lx, company_top + (i + 1) * line_gap - 2),
            line,
            fontname=BODY_FONT,
            fontsize=company_size,
            color=(0, 0, 0),
        )

    seal_img = make_seal(company)
    sa = seal_img.split()[-1].point(lambda v: int(v * 0.92))
    seal_img.putalpha(sa)
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp_path = tmp.name
    tmp.close()
    try:
        seal_img.save(tmp_path, optimize=True)
        seal_rect = fitz.Rect(seal_x, seal_y, seal_x + seal_pt, seal_y + seal_pt)
        page.insert_image(seal_rect, filename=tmp_path, keep_proportion=True, overlay=True)
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    date_size = 12.5
    dw = font.width(issue_date, date_size)
    dx = min(PAGE_W - right_pad - dw, seal_x + (seal_pt - dw) / 2.0)
    date_y = seal_y + seal_pt + 22
    page.insert_text(
        fitz.Point(dx, date_y),
        issue_date,
        fontname=BODY_FONT,
        fontsize=date_size,
        color=(0, 0, 0),
    )

    note_y = max(date_y + 48, PAGE_H - 96)
    page.insert_textbox(
        fitz.Rect(MARGIN_L - 12, note_y, PAGE_W - MARGIN_R + 12, note_y + 36),
        note,
        fontname=BODY_FONT,
        fontsize=10,
        color=(0.15, 0.15, 0.15),
        align=fitz.TEXT_ALIGN_LEFT,
    )
    if is_demo:
        page.insert_text(
            fitz.Point(MARGIN_L - 12, note_y + 42),
            "（演示样例，非正式离职证明）",
            fontname=BODY_FONT,
            fontsize=9.5,
            color=(0.25, 0.25, 0.25),
        )

    doc.save(out_pdf, garbage=4, deflate=True, deflate_images=True)
    doc.close()


def main():
    if len(sys.argv) < 3:
        print("usage: lizhi_render_pdf.py in.json out.pdf", file=sys.stderr)
        sys.exit(2)
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        data = json.load(f)
    payload = data.get("payload") if isinstance(data, dict) else data
    if not isinstance(payload, dict):
        payload = {}
    render(payload, sys.argv[2])
    print("ok")


if __name__ == "__main__":
    main()
