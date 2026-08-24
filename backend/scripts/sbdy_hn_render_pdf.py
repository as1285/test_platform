#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""湖南省个人参保信息（实缴明细）演示 PDF。版式对齐参保证明缴费明细样张。"""
from __future__ import print_function

import json
import math
import os
import sys
import tempfile
from datetime import datetime, timedelta

import fitz

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sbdy_render_pdf import (  # noqa: E402
    ensure_full_cjk_font,
    fit_fontsize,
    make_qr_png,
    make_subset_font,
    money,
    norm_text,
    register_fonts,
    text_width,
)

PAGE_W, PAGE_H = 595.0, 842.0
X0, X1 = 22.0, 573.0
LW = 0.6

FS = 9.0
FS_SM = 8.5
FS_TITLE = 14.0
FS_SEC = 10.0
CJK_ASCENT = 1.12
CJK_DESCENT = 0.28

# 基本信息表
Y_INFO = [70.0, 105.0, 135.0, 165.0]
INFO_R1_X = [22.0, 91.0, 334.0, 446.0, 573.0]
INFO_R23_X = [22.0, 91.0, 152.0, 203.0, 334.0, 446.0, 573.0]

Y_NOTES_TOP = 165.0
Y_NOTES_BOT = 318.0
Y_PURPOSE = [318.0, 345.0]

Y_REL_TITLE = 353.0
Y_REL_HEAD = 370.0
Y_REL_BODY = 385.0
REL_X = [22.0, 172.0, 330.0, 455.0, 573.0]

Y_DISPATCH_TITLE = 593.0
Y_DISPATCH_HEAD = 610.0
Y_DISPATCH_BODY = 625.0
DISPATCH_X = [22.0, 172.0, 275.0, 356.0, 455.0, 573.0]

Y_DETAIL_TITLE = 669.0
Y_DETAIL_HEAD = 685.0
Y_DETAIL_BODY = 715.0
DETAIL_X = [22.0, 72.0, 154.0, 206.0, 269.0, 329.0, 383.0, 449.0, 508.0, 573.0]
DETAIL_ROW_H = 28.0

Y_FOOTER_NOTE = 720.0
Y_FOOTER_LINE = 784.0

CONT_TOP = 22.0
CONT_BOTTOM = 710.0

NOTES = [
    '1.本证明系参保对象自主打印，使用者须通过以下2种途径验证真实性：',
    '（1）登陆单位网厅公共服务平台',
    '（2）下载安装“智慧人社”APP，使用参保证明验证功能扫描本证明的二维码',
    '2.本证明的在线验证码的有效期为3个月',
    '3.本证明涉及参保对象的权益信息，请妥善保管，依法使用',
    '4.对权益记录有争议的，请咨询争议期间参保缴费经办机构',
]

INS_TYPES = (
    ('injury', '工伤保险'),
    ('unemp', '失业保险'),
    ('pension', '企业职工基本养老保险'),
)


def hline(page, y, x0=None, x1=None):
    a = X0 if x0 is None else x0
    b = X1 if x1 is None else x1
    page.draw_line(fitz.Point(a, y), fitz.Point(b, y), color=(0, 0, 0), width=LW)


def vline(page, x, y0, y1):
    page.draw_line(fitz.Point(x, y0), fitz.Point(x, y1), color=(0, 0, 0), width=LW)


def baseline_in_box(y0, y1, size):
    mid = (y0 + y1) / 2.0
    y = mid + size * (CJK_ASCENT - CJK_DESCENT) / 2.0
    pad = 1.0
    max_b = y1 - pad - size * CJK_DESCENT
    min_b = y0 + pad + size * CJK_ASCENT
    if min_b <= max_b:
        if y > max_b:
            y = max_b
        elif y < min_b:
            y = min_b
    return y


def draw_text_in_box(page, font_path, fontname, text, x0, x1, y0, y1, size=FS, anchor='cm'):
    text = norm_text(text)
    if not text:
        return
    max_w = max(1.0, x1 - x0 - 2.0)
    s = fit_fontsize(font_path, text, max_w, size, min_size=6.0)
    tw = text_width(font_path, text, s)
    if anchor == 'lm':
        x = x0 + 2.0
        y = baseline_in_box(y0, y1, s)
    elif anchor == 'rm':
        x = x1 - 2.0 - tw
        y = baseline_in_box(y0, y1, s)
    else:
        x = x0 + (x1 - x0 - tw) / 2.0
        y = baseline_in_box(y0, y1, s)
    page.insert_text((x, y), text, fontname=fontname, fontsize=s, color=(0, 0, 0))


