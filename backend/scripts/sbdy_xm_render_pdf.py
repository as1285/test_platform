#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""厦门市社会保险 · 基本养老个人历年缴费明细表 演示 PDF。

版式对齐「厦门市社会保险个人社保参保证明」样张（A4 595×842）：
- 首页居中标题；
- 个人编号 / 身份证号 / 姓名 + 打印区间（全部/部分）；
- 九列表格：序号、参保地经办机构、单位编号、单位名称、建账年月、
  缴费对应起始至截止、月数、缴费基数、缴费性质；
- 首页 29 行、续页 30 行；末页合计 + 注 + 经办人/打印机构/打印日期；
- 红色业务专用章 + 全国社保卡服务平台斜向水印。
"""
from __future__ import print_function

import json
import math
import os
import sys

import fitz

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sbdy_render_pdf import (  # noqa: E402
    cell_box,
    ensure_bold_cjk_font,
    ensure_full_cjk_font,
    make_subset_font,
    norm_text,
    register_fonts,
    text_width,
)

ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
SEAL_PNG = os.path.join(ASSETS, 'xm_seal.png')

PAGE_W, PAGE_H = 595.0, 842.0
COLS = [20.0, 46.0, 130.0, 190.0, 315.0, 361.0, 426.0, 451.0, 501.0, 575.0]
X0, X1 = COLS[0], COLS[-1]
LW = 0.5
HEADER_H = 32.0
ROW_H = 23.0
FIRST_ROWS = 29
CONT_ROWS = 30
TITLE = '基本养老个人历年缴费明细表'
WATERMARK = (
    '本文件由全国社保卡服务平台提供，任何第三方机构不得对数据进行二次加工、'
    '处理、解析或以任何形式用于商业用途，否则将追究法律责任。'
)
# 真实下载水印按三行折行、-30° 斜向、2 列平铺（对齐样张排版）
WM_LINE1 = '\u3000\u3000本文件由全国社保卡服务平台提供，任何第三方机构不'
WM_LINE2 = '得对数据进行二次加工、处理、解析或以任何形式用于商业'
WM_LINE3_PREFIX = '用途，否则将追究法律责任。'
NOTE = '注：参保人在相应缴费起止时间内所属的参保地信息参见“参保地经办机构”一栏'


def money2(n):
    try:
        x = float(n)
    except Exception:
        return ''
    s = '%.2f' % x
    whole, frac = s.split('.')
    sign = ''
    if whole.startswith('-'):
        sign = '-'
        whole = whole[1:]
    out = ''
    while len(whole) > 3:
        out = ',' + whole[-3:] + out
        whole = whole[:-3]
    return sign + whole + out + '.' + frac


def money_total(n):
    try:
        x = float(n)
    except Exception:
        return ''
    if abs(x - round(x)) < 1e-6:
        s = '%.1f' % x
    else:
        s = ('%.2f' % x).rstrip('0').rstrip('.')
        if '.' not in s:
            s += '.0'
    whole, frac = (s.split('.') + ['0'])[:2]
    sign = ''
    if whole.startswith('-'):
        sign = '-'
        whole = whole[1:]
    out = ''
    while len(whole) > 3:
        out = ',' + whole[-3:] + out
        whole = whole[:-3]
    return sign + whole + out + '.' + frac


def hline(page, y, x0=None, x1=None, width=LW):
    page.draw_line(
        fitz.Point(X0 if x0 is None else x0, y),
        fitz.Point(X1 if x1 is None else x1, y),
        color=(0, 0, 0),
        width=width,
    )


def vline(page, x, y0, y1, width=LW):
    page.draw_line(fitz.Point(x, y0), fitz.Point(x, y1), color=(0, 0, 0), width=width)


def grid(page, y0, y1, n_rows):
    ys = [y0]
    # header
    ys.append(y0 + HEADER_H)
    for i in range(n_rows):
        ys.append(y0 + HEADER_H + (i + 1) * ROW_H)
    # last line may be totals (same height)
    for y in ys:
        hline(page, y)
    for x in COLS:
        vline(page, x, ys[0], ys[-1])
    return ys


def wrap2(fp, text, max_w, size):
    src = norm_text(text)
    if not src:
        return ['']
    if text_width(fp, src, size) <= max_w:
        return [src]
    line = ''
    lines = []
    for ch in src:
        if line and text_width(fp, line + ch, size) > max_w:
            lines.append(line)
            line = ch
        else:
            line += ch
    if line:
        lines.append(line)
    if len(lines) <= 2:
        return lines
    return [lines[0], ''.join(lines[1:])]


def cell_wrap(page, fp, fn, text, x0, x1, y0, y1, size=9.0, align='left'):
    lines = wrap2(fp, text, max(8.0, x1 - x0 - 4.0), size)
    if len(lines) <= 1:
        cell_box(page, fp, fn, lines[0] if lines else '', x0, x1, y0, y1, size=size, align=align, pad=1.4, min_size=6.5)
        return
    mid = (y0 + y1) / 2.0
    cell_box(page, fp, fn, lines[0], x0, x1, y0, mid + 0.4, size=size, align=align, pad=1.4, min_size=6.5)
    cell_box(page, fp, fn, lines[1], x0, x1, mid - 0.4, y1, size=size, align=align, pad=1.4, min_size=6.5)


def draw_info(page, fp, fn, p, y):
    person = norm_text(p.get('person_no') or p.get('id_number') or '')
    idn = norm_text(p.get('id_number') or '')
    name = norm_text(p.get('name') or '')
    page.insert_text((22.0, y + 11.0), '个人编号：' + person, fontname=fn, fontsize=10.0, color=(0, 0, 0))
    page.insert_text((187.0, y + 11.0), '身份证号：' + idn, fontname=fn, fontsize=10.0, color=(0, 0, 0))
    page.insert_text((352.0, y + 11.0), '姓名：' + name, fontname=fn, fontsize=10.0, color=(0, 0, 0))
    page.insert_text((435.0, y + 26.7), '打印区间：全部[√]  部分[  ]', fontname=fn, fontsize=9.0, color=(0, 0, 0))


def draw_header(page, fp, fn, y0):
    y1 = y0 + HEADER_H
    labels = [
        (0, '序号', 'center'),
        (1, '参保地经办机构', 'center'),
        (2, '单位编号', 'center'),
        (3, '单位名称', 'center'),
        (4, '建账年月', 'center'),
        (6, '月数', 'center'),
        (7, '缴费基数', 'center'),
        (8, '缴费性质', 'center'),
    ]
    for idx, text, align in labels:
        cell_box(page, fp, fn, text, COLS[idx], COLS[idx + 1], y0, y1, size=10.0, align=align, min_size=7.5)
    mid = (y0 + y1) / 2.0
    cell_box(page, fp, fn, '缴费对应', COLS[5], COLS[6], y0, mid + 1.0, size=9.0, align='center', min_size=7.0)
    cell_box(page, fp, fn, '起始至截止', COLS[5], COLS[6], mid - 1.0, y1, size=9.0, align='center', min_size=7.0)


def draw_row(page, fp, fn, row, y0, y1):
    seq = str(row.get('seq') or '')
    agency = norm_text(row.get('agency') or '')
    unit = norm_text(row.get('unit_code') or '')
    company = norm_text(row.get('company_name') or '')
    account = norm_text(row.get('account_ym') or '')
    period = norm_text(row.get('period_ym') or row.get('period_end') or '')
    months = str(row.get('months') if row.get('months') not in (None, '') else '1')
    base = money2(row.get('base_amount'))
    pay = norm_text(row.get('pay_type') or '正常应缴')
    cell_box(page, fp, fn, seq, COLS[0], COLS[1], y0, y1, size=9.0, min_size=7.0)
    cell_wrap(page, fp, fn, agency, COLS[1], COLS[2], y0, y1, size=9.0, align='left')
    cell_box(page, fp, fn, unit, COLS[2], COLS[3], y0, y1, size=8.6, min_size=6.5)
    cell_wrap(page, fp, fn, company, COLS[3], COLS[4], y0, y1, size=9.0, align='left')
    cell_box(page, fp, fn, account, COLS[4], COLS[5], y0, y1, size=9.0, min_size=7.0)
    cell_box(page, fp, fn, period, COLS[5], COLS[6], y0, y1, size=9.0, min_size=7.0)
    cell_box(page, fp, fn, months, COLS[6], COLS[7], y0, y1, size=9.0, min_size=7.0)
    cell_box(page, fp, fn, base, COLS[7], COLS[8], y0, y1, size=9.0, align='right', pad=2.2, min_size=7.0)
    cell_box(page, fp, fn, pay, COLS[8], COLS[9], y0, y1, size=9.0, min_size=7.0)


def draw_total(page, fp, fn, p, y0, y1):
    cell_box(page, fp, fn, '合计', COLS[0], COLS[1], y0, y1, size=9.0, min_size=7.0)
    months = p.get('total_months')
    if months is None:
        months = (p.get('totals') or {}).get('months')
    base_sum = p.get('total_base')
    if base_sum is None:
        base_sum = (p.get('totals') or {}).get('base_sum')
    cell_box(page, fp, fn, str(int(months or 0)), COLS[6], COLS[7], y0, y1, size=9.0, min_size=7.0)
    cell_box(
        page,
        fp,
        fn,
        money_total(base_sum or 0),
        COLS[7],
        COLS[8],
        y0,
        y1,
        size=9.0,
        align='right',
        pad=2.2,
        min_size=7.0,
    )


def draw_footer_meta(page, fp, fn, p, y):
    page.insert_text((22.0, y + 11.0), NOTE, fontname=fn, fontsize=10.0, color=(0, 0, 0))
    clerk = norm_text(p.get('clerk') or '')
    org = norm_text(p.get('print_org') or '')
    date = norm_text(p.get('print_date') or '')
    page.insert_text((47.0, y + 40.0), '经办人：' + clerk, fontname=fn, fontsize=10.0, color=(0, 0, 0))
    page.insert_text((331.0, y + 40.0), '打印机构：' + org, fontname=fn, fontsize=10.0, color=(0, 0, 0))
    page.insert_text((331.0, y + 62.0), '打印日期：' + date, fontname=fn, fontsize=10.0, color=(0, 0, 0))


def draw_page_no(page, fp, fn, idx, total):
    # 样张：第  1  页  共  4  页
    label = '第 %s 页 共 %s 页' % (idx, total)
    tw = text_width(fp, label, 10.0)
    page.insert_text(((PAGE_W - tw) / 2.0, 817.0), label, fontname=fn, fontsize=10.0, color=(0, 0, 0))


def draw_watermark(page, fp, fn, stamp):
    line3 = WM_LINE3_PREFIX + ('(%s)' % stamp if stamp else '')
    lines = [WM_LINE1, WM_LINE2, line3]
    size = 12.0
    color = (0.8, 0.8, 0.8)
    ang = -30.0
    rad = math.radians(ang)
    # 行间沿文字方向的下法线堆叠（y 向下）
    perp = (-math.sin(rad), math.cos(rad))
    line_gap = size * 1.35
    mat = fitz.Matrix(1, 1).prerotate(ang)
    # 2 列 × 若干行平铺，间距对齐样张（纵 ~172，横 ~410）
    col_x = [8.0, 418.0]
    row_y = [164.0, 336.0, 509.0, 681.0, 854.0]
    for x0 in col_x:
        for y0 in row_y:
            for i, ln in enumerate(lines):
                ox = x0 + perp[0] * line_gap * i
                oy = y0 + perp[1] * line_gap * i
                origin = fitz.Point(ox, oy)
                page.insert_text(
                    origin,
                    ln,
                    fontname=fn,
                    fontsize=size,
                    color=color,
                    morph=(origin, mat),
                )


def draw_seal(page):
    if not os.path.isfile(SEAL_PNG):
        return
    # 与任职明细表第 1 页盖章位置一致，略大于样张以便压住表心
    size = 118.0
    x = (PAGE_W - size) / 2.0 + 8.0
    y = 248.0
    page.insert_image(fitz.Rect(x, y, x + size, y + size), filename=SEAL_PNG, keep_proportion=True, overlay=True)


def paginate(rows):
    rows = list(rows or [])
    if not rows:
        return [[]]
    first = rows[:FIRST_ROWS]
    rest = rows[FIRST_ROWS:]
    pages = [first]
    while rest:
        pages.append(rest[:CONT_ROWS])
        rest = rest[CONT_ROWS:]
    return pages


def collect_text(p):
    parts = [TITLE, NOTE, WATERMARK, '个人编号身份证号姓名打印区间全部部分0123456789,.[√]（）()-']
    parts.append('序号参保地经办机构单位编号单位名称建账年月缴费对应起始至截止月数缴费基数缴费性质合计经办人打印机构打印日期第页共')
    for key in ('name', 'id_number', 'person_no', 'print_date', 'print_org', 'clerk', 'watermark_id'):
        parts.append(str(p.get(key) or ''))
    for row in p.get('rows') or []:
        for key in ('seq', 'agency', 'unit_code', 'company_name', 'account_ym', 'period_ym', 'months', 'base_amount', 'pay_type'):
            parts.append(str(row.get(key) or ''))
    return ''.join(parts)


def render(payload, out_pdf, auth_code=''):
    p = payload or {}
    rows = list(p.get('rows') or [])
    pages = paginate(rows)
    total = len(pages)
    body_src = ensure_full_cjk_font()
    title_src = ensure_bold_cjk_font() or body_src
    stamp = norm_text(p.get('watermark_id') or '')
    blob = collect_text(p) + str(auth_code or '') + stamp
    wm_blob = WATERMARK + WM_LINE1 + WM_LINE2 + WM_LINE3_PREFIX + '\u3000()（）-'
    body_path = make_subset_font(body_src, blob + wm_blob, prefix='sbdy_xm_')
    title_path = make_subset_font(title_src, blob + TITLE, prefix='sbdy_xm_b_')

    doc = fitz.open()
    try:
        for i, chunk in enumerate(pages):
            page = doc.new_page(width=PAGE_W, height=PAGE_H)
            fn, fbn = register_fonts(page, body_path, title_path)
            draw_watermark(page, body_path, fn, stamp)
            is_first = i == 0
            is_last = i == total - 1
            if is_first:
                tw = text_width(title_path, TITLE, 16.0)
                page.insert_text(((PAGE_W - tw) / 2.0, 42.0), TITLE, fontname=fbn, fontsize=16.0, color=(0, 0, 0))
                draw_info(page, body_path, fn, p, 46.0)
                table_y = 85.0
                cap = FIRST_ROWS
            else:
                draw_info(page, body_path, fn, p, 17.0)
                table_y = 56.0
                cap = CONT_ROWS
            n_data = len(chunk)
            extra = 1 if is_last else 0
            grid(page, table_y, 0, n_data + extra)
            draw_header(page, body_path, fn, table_y)
            y = table_y + HEADER_H
            for row in chunk:
                draw_row(page, body_path, fn, row, y, y + ROW_H)
                y += ROW_H
            if is_last:
                draw_total(page, body_path, fn, p, y, y + ROW_H)
                draw_footer_meta(page, body_path, fn, p, y + ROW_H + 13.0)
            if is_first:
                draw_seal(page)
            draw_page_no(page, body_path, fn, i + 1, total)
        os.makedirs(os.path.dirname(out_pdf) or '.', exist_ok=True)
        doc.save(out_pdf, deflate=True, garbage=4)
    finally:
        doc.close()
        for path in (body_path, title_path):
            try:
                if path and os.path.isfile(path) and path.startswith('/tmp'):
                    os.remove(path)
            except Exception:
                pass


def main():
    if len(sys.argv) < 3:
        print('usage: sbdy_xm_render_pdf.py in.json out.pdf', file=sys.stderr)
        return 2
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)
    payload = data.get('payload') if isinstance(data, dict) and data.get('payload') else data
    auth = ''
    if isinstance(data, dict):
        auth = str(data.get('auth_code') or '')
    render(payload or {}, sys.argv[2], auth)
    return 0


if __name__ == '__main__':
    sys.exit(main())
