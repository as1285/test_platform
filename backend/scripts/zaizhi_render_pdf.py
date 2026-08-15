#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""在职/工作证明 PDF：复用离职证明字体、公章与排版工具，正文按工作证明模板。"""
from __future__ import print_function

import json
import os
import sys
import tempfile

import fitz

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lizhi_render_pdf import (  # noqa: E402
    MARGIN_L,
    MARGIN_R,
    PAGE_H,
    PAGE_H_PT,
    PAGE_W,
    PAGE_W_PT,
    SCALE,
    PagePainter,
    blank_or,
    body_font,
    bold_font,
    make_seal,
    make_watermark_png,
    parse_ymd,
    text_width,
    wrap_company_lines,
    ymd_parts,
)
from PIL import Image


def gender_from_id(id_number):
    s = "".join(ch for ch in str(id_number or "") if ch.isalnum())
    digit = ""
    if len(s) >= 18:
        digit = s[16]
    elif len(s) == 15:
        digit = s[14]
    if digit.isdigit():
        return "男" if int(digit) % 2 == 1 else "女"
    return ""


def render_page_image(payload):
    payload = payload or {}
    demo_value = payload.get("demo", True)
    is_demo = demo_value is not False and str(demo_value).lower() not in ("0", "false", "no")
    name = str(payload.get("name") or "").strip() or "王嵩嵩"
    id_number = str(payload.get("id_number") or "").strip() or "610404199112165515"
    gender = str(payload.get("gender") or "").strip() or gender_from_id(id_number) or "男"
    hire_date = str(payload.get("hire_date") or "").strip() or "2025/12/15"
    issue_date = str(payload.get("issue_date") or "").strip() or "2026 年 8 月 15 日"
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

    title = "工作证明"
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
            ("兹证明", False),
            (name, True),
            ("，性别", False),
            (gender, True),
            ("，身份证号码：", False),
            (id_number, True),
        ],
        body_f,
        left,
        right,
        leading,
    )

    y += leading
    body_parts = [("为我公司在职员工，自", False)]
    body_parts.extend(ymd_parts(hire_date))
    body_parts.extend(
        [
            ("起至今在我公司工作，目前在我公司", False),
            (dept_show, True),
            ("部门担任", False),
            (pos_show, True),
            ("一职。", False),
        ]
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

    y += leading + int(8 * SCALE)
    x, y = painter.draw_parts_wrap(
        MARGIN_L + indent,
        y,
        [
            (
                "本证明仅用于我公司员工的工作证明，不作为我公司对该员工任何形式的担保文件。",
                False,
            )
        ],
        body_f,
        left,
        right,
        leading,
    )

    seal_pt = int(156 * SCALE)
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
    dx = sign_x0
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

    seal_img = make_seal(company)
    seal_r = seal_img.resize((seal_pt, seal_pt), Image.Resampling.LANCZOS)
    sa = seal_r.split()[-1].point(lambda v: int(v * 0.64))
    seal_r.putalpha(sa)
    img.alpha_composite(seal_r, (int(seal_x), int(seal_y)))

    note_y = max(date_y + int(70 * SCALE), PAGE_H - int(96 * SCALE))
    if note:
        painter.draw_run(MARGIN_L - int(12 * SCALE), note_y, note, note_f)
        note_y += int(36 * SCALE)
    if is_demo:
        painter.draw_run(
            MARGIN_L - int(12 * SCALE),
            note_y,
            "（演示样例，非正式工作证明）",
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
                    "title": "工作证明（演示样例）" if is_demo else "工作证明",
                    "author": "演示系统" if is_demo else "",
                    "subject": "工作证明（演示样例）" if is_demo else "工作证明",
                    "creator": "zaizhi_render_pdf",
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
        print("usage: zaizhi_render_pdf.py in.json out.pdf", file=sys.stderr)
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