def draw_title_center(page, font_path, fontname, text, y, size=FS_TITLE):
    text = norm_text(text)
    tw = text_width(font_path, text, size)
    yb = y + size * CJK_ASCENT
    page.insert_text(((PAGE_W - tw) / 2.0, yb), text, fontname=fontname, fontsize=size, color=(0, 0, 0))


def draw_watermark(page):
    """浅蓝「SI + 湖南社保」水印，对齐样张。"""
    blue = (0.72, 0.84, 0.95)
    for cx, cy, scale in [(148, 220, 1.0), (448, 220, 1.0), (148, 520, 1.0), (448, 520, 1.0), (298, 370, 1.35)]:
        r = 26 * scale
        page.draw_circle(fitz.Point(cx, cy - 8 * scale), r, color=blue, width=1.2)
        page.insert_text(
            (cx - 11 * scale, cy - 2 * scale),
            'SI',
            fontname='helv',
            fontsize=14 * scale,
            color=blue,
        )
        page.insert_text(
            (cx - 28 * scale, cy + 18 * scale),
            '湖南社保',
            fontname='helv',
            fontsize=11 * scale,
            color=blue,
        )


def draw_info_table(page, font_path, fontname, p):
    for y in Y_INFO:
        hline(page, y)
    vline(page, X0, Y_INFO[0], Y_INFO[-1])
    vline(page, X1, Y_INFO[0], Y_INFO[-1])
    for x in INFO_R1_X[1:-1]:
        vline(page, x, Y_INFO[0], Y_INFO[1])
    for x in INFO_R23_X[1:-1]:
        vline(page, x, Y_INFO[1], Y_INFO[-1])

    r1 = ['当前单位名称', p.get('company_name') or '', '当前单位编号', p.get('unit_code') or '']
    for i, txt in enumerate(r1):
        draw_text_in_box(page, font_path, fontname, txt, INFO_R1_X[i], INFO_R1_X[i + 1], Y_INFO[0], Y_INFO[1], size=FS)

    r2 = [
        '姓名',
        p.get('name') or '',
        '建账时间',
        p.get('account_time') or '',
        '身份证号码',
        p.get('id_number') or '',
    ]
    for i, txt in enumerate(r2):
        draw_text_in_box(page, font_path, fontname, txt, INFO_R23_X[i], INFO_R23_X[i + 1], Y_INFO[1], Y_INFO[2], size=FS)

    agency = str(p.get('agency_name') or '')
    draw_text_in_box(page, font_path, fontname, '经办机', INFO_R23_X[2], INFO_R23_X[3], Y_INFO[2], Y_INFO[2] + 10, size=FS_SM)
    draw_text_in_box(page, font_path, fontname, '构名称', INFO_R23_X[2], INFO_R23_X[3], Y_INFO[2] + 10, Y_INFO[3], size=FS_SM)
    if len(agency) > 11:
        draw_text_in_box(page, font_path, fontname, agency[:11], INFO_R23_X[3], INFO_R23_X[4], Y_INFO[2], Y_INFO[2] + 10, size=FS_SM, anchor='lm')
        draw_text_in_box(page, font_path, fontname, agency[11:], INFO_R23_X[3], INFO_R23_X[4], Y_INFO[2] + 10, Y_INFO[3], size=FS_SM, anchor='lm')
    else:
        draw_text_in_box(page, font_path, fontname, agency, INFO_R23_X[3], INFO_R23_X[4], Y_INFO[2], Y_INFO[3], size=FS_SM, anchor='lm')

    draw_text_in_box(page, font_path, fontname, '性别', INFO_R23_X[0], INFO_R23_X[1], Y_INFO[2], Y_INFO[3], size=FS)
    draw_text_in_box(page, font_path, fontname, p.get('gender') or '', INFO_R23_X[1], INFO_R23_X[2], Y_INFO[2], Y_INFO[3], size=FS)
    draw_text_in_box(page, font_path, fontname, '有效期至', INFO_R23_X[4], INFO_R23_X[5], Y_INFO[2], Y_INFO[3], size=FS_SM)
    draw_text_in_box(page, font_path, fontname, p.get('valid_until') or '', INFO_R23_X[5], INFO_R23_X[6], Y_INFO[2], Y_INFO[3], size=FS_SM)


