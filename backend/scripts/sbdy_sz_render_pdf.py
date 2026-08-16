#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""深圳市社会保险历年参保缴费明细表（个人）演示 PDF。版式对齐邱智锋社保.pdf。"""
from __future__ import print_function

import json
import os
import sys
import tempfile

import fitz

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sbdy_render_pdf import (  # noqa: E402
    cell_box,
    ensure_bold_cjk_font,
    ensure_full_cjk_font,
    fit_fontsize,
    make_qr_png,
    make_subset_font,
    money,
    norm_text,
    register_fonts,
    text_width,
)

ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
SEAL_PNG = os.path.join(ASSETS, 'sz_seal.png')

PAGE_W = 612.5
X0, X1 = 33.8, 609.1
COL_X = [
    33.8, 60.9, 74.4, 115.1, 148.9, 189.5, 230.1, 257.2, 284.3,
    324.9, 365.5, 392.5, 419.6, 453.5, 480.5, 514.4, 541.4, 575.3, 609.1,
]
ROW_H = 12.0
HEAD1_H = 12.0
HEAD2_H = 18.0
ROWS_PER_PAGE = 36
MAX_MONTHS = 60


def draw_hline(page, y, width=0.5, x0=None, x1=None):
    page.draw_line(
        fitz.Point(X0 if x0 is None else x0, y),
        fitz.Point(X1 if x1 is None else x1, y),
        color=(0, 0, 0),
        width=width,
    )


def draw_vline(page, x, y0, y1, width=0.5):
    page.draw_line(fitz.Point(x, y0), fitz.Point(x, y1), color=(0, 0, 0), width=width)


def draw_rect(page, y0, y1, width=0.6):
    page.draw_rect(fitz.Rect(X0, y0, X1, y1), color=(0, 0, 0), width=width)


def ensure_months(p):
    months = list(p.get('months') or [])
    out = []
    unit = str(p.get('unit_code') or '')
    pb = p.get('pension_base', p.get('base_amount'))
    mb = p.get('medical_base', pb)
    ib = p.get('injury_base', pb)
    ub = p.get('unemp_base', pb)
    for r in months:
        if not isinstance(r, dict):
            continue
        out.append(
            {
                'year': str(r.get('year') or ''),
                'month': str(r.get('month') or '').zfill(2)[-2:],
                'unit_code': str(r.get('unit_code') or unit),
                'pension_base': r.get('pension_base', pb),
                'pension_unit': r.get('pension_unit', r.get('pension_unit_pay')),
                'pension_person': r.get('pension_person', r.get('pension_pay')),
                'medical_type': str(r.get('medical_type') or '1'),
                'medical_base': r.get('medical_base', mb),
                'medical_unit': r.get('medical_unit'),
                'medical_person': r.get('medical_person'),
                'maternity_type': str(r.get('maternity_type') or '1'),
                'maternity_base': r.get('maternity_base', mb),
                'maternity_unit': r.get('maternity_unit'),
                'injury_base': r.get('injury_base', ib),
                'injury_unit': r.get('injury_unit'),
                'unemp_base': r.get('unemp_base', ub),
                'unemp_unit': r.get('unemp_unit'),
                'unemp_person': r.get('unemp_person', r.get('unemp_pay')),
            }
        )
    if len(out) > MAX_MONTHS:
        out = out[-MAX_MONTHS:]
    return out


def chunk_months(months, size=ROWS_PER_PAGE):
    """按页切分缴费行；末页不补空白行（无数据行紧贴合计）。"""
    rows = [r for r in (months or []) if r]
    if not rows:
        return [[]]
    chunks = []
    i = 0
    while i < len(rows):
        chunks.append(list(rows[i : i + size]))
        i += size
    return chunks


def unit_map(p, months):
    """备注第 6 项：按官方清单汇总单位编号→名称（可多行，无表格线）。"""
    seen = {}
    order = []

    def add(code, name):
        code = str(code or '').strip()
        if not code or code in seen:
            return
        seen[code] = True
        order.append({'unit_code': code, 'unit_name': str(name or '').strip()})

    for item in p.get('unit_map') or []:
        if isinstance(item, dict):
            add(item.get('unit_code'), item.get('unit_name'))
    company = str(p.get('company_name') or '')
    for r in months or []:
        if not r:
            continue
        add(r.get('unit_code'), r.get('unit_name') or company)
    add(p.get('unit_code'), company)
    if not order:
        order.append({'unit_code': '', 'unit_name': company})
    return order


