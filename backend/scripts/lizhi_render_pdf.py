#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""离职证明 PDF：宋体排版（Noto Serif SC）整页栅格 + 透明公章叠盖。

视觉对齐参考样例：宋体正文/粗宋标题、填空下划线；公章红圈 + 弧形单位名 + 五角星。
"""
from __future__ import print_function

import json
import math
import os
import re
import sys
import tempfile

import fitz
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets", "sbdy")
NOTO_SERIF_SC = os.path.join(ASSETS, "NotoSerifCJKsc-Regular.otf")
NOTO_SERIF_BOLD_TTC = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
NOTO_SERIF_REG_TTC = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc"
NOTO_SANS_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"

# A4 @ 2x pt（72dpi→144dpi），清晰且体积可控
PAGE_W_PT, PAGE_H_PT = 595.32, 841.92
SCALE = 2.0
PAGE_W = int(round(PAGE_W_PT * SCALE))
PAGE_H = int(round(PAGE_H_PT * SCALE))
MARGIN_L = int(72 * SCALE)
MARGIN_R = int(72 * SCALE)
# 印泥大红：对齐全真公章朱红，勿再用浅粉细圈
SEAL_RED = (214, 28, 32, 255)
SEAL_STAMP_ALPHA = 0.90
SEAL_PT = 176
INK = (15, 15, 15, 255)


def _first_existing(*paths):
    for p in paths:
        if p and os.path.isfile(p):
            return p
    return None


def font_path_serif_reg():
    return _first_existing(NOTO_SERIF_SC, NOTO_SERIF_REG_TTC, NOTO_SERIF_BOLD_TTC)


def font_path_serif_bold():
    return _first_existing(NOTO_SERIF_BOLD_TTC, NOTO_SERIF_SC, NOTO_SANS_BOLD)


def load_pil_font(path, px, prefer_index=2):
    if not path:
        return ImageFont.load_default()
    for idx in (prefer_index, 0, 1, 3, 4):
        try:
            return ImageFont.truetype(path, size=px, index=idx)
        except Exception:
            continue
    try:
        return ImageFont.truetype(path, size=px)
    except Exception:
        return ImageFont.load_default()


def body_font(px):
    # SC Regular：.otf 无 index；TTC 用 SC=2
    path = font_path_serif_reg()
    if path and path.endswith(".otf"):
        return load_pil_font(path, px, prefer_index=0)
    return load_pil_font(path, px, prefer_index=2)


def bold_font(px):
    path = font_path_serif_bold()
    if path and path.endswith(".otf"):
        return load_pil_font(path, px, prefer_index=0)
    return load_pil_font(path, px, prefer_index=2)  # SC Bold


def _draw_pentagram(draw, cx, cy, outer_r, inner_r, fill):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = outer_r if i % 2 == 0 else inner_r
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    draw.polygon(pts, fill=fill)


def make_seal(company):
    """圆形公章：粗红圈 + 大号弧形单位名 + 中心五角星（印泥大红）。"""
    SS = 2000
    RED = SEAL_RED
    seal = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(seal)
    cx = cy = SS / 2.0

    R = SS * 0.468
    ring_w = max(44, int(SS * 0.032))
    inner_w = max(10, int(SS * 0.007))
    inner_r = R - ring_w - inner_w * 1.35
    star_outer = SS * 0.148

    # 先画圈，字后贴，避免红圈切掉笔画
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=RED, width=ring_w)
    d.ellipse(
        [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
        outline=RED,
        width=inner_w,
    )
    _draw_pentagram(d, cx, cy, star_outer, star_outer * 0.40, RED)

    chars = list((company or "专用章").strip()) or list("专用章")
    if len(chars) > 22:
        chars = chars[:22]
    n = len(chars)

    if n <= 6:
        arc_deg = 168.0 + n * 6.0
    elif n <= 10:
        arc_deg = 210.0 + (n - 6) * 7.0
    elif n <= 14:
        arc_deg = 238.0 + (n - 10) * 6.0
    else:
        arc_deg = min(278.0, 262.0 + (n - 14) * 2.0)

    max_font = int(SS * 0.155)
    min_font = int(SS * 0.088)
    font_size = min_font
    text_r = inner_r - inner_w - min_font * 0.55
    band_outer = inner_r - inner_w - SS * 0.012
    band_inner = star_outer + SS * 0.055
    for try_size in range(max_font, min_font - 1, -2):
        cand_r = band_outer - try_size * 0.52
        if cand_r - try_size * 0.48 < band_inner:
            continue
        arc_len = math.radians(arc_deg) * cand_r
        # 公章字距偏紧，优先把字做大
        if try_size * n <= arc_len * 0.98:
            font_size = try_size
            text_r = cand_r
            break

    font = bold_font(font_size)
    stroke = max(3, int(font_size * 0.055))
    a0 = 270.0 - arc_deg / 2.0
    a1 = 270.0 + arc_deg / 2.0

    for i, ch in enumerate(chars):
        ang_deg = a0 + (a1 - a0) * ((i + 0.5) / n)
        ang = math.radians(ang_deg)
        pad = int(font_size * 3.2)
        g = Image.new("RGBA", (pad, pad), (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        bb = gd.textbbox((0, 0), ch, font=font, stroke_width=stroke)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        gx = (pad - tw) / 2.0 - bb[0]
        gy = (pad - th) / 2.0 - bb[1]
        gd.text((gx, gy), ch, font=font, fill=RED, stroke_width=stroke, stroke_fill=RED)
        # PIL 坐标 y 向下；顶部直立、两侧沿切线
        g = g.rotate(270.0 - ang_deg, resample=Image.Resampling.BICUBIC, center=(pad / 2.0, pad / 2.0), expand=False)
        x = cx + text_r * math.cos(ang)
        y = cy + text_r * math.sin(ang)
        seal.alpha_composite(g, (int(round(x - pad / 2.0)), int(round(y - pad / 2.0))))

    pad_px = int(ring_w * 0.45)
    box = [
        int(cx - R - pad_px),
        int(cy - R - pad_px),
        int(cx + R + pad_px),
        int(cy + R + pad_px),
    ]
    cropped = seal.crop(box)
    side = cropped.size[0]
    mask = Image.new("L", (side, side), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([0, 0, side - 1, side - 1], fill=255)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(cropped, (0, 0), mask)
    return out.resize((820, 820), Image.Resampling.LANCZOS)


def place_seal(img, company, seal_x, seal_y, seal_pt=None):
    """把大红公章盖到证明页上，略透但不发粉。"""
    if seal_pt is None:
        seal_pt = int(SEAL_PT * SCALE)
    seal_r = make_seal(company).resize((seal_pt, seal_pt), Image.Resampling.LANCZOS)
    sa = seal_r.split()[-1].point(lambda v: int(v * SEAL_STAMP_ALPHA))
    seal_r.putalpha(sa)
    img.alpha_composite(seal_r, (int(seal_x), int(seal_y)))
    return seal_pt


def make_watermark_png():
    W, H = 420, 220
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = bold_font(54)
    text = "演示样例"
    bb = d.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((W - tw) / 2 - bb[0], (H - th) / 2 - bb[1]), text, font=font, fill=(180, 180, 180, 70))
    return img.rotate(30, resample=Image.Resampling.BICUBIC, expand=True)


def text_width(font, text):
    tmp = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    bb = tmp.textbbox((0, 0), text or "", font=font)
    return max(0, bb[2] - bb[0])


def parse_ymd(raw):
    s = str(raw or "").strip()
    if not s:
        return None
    m = re.search(r"(\d{4})\s*[年/\-.]\s*(\d{1,2})\s*[月/\-.]\s*(\d{1,2})", s)
    if not m:
        return None
    return m.group(1), str(int(m.group(2))), str(int(m.group(3)))


def blank_or(value, width=6):
    v = str(value or "").strip()
    if v:
        return v
    return "_" * max(2, int(width))


def ymd_parts(raw, fallback_width=4):
    ymd = parse_ymd(raw)
    if ymd:
        y, m, d = ymd
        return [(y, True), ("年", False), (m, True), ("月", False), (d, True), ("日", False)]
    return [(blank_or(raw, fallback_width), True)]


def wrap_company_lines(company, font, max_w):
    company = (company or "").strip()
    if text_width(font, company) <= max_w:
        return [company]
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
        if text_width(font, a) <= max_w and text_width(font, b) <= max_w:
            return [a, b]
    best = None
    n = len(company)
    for i in range(max(1, n // 3), min(n - 1, (2 * n) // 3 + 1)):
        a, b = company[:i], company[i:]
        wa, wb = text_width(font, a), text_width(font, b)
        if wa <= max_w and wb <= max_w:
            score = abs(wa - wb)
            if best is None or score < best[0]:
                best = (score, [a, b])
    if best:
        return best[1]
    mid = n // 2
    return [company[:mid], company[mid:]]


class PagePainter(object):
    def __init__(self, img):
        self.img = img
        self.draw = ImageDraw.Draw(img)

    def draw_run(self, x, y, text, font, underline=False):
        text = text or ""
        if not text:
            return x
        self.draw.text((x, y), text, font=font, fill=INK)
        w = text_width(font, text)
        if underline:
            # 基线下方横线（对齐参考填空样式）
            ascent = font.getmetrics()[0] if hasattr(font, "getmetrics") else int(font.size * 0.8)
            uy = y + ascent + max(2, int(font.size * 0.08))
            self.draw.line([(x, uy), (x + w, uy)], fill=INK, width=max(2, int(SCALE)))
        return x + w

    def draw_parts_wrap(self, start_x, y, parts, font, left, right, leading):
        x = float(start_x)
        size = font.size
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
                    if text_width(font, chunk) <= remain:
                        best = mid
                        lo = mid + 1
                    else:
                        hi = mid - 1
                if best <= 0:
                    if x > left + 0.5:
                        y += leading
                        x = float(left)
                        continue
                    best = 1
                chunk = text[i : i + best]
                x = self.draw_run(x, y, chunk, font, underline=underline)
                i += best
                if i < len(text):
                    y += leading
                    x = float(left)
        return x, y


def render_page_image(payload):
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
    department = str(payload.get("department") or payload.get("dept") or "").strip() or ""
    position = str(payload.get("position") or payload.get("job_title") or "").strip() or "职员"
    note = str(payload.get("note") or "").strip()

    img = Image.new("RGBA", (PAGE_W, PAGE_H), (255, 255, 255, 255))
    painter = PagePainter(img)

    if is_demo:
        wm = make_watermark_png()
        ww, hh = wm.size
        target_w = int(150 * SCALE)
        target_h = int(hh * (target_w / float(ww)))
        wm_r = wm.resize((target_w, target_h), Image.Resampling.LANCZOS)
        for row in range(3):
            for col in range(2):
                x0 = int(55 * SCALE) + col * int(250 * SCALE)
                y0 = int(170 * SCALE) + row * int(190 * SCALE)
                img.alpha_composite(wm_r, (x0, y0))

    title_font = bold_font(int(26 * SCALE))
    body_f = body_font(int(13.5 * SCALE))
    note_f = body_font(int(10 * SCALE))
    demo_f = body_font(int(9.5 * SCALE))

    title = "离职证明"
    tw = text_width(title_font, title)
    painter.draw_run((PAGE_W - tw) / 2.0, int(72 * SCALE), title, title_font)

    leading = int(30 * SCALE)
    y = int(150 * SCALE)
    indent = int(28 * SCALE)
    left = MARGIN_L + int(6 * SCALE)
    right = PAGE_W - MARGIN_R
    dept_show = blank_or(department, 6)
    pos_show = blank_or(position, 6)

    x, y = painter.draw_parts_wrap(
        MARGIN_L + indent,
        y,
        [
            ("兹证明：", False),
            (name, True),
            ("  身份证号码：", False),
            (id_number, True),
        ],
        body_f,
        left,
        right,
        leading,
    )

    y += leading
    body_parts = [("于", False)]
    body_parts.extend(ymd_parts(hire_date))
    body_parts.extend(
        [
            ("入职我单位，担任", False),
            (dept_show, True),
            ("部门", False),
            (pos_show, True),
            ("岗位职务。现因个人原因提出离职，已于", False),
        ]
    )
    body_parts.extend(ymd_parts(leave_date))
    body_parts.append(
        (
            "正式办理完所有离职手续，工作交接、薪资福利、社保公积金等均已结清，双方劳动关系正式解除，无任何劳动争议及经济纠纷。",
            False,
        )
    )
    x, y = painter.draw_parts_wrap(
        MARGIN_L + indent,
        y,
        body_parts,
        body_f,
        left,
        right,
        leading,
    )

    y += leading + int(10 * SCALE)
    painter.draw_run(MARGIN_L + indent, y, "特此证明！", body_f)

    seal_pt = int(SEAL_PT * SCALE)
    right_pad = int(42 * SCALE)
    seal_x = PAGE_W - right_pad - seal_pt
    seal_y = max(y + int(50 * SCALE), int(400 * SCALE))

    sign_size = int(12.5 * SCALE)
    sign_f = body_font(sign_size)
    sign_label = "单位名称（盖章）："
    wrap_limit = seal_pt + int(36 * SCALE)
    company_lines = wrap_company_lines(company, sign_f, wrap_limit)
    while sign_size > int(9.5 * SCALE) and any(
        text_width(sign_f, line) > wrap_limit for line in company_lines
    ):
        sign_size -= int(0.5 * SCALE) or 1
        sign_f = body_font(sign_size)
        company_lines = wrap_company_lines(company, sign_f, wrap_limit)

    line_gap = sign_size + int(5 * SCALE)
    sign_top = seal_y + int(26 * SCALE)
    label_w = text_width(sign_f, sign_label)
    sign_x0 = min(seal_x - int(4 * SCALE), PAGE_W - right_pad - max(label_w + int(36 * SCALE), wrap_limit))
    painter.draw_run(sign_x0, sign_top, sign_label, sign_f)

    company_top = sign_top + line_gap + int(2 * SCALE)
    for i, line in enumerate(company_lines):
        lw = text_width(sign_f, line)
        lx = min(PAGE_W - right_pad - lw, seal_x + (seal_pt - lw) / 2.0)
        if i == 0 and len(company_lines) == 1:
            lx = max(sign_x0, min(lx, seal_x + (seal_pt - lw) / 2.0))
        painter.draw_run(lx, company_top + i * line_gap, line, sign_f, underline=True)

    date_size = sign_size
    date_f = body_font(date_size)
    date_y = company_top + len(company_lines) * line_gap + int(14 * SCALE)
    date_x = sign_x0
    painter.draw_run(date_x, date_y, "日期：", date_f)
    dx = date_x + text_width(date_f, "日期：")
    issue_ymd = parse_ymd(issue_date)
    if issue_ymd:
        for text, ul in [
            (issue_ymd[0], True),
            ("年", False),
            (issue_ymd[1], True),
            ("月", False),
            (issue_ymd[2], True),
            ("日", False),
        ]:
            dx = painter.draw_run(dx, date_y, text, date_f, underline=ul)
    else:
        painter.draw_run(dx, date_y, blank_or(issue_date, 10), date_f, underline=True)

    place_seal(img, company, seal_x, seal_y, seal_pt)

    note_y = max(date_y + int(70 * SCALE), PAGE_H - int(96 * SCALE))
    if note:
        painter.draw_run(MARGIN_L - int(12 * SCALE), note_y, note, note_f)
        note_y += int(36 * SCALE)
    if is_demo:
        painter.draw_run(
            MARGIN_L - int(12 * SCALE),
            note_y,
            "（演示样例，非正式离职证明）",
            demo_f,
        )

    return img.convert("RGB"), is_demo


def render(payload, out_pdf):
    page_img, is_demo = render_page_image(payload)
    preview_path = os.path.splitext(out_pdf)[0] + ".preview.png"
    try:
        page_img.save(preview_path, format="PNG", optimize=True)
    except Exception as e:
        print("preview_warn:" + str(e), file=sys.stderr)

    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp_path = tmp.name
    tmp.close()
    try:
        page_img.save(tmp_path, format="PNG", optimize=True)
        doc = fitz.open()
        page = doc.new_page(width=PAGE_W_PT, height=PAGE_H_PT)
        page.insert_image(page.rect, filename=tmp_path, keep_proportion=False)
        try:
            doc.set_metadata(
                {
                    "title": "离职证明（演示样例）" if is_demo else "离职证明",
                    "author": "演示系统" if is_demo else "",
                    "subject": "离职证明（演示样例）" if is_demo else "离职证明",
                    "creator": "lizhi_render_pdf",
                }
            )
        except Exception:
            pass
        doc.save(out_pdf, garbage=4, deflate=True, deflate_images=True)
        doc.close()
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


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