def draw_notes_qr(page, font_path, fontname, qr_path):
    hline(page, Y_NOTES_TOP)
    hline(page, Y_NOTES_BOT)
    vline(page, X0, Y_NOTES_TOP, Y_NOTES_BOT)
    vline(page, X1, Y_NOTES_TOP, Y_NOTES_BOT)
    if qr_path and os.path.isfile(qr_path):
        page.insert_image(fitz.Rect(28, Y_NOTES_TOP + 18, 88, Y_NOTES_TOP + 78), filename=qr_path)
    y = Y_NOTES_TOP + 16
    for line in NOTES:
        draw_text_in_box(page, font_path, fontname, line, 108, X1 - 4, y, y + 14, size=FS_SM, anchor='lm')
        y += 14 if line.startswith('（') else 16


def draw_purpose_row(page, font_path, fontname, purpose):
    hline(page, Y_PURPOSE[0])
    hline(page, Y_PURPOSE[1])
    vline(page, X0, Y_PURPOSE[0], Y_PURPOSE[1])
    vline(page, 91, Y_PURPOSE[0], Y_PURPOSE[1])
    vline(page, X1, Y_PURPOSE[0], Y_PURPOSE[1])
    draw_text_in_box(page, font_path, fontname, '用途', X0, 91, Y_PURPOSE[0], Y_PURPOSE[1], size=FS)
    draw_text_in_box(page, font_path, fontname, purpose or '本人查询', 91, X1, Y_PURPOSE[0], Y_PURPOSE[1], size=FS)


def draw_relations(page, font_path, fontname, relations, y_title):
    y_head = y_title + 17.0
    y_body = y_head + 15.0
    draw_text_in_box(page, font_path, fontname, '参保关系', X0, X1, y_title, y_title + 14, size=FS_SEC)
    hline(page, y_head)
    hline(page, y_body)
    for x in REL_X:
        vline(page, x, y_head, y_body)
    headers = ['统一社会信用代码', '单位名称', '险种', '起止时间']
    for i, h in enumerate(headers):
        draw_text_in_box(page, font_path, fontname, h, REL_X[i], REL_X[i + 1], y_head, y_body, size=FS_SM)

    y = y_body
    rels = relations or []
    if not rels:
        rels = [{'credit_code': '', 'company_name': '', 'items': []}]
    for rel in rels:
        items = rel.get('items') or []
        if not items:
            items = [{'type': '企业职工基本养老保险', 'range': ''}]
        block_h = DETAIL_ROW_H * len(items)
        hline(page, y + block_h)
        for x in REL_X:
            vline(page, x, y, y + block_h)
        draw_text_in_box(
            page,
            font_path,
            fontname,
            rel.get('credit_code') or '',
            REL_X[0],
            REL_X[1],
            y,
            y + block_h,
            size=FS_SM,
        )
        draw_text_in_box(
            page,
            font_path,
            fontname,
            rel.get('company_name') or '',
            REL_X[1],
            REL_X[2],
            y,
            y + block_h,
            size=FS_SM,
        )
        for j, item in enumerate(items):
            yy0 = y + j * DETAIL_ROW_H
            yy1 = yy0 + DETAIL_ROW_H
            draw_text_in_box(page, font_path, fontname, item.get('type') or '', REL_X[2], REL_X[3], yy0, yy1, size=FS_SM)
            draw_text_in_box(page, font_path, fontname, item.get('range') or '', REL_X[3], REL_X[4], yy0, yy1, size=FS_SM)
        y += block_h
    return y


def draw_dispatch_table(page, font_path, fontname, y_title):
    y_head = y_title + 17.0
    y_body = y_head + 15.0
    draw_text_in_box(page, font_path, fontname, '劳务派遣关系', X0, X1, y_title, y_title + 14, size=FS_SEC)
    hline(page, y_head)
    hline(page, y_body)
    for x in DISPATCH_X:
        vline(page, x, y_head, y_body)
    headers = ['统一社会信用代码', '单位名称', '用工形式', '实际用工单位', '起止时间']
    for i, h in enumerate(headers):
        draw_text_in_box(page, font_path, fontname, h, DISPATCH_X[i], DISPATCH_X[i + 1], y_head, y_body, size=FS_SM)
    return y_body