def totals_of(months):
    keys = [
        'pension_unit',
        'pension_person',
        'medical_unit',
        'medical_person',
        'maternity_unit',
        'injury_unit',
        'unemp_unit',
        'unemp_person',
    ]
    tot = {k: 0.0 for k in keys}
    for r in months:
        if not r:
            continue
        for k in keys:
            try:
                tot[k] += float(r.get(k) or 0)
            except Exception:
                pass
    return tot


def collect_blob(p, months, auth_code):
    parts = [
        '深圳市社会保险历年参保缴费明细表（个人）好差评二维码',
        '姓名：社保电脑号：身份证号码：页码：最近参保单位名称：单位编号：计算单位：元',
        '养老保险医疗保险生育工伤保险失业保险缴费年月单位编号基数单位交个人交险种合计备注',
        '本证明可作为参保人在本单位参加社会保险的证明。向相关部门提供，查验部门可通过登录',
        '网址：https://sipub.sz.gov.cn/vp/，输入下列验真码核查，验真码有效期三个月。',
        '生育保险中的险种“1”为生育保险，“2”为生育医疗。',
        '医疗险种中的险种“1”为基本医疗保险一档，“2”为基本医疗保险二档，“4”为基本医疗保险三档',
        '“5”为居民医疗保险医保，“6”为统筹医疗保险。',
        '上述“缴费明细”表中带“*”标识为补缴，空行为断缴。',
        '居民养老保险、居民（含少儿/学生）医疗保险不在本清单。',
        '单位编号对应的单位名称：单位编号单位名称深圳市社会保险基金管理局打印日期：',
        str(p.get('name') or ''),
        str(p.get('computer_no') or ''),
        str(p.get('id_number') or ''),
        str(p.get('company_name') or ''),
        str(p.get('unit_code') or ''),
        str(auth_code or ''),
        str(p.get('print_date') or ''),
    ]
    for item in p.get('unit_map') or []:
        if isinstance(item, dict):
            parts.append(str(item.get('unit_code') or ''))
            parts.append(str(item.get('unit_name') or ''))
    for r in months:
        if not r:
            continue
        parts.extend([str(v) for v in r.values()])
        parts.append(money(r.get('pension_base')))
    return ''.join(norm_text(x) for x in parts)


def draw_title(page, font_title, title_name, font_body, body_name, qr_path, page_idx, total_pages):
    title = '深圳市社会保险历年参保缴费明细表（个人）'
    tsize = 15.0
    tw = text_width(font_title, title, tsize)
    page.insert_text(((PAGE_W - tw) / 2.0, 88.0), title, fontname=title_name, fontsize=tsize)
    if qr_path and os.path.isfile(qr_path):
        page.insert_image(fitz.Rect(38, 8, 90, 60), filename=qr_path)
    page.insert_text((36.0, 72.0), '好差评二维码', fontname=body_name, fontsize=8.0)
    if os.path.isfile(SEAL_PNG):
        # 章盖在标题右侧空白，底边须高于表头，避免压住工伤/失业列
        page.insert_image(fitz.Rect(508, 6, 600, 98), filename=SEAL_PNG, keep_proportion=True)
    page.insert_text(
        (555.0, 114.0),
        '页码：%d' % page_idx,
        fontname=body_name,
        fontsize=7.0,
    )


def draw_info(page, font_body, body_name, p):
    line1 = '姓名：%s' % (p.get('name') or '')
    line1b = '社保电脑号：%s' % (p.get('computer_no') or '')
    line1c = '身份证号码：%s' % (p.get('id_number') or '')
    page.insert_text((47.4, 114.0), line1, fontname=body_name, fontsize=7.0)
    page.insert_text((159.1, 114.0), line1b, fontname=body_name, fontsize=7.0)
    page.insert_text((301.2, 114.0), line1c, fontname=body_name, fontsize=7.0)
    line2 = '最近参保单位名称：%s' % (p.get('company_name') or '')
    line2b = '单位编号：%s' % (p.get('unit_code') or '')
    line2c = '计算单位：元'
    page.insert_text((47.4, 128.0), line2, fontname=body_name, fontsize=7.0)
    page.insert_text((301.2, 128.0), line2b, fontname=body_name, fontsize=7.0)
    page.insert_text((555.0, 128.0), line2c, fontname=body_name, fontsize=7.0)


# 表头第一行只在险种分组边界拉竖线，组内竖线从第二行起（对齐邱智锋原件）
HEAD_GROUP_BOUNDARIES = (0, 1, 2, 3, 6, 10, 13, 15, 18)
HEAD_INNER_VLINES = (4, 5, 7, 8, 9, 11, 12, 14, 16, 17)