def draw_detail_header(page, font_path, fontname, y_title):
    y_head = y_title + 16.0
    y_body = y_head + 30.0
    draw_text_in_box(page, font_path, fontname, '缴费明细', X0, X1, y_title, y_title + 14, size=FS_SEC)
    hline(page, y_head)
    hline(page, y_body)
    for x in DETAIL_X:
        vline(page, x, y_head, y_body)
    labels = [
        ('费款所属\n期', DETAIL_X[0], DETAIL_X[1]),
        ('险种类型', DETAIL_X[1], DETAIL_X[2]),
        ('缴费基数', DETAIL_X[2], DETAIL_X[3]),
        ('单位应缴', DETAIL_X[3], DETAIL_X[4]),
        ('个人应缴', DETAIL_X[4], DETAIL_X[5]),
        ('缴费标志', DETAIL_X[5], DETAIL_X[6]),
        ('到账日期', DETAIL_X[6], DETAIL_X[7]),
        ('缴费类型', DETAIL_X[7], DETAIL_X[8]),
        ('经办机构', DETAIL_X[8], DETAIL_X[9]),
    ]
    for lab, xa, xb in labels:
        if '\n' in lab:
            a, b = lab.split('\n', 1)
            mid = (y_head + y_body) / 2.0
            draw_text_in_box(page, font_path, fontname, a, xa, xb, y_head, mid, size=FS_SM)
            draw_text_in_box(page, font_path, fontname, b, xa, xb, mid, y_body, size=FS_SM)
        else:
            draw_text_in_box(page, font_path, fontname, lab, xa, xb, y_head, y_body, size=FS_SM)
    return y_body


def draw_detail_row(page, font_path, fontname, row, y0, show_period=True):
    y1 = y0 + DETAIL_ROW_H
    hline(page, y1, X0, X1)
    for x in DETAIL_X:
        vline(page, x, y0, y1)
    period = row.get('period') or ''
    typ = row.get('type') or ''
    if len(typ) > 8 and '养老' in typ:
        draw_text_in_box(page, font_path, fontname, '企业职工基本养', DETAIL_X[1], DETAIL_X[2], y0, y0 + 14, size=FS_SM)
        draw_text_in_box(page, font_path, fontname, '老保险', DETAIL_X[1], DETAIL_X[2], y0 + 14, y1, size=FS_SM)
    else:
        draw_text_in_box(page, font_path, fontname, typ, DETAIL_X[1], DETAIL_X[2], y0, y1, size=FS_SM)
    if show_period:
        draw_text_in_box(page, font_path, fontname, period, DETAIL_X[0], DETAIL_X[1], y0, y1, size=FS_SM)
    draw_text_in_box(page, font_path, fontname, money(row.get('base')), DETAIL_X[2], DETAIL_X[3], y0, y1, size=FS_SM)
    draw_text_in_box(page, font_path, fontname, money(row.get('unit_pay')), DETAIL_X[3], DETAIL_X[4], y0, y1, size=FS_SM)
    draw_text_in_box(page, font_path, fontname, money(row.get('person_pay')), DETAIL_X[4], DETAIL_X[5], y0, y1, size=FS_SM)
    draw_text_in_box(page, font_path, fontname, row.get('flag') or '正常', DETAIL_X[5], DETAIL_X[6], y0, y1, size=FS_SM)
    draw_text_in_box(page, font_path, fontname, row.get('account_date') or '', DETAIL_X[6], DETAIL_X[7], y0, y1, size=FS_SM)
    ptype = row.get('pay_type') or '正常应缴'
    if len(ptype) > 5:
        draw_text_in_box(page, font_path, fontname, ptype[:5], DETAIL_X[7], DETAIL_X[8], y0, y0 + 14, size=FS_SM)
        draw_text_in_box(page, font_path, fontname, ptype[5:], DETAIL_X[7], DETAIL_X[8], y0 + 14, y1, size=FS_SM)
    else:
        draw_text_in_box(page, font_path, fontname, ptype, DETAIL_X[7], DETAIL_X[8], y0, y1, size=FS_SM)
    agency = str(row.get('agency') or '')
    if len(agency) > 5:
        draw_text_in_box(page, font_path, fontname, agency[:5], DETAIL_X[8], DETAIL_X[9], y0, y0 + 14, size=FS_SM)
        draw_text_in_box(page, font_path, fontname, agency[5:], DETAIL_X[8], DETAIL_X[9], y0 + 14, y1, size=FS_SM)
    else:
        draw_text_in_box(page, font_path, fontname, agency, DETAIL_X[8], DETAIL_X[9], y0, y1, size=FS_SM)