def draw_table_head(page, font_title, title_name, y0):
    y1 = y0 + HEAD1_H
    y2 = y1 + HEAD2_H
    draw_rect(page, y0, y2)
    # 中间横线不穿过「缴费年 / 月 / 单位编号」跨行格
    draw_hline(page, y1, x0=COL_X[3], x1=COL_X[-1])
    for i in HEAD_GROUP_BOUNDARIES:
        draw_vline(page, COL_X[i], y0, y2)
    for i in HEAD_INNER_VLINES:
        draw_vline(page, COL_X[i], y1, y2)
    # 缴费年 / 月 / 单位编号 跨两行
    cell_box(page, font_title, title_name, '缴费年', COL_X[0], COL_X[1], y0, y2, size=7.0)
    cell_box(page, font_title, title_name, '月', COL_X[1], COL_X[2], y0, y2, size=7.0)
    cell_box(page, font_title, title_name, '单位编号', COL_X[2], COL_X[3], y0, y2, size=7.0)
    groups = [
        (3, 6, '养老保险'),
        (6, 10, '医疗保险'),
        (10, 13, '生育'),
        (13, 15, '工伤保险'),
        (15, 18, '失业保险'),
    ]
    for a, b, lab in groups:
        cell_box(page, font_title, title_name, lab, COL_X[a], COL_X[b], y0, y1, size=8.0)
    sub = [
        (3, '基数'), (4, '单位交'), (5, '个人交'),
        (6, '险种'), (7, '基数'), (8, '单位交'), (9, '个人交'),
        (10, '险种'), (11, '基数'), (12, '单位交'),
        (13, '基数'), (14, '单位交'),
        (15, '基数'), (16, '单位交'), (17, '个人交'),
    ]
    for ci, lab in sub:
        cell_box(page, font_title, title_name, lab, COL_X[ci], COL_X[ci + 1], y1, y2, size=7.0)
    return y2


def row_vals(r):
    if not r:
        return [''] * 18
    return [
        r.get('year') or '',
        r.get('month') or '',
        r.get('unit_code') or '',
        money(r.get('pension_base')),
        money(r.get('pension_unit')),
        money(r.get('pension_person')),
        r.get('medical_type') or '',
        money(r.get('medical_base')),
        money(r.get('medical_unit')),
        money(r.get('medical_person')),
        r.get('maternity_type') or '',
        money(r.get('maternity_base')),
        money(r.get('maternity_unit')),
        money(r.get('injury_base')),
        money(r.get('injury_unit')),
        money(r.get('unemp_base')),
        money(r.get('unemp_unit')),
        money(r.get('unemp_person')),
    ]


def draw_data_rows(page, font_body, body_name, chunk, y0, draw_total, tot):
    n = len(chunk)
    y_end = y0 + ROW_H * n
    extra = 18.0 if draw_total else 0
    draw_rect(page, y0, y_end + extra)
    for i in range(1, n):
        draw_hline(page, y0 + ROW_H * i)
    if draw_total:
        draw_hline(page, y_end)
    for x in COL_X:
        draw_vline(page, x, y0, y_end + extra)
    for i, r in enumerate(chunk):
        yy0 = y0 + ROW_H * i
        yy1 = yy0 + ROW_H
        if not r:
            continue
        vals = row_vals(r)
        for ci, val in enumerate(vals):
            cell_box(
                page, font_body, body_name, val,
                COL_X[ci], COL_X[ci + 1], yy0, yy1,
                size=6.6, min_size=5.2,
            )
    if draw_total:
        tot_h = extra or 18.0
        cell_box(page, font_body, body_name, '合计', COL_X[0], COL_X[3], y_end, y_end + tot_h, size=7.0)
        tot_vals = {
            4: tot.get('pension_unit'),
            5: tot.get('pension_person'),
            8: tot.get('medical_unit'),
            9: tot.get('medical_person'),
            12: tot.get('maternity_unit'),
            14: tot.get('injury_unit'),
            16: tot.get('unemp_unit'),
            17: tot.get('unemp_person'),
        }
        for ci, val in tot_vals.items():
            cell_box(
                page, font_body, body_name, money(val),
                COL_X[ci], COL_X[ci + 1], y_end, y_end + tot_h,
                size=6.6, min_size=5.2,
            )
    return y_end + extra