def draw_footer(page, font_path, fontname, p, page_no, total_pages, show_note=True, numbered=True):
    if show_note:
        draw_text_in_box(
            page,
            font_path,
            fontname,
            '说明:本信息由参保地社保经办机构负责解释:参保人如有疑问，请与参保地社保经办机构联系',
            17,
            566,
            Y_FOOTER_NOTE,
            Y_FOOTER_NOTE + 12,
            size=FS_SM,
            anchor='lm',
        )
    if numbered:
        draw_text_in_box(page, font_path, fontname, '个人姓名：' + str(p.get('name') or ''), 17, 120, Y_FOOTER_LINE, Y_FOOTER_LINE + 12, size=FS, anchor='lm')
        draw_text_in_box(
            page,
            font_path,
            fontname,
            '第%d页,共%d页' % (page_no, total_pages),
            250,
            350,
            Y_FOOTER_LINE,
            Y_FOOTER_LINE + 12,
            size=FS,
        )
        draw_text_in_box(
            page,
            font_path,
            fontname,
            '个人编号：' + str(p.get('person_no') or ''),
            400,
            578,
            Y_FOOTER_LINE,
            Y_FOOTER_LINE + 12,
            size=FS,
            anchor='rm',
        )


def ensure_detail_rows(p):
    rows = list(p.get('detail_rows') or [])
    if rows:
        return rows
    months = list(p.get('months') or [])
    agency_short = str(p.get('agency_short') or p.get('area') or '经办机构')
    if len(agency_short) > 5:
        agency_short = agency_short[:5]
    out = []
    for m in months:
        if not isinstance(m, dict):
            continue
        period = m.get('period') or (
            str(m.get('year') or '') + str(m.get('month') or '').zfill(2)[-2:]
        )
        base = float(m.get('base') or m.get('pension_base') or p.get('base_amount') or 0)
        for _key, typ in INS_TYPES:
            if _key == 'pension':
                unit_pay = round(base * 0.16, 2)
                person_pay = round(base * 0.08, 2)
            elif _key == 'injury':
                unit_pay = round(base * 0.014, 2)
                person_pay = 0.0
            else:
                unit_pay = round(base * 0.007, 2)
                person_pay = round(base * 0.003, 2)
            out.append(
                {
                    'period': period,
                    'type': typ,
                    'base': base,
                    'unit_pay': unit_pay,
                    'person_pay': person_pay,
                    'flag': m.get('flag') or '正常',
                    'account_date': m.get('account_date') or '',
                    'pay_type': m.get('pay_type') or '正常应缴',
                    'agency': m.get('agency') or agency_short,
                }
            )
    return out


def paginate_detail_rows(rows):
    """对齐样张：第1页1行、第2页空白、第3-5页分批、末页盖章。"""
    rows = list(rows or [])
    if not rows:
        return [[]]
    pages = [rows[0:1], []]
    rest = rows[1:]
    idx = 0
    for cap in (18, 12, 13):
        chunk = rest[idx : idx + cap]
        idx += len(chunk)
        pages.append(chunk)
    if idx < len(rest):
        pages.append(rest[idx:])
    return pages


NUMBERED_PAGES = 5


def estimate_first_detail_end(relations):
    """根据参保关系行数估算首页明细区起点，避免与上方表格重叠。"""
    rels = relations or []
    rel_rows = 0
    for rel in rels:
        items = rel.get('items') or []
        rel_rows += max(1, len(items))
    y_after_rel = Y_PURPOSE[1] + 17.0 + 15.0 + rel_rows * DETAIL_ROW_H + 12.0
    y_after_dispatch = y_after_rel + 17.0 + 15.0 + 12.0
    detail_title = y_after_dispatch
    detail_body = detail_title + 16.0 + 30.0
    return detail_body, detail_body + DETAIL_ROW_H


# 版面上全部静态文案（标题/标签/表头/说明/险种/缴费类型/页脚）。
# 必须并入子集字体，否则 MuPDF 缺字会把这些字渲染成 □ 方块。
STATIC_TEXT = (
    '个人参保信息（实缴明细）'
    '当前单位名称当前单位编号姓名建账时间身份证号码性别经办机构名称有效期至'
    '用途本人查询'
    '参保关系统一社会信用代码单位名称险种起止时间'
    '劳务派遣关系用工形式实际用工单位'
    '缴费明细费款所属期险种类型缴费基数单位应缴个人应缴缴费标志到账日期缴费类型经办机构'
    '企业职工基本养老保险工伤保险失业保险'
    '正常应缴缴费基数调整退收缴费基数调整补缴正常'
    '盖章处：'
    '说明:本信息由参保地社保经办机构负责解释:参保人如有疑问，请与参保地社保经办机构联系'
    '个人姓名：第页,共页个人编号：社会保险经办机构男女'
)