def draw_footer(page, font_body, body_name, p, auth_code, mapping, y_top, page_h):
    y = y_top + 14
    notes = [
        '备注：',
        '1.本证明可作为参保人在本单位参加社会保险的证明。向相关部门提供，查验部门可通过登录',
        '网址：https://sipub.sz.gov.cn/vp/，输入下列验真码（%s）核查，验真码有效期三个月。' % (auth_code or ''),
        '2.生育保险中的险种“1”为生育保险，“2”为生育医疗。',
        '3.医疗险种中的险种“1”为基本医疗保险一档，“2”为基本医疗保险二档，“4”为基本医疗保险三档，“5”为居民医疗保险医保，',
        '“6”为统筹医疗保险。',
        '4.上述“缴费明细”表中带“*”标识为补缴，空行为断缴。',
        '5.居民养老保险、居民（含少儿/学生）医疗保险不在本清单。',
        '6.单位编号对应的单位名称：',
    ]
    for i, line in enumerate(notes):
        page.insert_text((47.4, y + i * 11.0), line, fontname=body_name, fontsize=7.0)
    # 官方版式：无框双列，左单位编号、右单位名称（对齐邱智锋社保.pdf）
    y2 = y + len(notes) * 11.0
    code_x = 67.9
    name_x = 256.7
    th = 8.0
    page.insert_text((code_x, y2), '单位编号', fontname=body_name, fontsize=7.0)
    page.insert_text((name_x, y2), '单位名称', fontname=body_name, fontsize=7.0)
    for i, item in enumerate(mapping or []):
        yy = y2 + th * (i + 1)
        page.insert_text(
            (code_x, yy),
            str(item.get('unit_code') or ''),
            fontname=body_name,
            fontsize=7.0,
        )
        page.insert_text(
            (name_x, yy),
            str(item.get('unit_name') or ''),
            fontname=body_name,
            fontsize=7.0,
        )
    bureau = '深圳市社会保险基金管理局'
    page.insert_text((402.2, page_h - 88), bureau, fontname=body_name, fontsize=8.0)
    pd = '打印日期：' + str(p.get('print_date') or '')
    page.insert_text((402.2, page_h - 72), pd, fontname=body_name, fontsize=8.0)
    if os.path.isfile(SEAL_PNG):
        page.insert_image(
            fitz.Rect(402, page_h - 144, 522, page_h - 24),
            filename=SEAL_PNG,
            keep_proportion=True,
        )


def page_height_for(n_rows, with_footer):
    header = 144.0
    table = HEAD1_H + HEAD2_H + ROW_H * n_rows + (18.0 if with_footer else 0)
    footer = 377.0 if with_footer else 40.0
    h = header + table + footer
    return max(1013.0 if with_footer else 842.0, h)


def render(payload, auth_code, qr_url, out_path):
    p = payload or {}
    months = ensure_months(p)
    real = [m for m in months if m]
    chunks = chunk_months(real, ROWS_PER_PAGE)
    total_pages = len(chunks)
    tot = totals_of(real)
    mapping = unit_map(p, real)
    blob = collect_blob(p, real, auth_code)
    full_body = ensure_full_cjk_font()
    full_title = ensure_bold_cjk_font()
    subset_body = make_subset_font(full_body, blob, prefix='sbdy_sz_body_')
    subset_title = make_subset_font(
        full_title,
        '深圳市社会保险历年参保缴费明细表（个人）养老保险医疗保险生育工伤保险失业保险缴费年月单位编号基数单位交个人交险种合计备注',
        prefix='sbdy_sz_title_',
    )
    qr_path = None
    doc = None
    try:
        doc = fitz.open()
        qr_path = os.path.join(tempfile.gettempdir(), 'sbdy_sz_qr_%s.png' % os.getpid())
        make_qr_png(qr_url or 'https://sipub.sz.gov.cn/vp/', qr_path)
        for page_idx, chunk in enumerate(chunks, start=1):
            is_last = page_idx == total_pages
            n_draw = len(chunk)
            ph = page_height_for(n_draw, is_last)
            page = doc.new_page(width=PAGE_W, height=ph)
            body_name, title_name = register_fonts(page, subset_body, subset_title)
            draw_title(page, subset_title, title_name, subset_body, body_name, qr_path, page_idx, total_pages)
            if page_idx == 1:
                draw_info(page, subset_body, body_name, p)
            y_head = 144.0
            y_data = draw_table_head(page, subset_title, title_name, y_head)
            y_end = draw_data_rows(
                page, subset_body, body_name, chunk, y_data, is_last, tot
            )
            if is_last:
                draw_footer(page, subset_body, body_name, p, auth_code, mapping, y_end, ph)
        doc.save(out_path, deflate=True, garbage=4)
        doc.close()
        doc = None
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass
        for path in (qr_path, subset_body, subset_title):
            if path:
                try:
                    os.remove(path)
                except Exception:
                    pass


def main():
    if len(sys.argv) < 3:
        print('usage: sbdy_sz_render_pdf.py <payload.json> <out.pdf>', file=sys.stderr)
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