def collect_blob(p, rows, auth_code):
    parts = [STATIC_TEXT, ''.join(NOTES)]
    for _key, typ in INS_TYPES:
        parts.append(typ)
    for key in (
        'name', 'id_number', 'company_name', 'unit_code', 'person_no',
        'account_time', 'agency_name', 'agency_short', 'area',
        'valid_until', 'purpose', 'gender',
    ):
        parts.append(str(p.get(key) or ''))
    for rel in (p.get('relations') or []):
        parts.append(str(rel.get('credit_code') or ''))
        parts.append(str(rel.get('company_name') or ''))
        for item in (rel.get('items') or []):
            parts.append(str(item.get('type') or ''))
            parts.append(str(item.get('range') or ''))
    for r in rows:
        parts.extend([str(v) for v in r.values()])
    parts.append(str(auth_code or ''))
    return ''.join(norm_text(x) for x in parts)


def render(payload, auth_code, qr_url, out_path):
    p = payload or {}
    rows = ensure_detail_rows(p)
    chunks = paginate_detail_rows(rows)
    blob = collect_blob(p, rows, auth_code)
    full_body = ensure_full_cjk_font()
    subset = make_subset_font(full_body, blob, prefix='sbdy_hn_body_')
    qr_path = None
    try:
        fd, qr_path = tempfile.mkstemp(suffix='.png', prefix='sbdy_hn_qr_')
        os.close(fd)
        make_qr_png(qr_url or 'https://geshui.vip/', qr_path)
    except Exception:
        qr_path = None

    doc = None
    try:
        doc = fitz.open()
        for pi, chunk in enumerate(chunks):
            page = doc.new_page(width=PAGE_W, height=PAGE_H)
            body_name, _ = register_fonts(page, subset, subset)
            draw_watermark(page)
            is_last = pi == len(chunks) - 1
            is_blank = pi == 1 and not chunk
            if pi == 0:
                draw_title_center(page, subset, body_name, '个人参保信息（实缴明细）', 39.0)
                draw_info_table(page, subset, body_name, p)
                draw_notes_qr(page, subset, body_name, qr_path)
                draw_purpose_row(page, subset, body_name, p.get('purpose') or '本人查询')
                y = Y_PURPOSE[1] + 8.0
                y = draw_relations(page, subset, body_name, p.get('relations') or [], y) + 8.0
                y = draw_dispatch_table(page, subset, body_name, y) + 8.0
                detail_body = draw_detail_header(page, subset, body_name, y)
                y = detail_body
                last_period = None
                for row in chunk:
                    show_period = row.get('period') != last_period
                    draw_detail_row(page, subset, body_name, row, y, show_period=show_period)
                    last_period = row.get('period')
                    y += DETAIL_ROW_H
            elif is_blank:
                pass
            else:
                y = CONT_TOP
                last_period = None
                for row in chunk:
                    show_period = row.get('period') != last_period
                    draw_detail_row(page, subset, body_name, row, y, show_period=show_period)
                    last_period = row.get('period')
                    y += DETAIL_ROW_H
                if is_last:
                    draw_text_in_box(page, subset, body_name, '盖章处：', X0 + 4, X0 + 80, y, y + 16, size=FS, anchor='lm')
            if is_last:
                draw_footer(page, subset, body_name, p, pi + 1, NUMBERED_PAGES, show_note=True, numbered=False)
            else:
                draw_footer(page, subset, body_name, p, pi + 1, NUMBERED_PAGES, show_note=is_blank, numbered=True)
        doc.save(out_path, deflate=True, garbage=4)
        doc.close()
        doc = None
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass
        try:
            os.remove(subset)
        except Exception:
            pass
        if qr_path:
            try:
                os.remove(qr_path)
            except Exception:
                pass


def main():
    if len(sys.argv) < 3:
        print('usage: sbdy_hn_render_pdf.py <payload.json> <out.pdf>', file=sys.stderr)
        return 2
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)
    render(
        data.get('payload') or {},
        data.get('auth_code') or '',
        data.get('qr_url') or data.get('verify_url') or '',
        sys.argv[2],
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())
