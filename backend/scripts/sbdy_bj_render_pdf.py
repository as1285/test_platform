#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""北京市社会保险个人权益记录（参保人员缴费信息）演示 PDF。

版式对齐 2026 横向样张（A4 landscape）：
- 居中标题一行 + 标题上方左右两枚红章；
- 参保人姓名 / 社会保障号码 / 单位名称 + 校验码 / 查询流水号 / 查询日期（查询时段）；
- 一、养老保险单位变动记录（缴费区县为经办机构全称）；
- 二、五险缴费明细（按年，合计空基数为 ------）；
- 三、补充资料（累计缴费年限 + 趸缴 + 个人账户本息合计）+ 备注 + 出具机构与日期。
"""
from __future__ import print_function

import json
import os
import sys
import tempfile

import fitz
from fontTools.ttLib import TTCollection

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sbdy_render_pdf import (  # noqa: E402
    cell_box,
    ensure_bold_cjk_font,
    ensure_full_cjk_font,
    make_subset_font,
    norm_text,
    register_fonts,
)

ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
SEAL_SI = os.path.join(ASSETS, 'bj_si_seal.png')
SEAL_MI = os.path.join(ASSETS, 'bj_mi_seal.png')
NOTO_SANS_TTC = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
NOTO_SANS_CACHE = os.path.join(tempfile.gettempdir(), 'sbdy_NotoSansCJKsc-Regular.otf')

PAGE_W, PAGE_H = 842.0, 595.0
X0, X1 = 47.0, 802.0
LW = 0.6
TITLE = '北京市社会保险个人权益记录(参保人员缴费信息)'
VERIFY_URL = 'http://fuwu.rsj.beijing.gov.cn/bjdkhy/ggfw/'
NOTE_LINES = [
    '备注：',
    '1.如需鉴定真伪，请30日内通过登录  ' + VERIFY_URL + ' ，进入“社保权益单校验”，录入校验码和查询流水号进行甄别，黑色与',
    '红色印章效力相同。',
    '2.为保证信息安全，请妥善保管个人权益记录。',
    '3.上述“缴费起止年月”栏目中带“*”标识为该年内含有补缴信息。',
    '4.养老、工伤、失业保险相关数据来源于社保经办机构，医疗、生育保险相关数据来源于医保经办机构。',
]

EMP_X = [47.0, 142.0, 237.0, 332.0, 562.0, 802.0]
DETAIL_X = [47.0, 177.0, 207.0, 272.0, 322.0, 352.0, 417.0, 467.0, 497.0, 562.0, 592.0, 657.0, 707.0, 737.0, 802.0]
ROW_H = 20.0
Y_META0 = 110.8
META_H = 19.0
Y_BOTTOM = 568.0
Y_PAGE_NO = 576.3

_HEI_FONT = None


def ensure_hei_cjk_font():
    """正文/标题用黑体（Noto Sans SC），贴近官方 SimHei。"""
    global _HEI_FONT
    if _HEI_FONT and os.path.isfile(_HEI_FONT):
        return _HEI_FONT
    if os.path.isfile(NOTO_SANS_CACHE) and os.path.getsize(NOTO_SANS_CACHE) > 1_000_000:
        _HEI_FONT = NOTO_SANS_CACHE
        return _HEI_FONT
    if os.path.isfile(NOTO_SANS_TTC):
        ttc = TTCollection(NOTO_SANS_TTC)
        face = ttc.fonts[2]
        face.flavor = None
        face.save(NOTO_SANS_CACHE)
        _HEI_FONT = NOTO_SANS_CACHE
        return _HEI_FONT
    try:
        return ensure_full_cjk_font()
    except Exception:
        return ensure_bold_cjk_font()


def money2(n, months=1):
    if not months:
        return ''
    try:
        x = float(n)
    except Exception:
        return ''
    return '%.2f' % x


def num_or_blank(n, months=1):
    if not months:
        return ''
    try:
        x = float(n)
    except Exception:
        return ''
    if abs(x) < 1e-9:
        return ''
    if abs(x - round(x)) < 1e-9:
        return str(int(round(x)))
    return '%.2f' % x


def months_or_blank(n):
    try:
        x = int(round(float(n)))
    except Exception:
        return ''
    return str(x) if x else ''


def dash_if_total(val):
    return val if val else '------'


def hline(page, y, x0=None, x1=None, width=LW):
    page.draw_line(
        fitz.Point(X0 if x0 is None else x0, y),
        fitz.Point(X1 if x1 is None else x1, y),
        color=(0, 0, 0),
        width=width,
    )


def vline(page, x, y0, y1, width=LW):
    page.draw_line(fitz.Point(x, y0), fitz.Point(x, y1), color=(0, 0, 0), width=width)


def grid(page, xs, ys):
    for y in ys:
        hline(page, y, xs[0], xs[-1])
    for x in xs:
        vline(page, x, ys[0], ys[-1])


def draw_seals(page):
    size = 121.0
    y = 18.0
    if os.path.isfile(SEAL_MI):
        page.insert_image(fitz.Rect(303, y, 303 + size, y + size), filename=SEAL_MI)
    if os.path.isfile(SEAL_SI):
        page.insert_image(fitz.Rect(450, y, 450 + size, y + size), filename=SEAL_SI)


def draw_header(page, fp, fn, fb, fbn, p, auth_code):
    draw_seals(page)
    cell_box(page, fb, fbn, TITLE, 70, PAGE_W - 70, 72, 94, size=15.0, min_size=11.0)
    name = norm_text(p.get('name'))
    verify = norm_text(p.get('verify_code'))
    idn = norm_text(p.get('id_number'))
    serial = norm_text(p.get('query_serial') or auth_code)
    company = norm_text(
        p.get('header_company') if p.get('header_company') is not None else p.get('company_name')
    )
    qdate = norm_text(p.get('query_date_label') or p.get('query_period_label') or p.get('period_label'))
    rows = [
        ('参保人姓名:', name, '校验码:', verify),
        ('社会保障号码:', idn, '查询流水号:', serial),
        ('单位名称:', company, '查询日期:', qdate),
    ]
    for i, (l1, v1, l2, v2) in enumerate(rows):
        y = Y_META0 + i * META_H
        cell_box(page, fp, fn, l1, 47, 122, y, y + 12, size=10.0, align='left', pad=0)
        cell_box(page, fp, fn, v1, 125, 520, y, y + 12, size=10.0, align='left', pad=0)
        cell_box(page, fp, fn, l2, 539, 614, y, y + 12, size=10.0, align='left', pad=0)
        cell_box(page, fp, fn, v2, 616, 802, y, y + 12, size=10.0, align='left', pad=0)
    return Y_META0 + 3 * META_H + 6


def draw_page_no(page, fp, fn, idx, total):
    cell_box(
        page,
        fp,
        fn,
        '第 %d 页 ( 共 %d 页 )' % (idx, total),
        X0,
        X1,
        Y_PAGE_NO,
        Y_PAGE_NO + 12,
        size=10.0,
    )


def draw_section(page, fp, fn, title, y):
    cell_box(page, fp, fn, title, X0, X1, y, y + 16, size=10.0, align='left', pad=0)
    return y + 18


def draw_emp_table(page, fp, fn, employers, y):
    heads = ['缴费起始年月', '缴费截止年月', '实际缴费月数', '单位名称', '缴费区县']
    rows = list(employers or []) or [{}]
    ys = [y]
    for _ in range(len(rows) + 1):
        ys.append(ys[-1] + ROW_H)
    grid(page, EMP_X, ys)
    for i, h in enumerate(heads):
        cell_box(page, fp, fn, h, EMP_X[i], EMP_X[i + 1], ys[0], ys[1], size=10.0, min_size=7.0)
    for i, r in enumerate(rows):
        vals = [
            r.get('start_ym') or '',
            r.get('end_ym') or '',
            str(r.get('months') or '') if r else '',
            r.get('company_name') or '',
            r.get('agency') or '',
        ]
        for j, val in enumerate(vals):
            cell_box(
                page,
                fp,
                fn,
                val,
                EMP_X[j],
                EMP_X[j + 1],
                ys[i + 1],
                ys[i + 2],
                size=10.0,
                min_size=6.5,
            )
    return ys[-1]


def year_cells(r):
    return [
        r.get('label') or '',
        months_or_blank(r.get('pension_months')),
        num_or_blank(r.get('pension_base'), r.get('pension_months')),
        money2(r.get('pension_pay'), r.get('pension_months')),
        months_or_blank(r.get('unemp_months')),
        num_or_blank(r.get('unemp_base'), r.get('unemp_months')),
        money2(r.get('unemp_pay'), r.get('unemp_months')),
        months_or_blank(r.get('injury_months')),
        num_or_blank(r.get('injury_base'), r.get('injury_months')),
        months_or_blank(r.get('medical_months')),
        num_or_blank(r.get('medical_base'), r.get('medical_months')),
        money2(r.get('medical_pay'), r.get('medical_months')),
        months_or_blank(r.get('maternity_months')),
        num_or_blank(r.get('maternity_base'), r.get('maternity_months')),
    ]


def total_cells(t):
    return [
        '合计',
        months_or_blank(t.get('pension_months')),
        dash_if_total(''),
        money2(t.get('pension_pay'), t.get('pension_months')),
        months_or_blank(t.get('unemp_months')),
        dash_if_total(''),
        money2(t.get('unemp_pay'), t.get('unemp_months')),
        months_or_blank(t.get('injury_months')),
        dash_if_total(''),
        months_or_blank(t.get('medical_months')),
        dash_if_total(''),
        money2(t.get('medical_pay'), t.get('medical_months')),
        months_or_blank(t.get('maternity_months')),
        dash_if_total(''),
    ]


def draw_detail_header(page, fp, fn, y):
    h1 = y
    mid = y + 16
    h2 = y + 40
    groups = [
        (0, 1, '缴费起止年月'),
        (1, 4, '养老实际缴费'),
        (4, 7, '失业实际缴费'),
        (7, 9, '工伤实际缴费'),
        (9, 12, '医疗实际缴费'),
        (12, 14, '生育实际缴费'),
    ]
    xs = DETAIL_X
    grid(page, xs, [h1, mid, h2])
    page.draw_line(fitz.Point(xs[0] + 0.4, mid), fitz.Point(xs[1] - 0.4, mid), color=(1, 1, 1), width=1.4)
    for a, b, title in groups:
        if b - a == 1:
            cell_box(page, fp, fn, title, xs[a], xs[b], h1, h2, size=10.0, min_size=7.0)
        else:
            cell_box(page, fp, fn, title, xs[a], xs[b], h1, mid, size=10.0, min_size=7.0)
    sub = [
        '',
        '月数',
        '年缴费基数',
        '个人缴费',
        '月数',
        '年缴费基数',
        '个人缴费',
        '月数',
        '年缴费基数',
        '月数',
        '年缴费基数',
        '个人缴费',
        '月数',
        '年缴费基数',
    ]
    for i, lab in enumerate(sub):
        if not lab:
            continue
        cell_box(page, fp, fn, lab, xs[i], xs[i + 1], mid, h2, size=10.0, min_size=6.5)
    return h2


def draw_detail_rows(page, fp, fn, rows, y0, include_total=None):
    xs = DETAIL_X
    data = list(rows or [])
    if include_total is not None:
        data = data + [None]
    y = y0
    for r in data:
        y1 = y + ROW_H
        hline(page, y1, xs[0], xs[-1])
        for x in xs:
            vline(page, x, y, y1)
        cells = total_cells(include_total) if r is None else year_cells(r)
        for j, val in enumerate(cells):
            cell_box(
                page,
                fp,
                fn,
                val,
                xs[j],
                xs[j + 1],
                y,
                y1,
                size=10.0,
                min_size=6.0,
                pad=1.0,
            )
        y = y1
    return y


def lump_label(p, key):
    return norm_text(p.get(key)) or '00年00个月'


def draw_left_line(page, fn, text, x, y, size=10.0):
    page.insert_text((x, y), text, fontname=fn, fontsize=size)


def draw_summary_page(page, fp, fn, p):
    y = draw_section(page, fp, fn, '三、补充资料', 168.0)
    line1 = (
        '参保人在我市养老保险累计实际缴费年限 %s  (其中趸缴年限 %s)，医疗保险累计实际缴费年限 %s(其中趸缴年限 %s)。'
        % (
            norm_text(p.get('pension_years_label')),
            lump_label(p, 'pension_lump_label'),
            norm_text(p.get('medical_years_label')),
            lump_label(p, 'medical_lump_label'),
        )
    )
    line2 = (
        '截至     %s    年末，参保人在我市养老保险个人账户本息合计金额：    %s     元。'
        % (norm_text(p.get('as_of_year')), money2(p.get('account_balance'), 1))
    )
    draw_left_line(page, fn, line1, X0 + 12, y + 10)
    draw_left_line(page, fn, line2, X0 + 12, y + 26)
    y = y + 48
    cell_box(page, fp, fn, NOTE_LINES[0], X0, X1, y, y + 14, size=10.0, align='left', pad=0)
    y += 22
    for line in NOTE_LINES[1:]:
        draw_left_line(page, fn, line, X0 + 12, y)
        y += 14
    agency = norm_text(p.get('agency_name') or '北京市朝阳区社会保险基金管理中心')
    date = '日期: ' + norm_text(p.get('print_date') or '')
    cell_box(page, fp, fn, agency, 500, 774, 328, 342, size=10.0, align='right', pad=0)
    cell_box(page, fp, fn, date, 500, 774, 348, 362, size=10.0, align='right', pad=0)


def collect_text(p, auth_code):
    parts = [
        TITLE,
        '参保人姓名:社会保障号码:单位名称:校验码:查询流水号:查询日期:',
        '一、养老保险单位变动记录：缴费起始年月缴费截止年月实际缴费月数缴费区县',
        '二、五险缴费明细：养老失业工伤医疗生育实际缴费月数年缴费基数个人缴费合计------',
        '三、补充资料参保人在我市养老保险累计实际缴费年限其中趸缴年限医疗保险',
        '截至年末参保人在我市养老保险个人账户本息合计金额元',
        ''.join(NOTE_LINES),
        '社保权益单校验黑色与红色印章效力相同第页共日期:',
        VERIFY_URL,
        norm_text(auth_code),
    ]
    for key in (
        'name',
        'id_number',
        'company_name',
        'verify_code',
        'query_serial',
        'header_company',
        'query_date_label',
        'query_period_label',
        'period_label',
        'pension_total_months',
        'medical_total_months',
        'agency_name',
        'print_date',
        'pension_years_label',
        'medical_years_label',
        'pension_lump_label',
        'medical_lump_label',
        'as_of_year',
        'account_balance',
        'verify_url',
    ):
        parts.append(norm_text(p.get(key)))
    for r in p.get('employers') or []:
        parts.extend([norm_text(r.get(k)) for k in ('start_ym', 'end_ym', 'months', 'company_name', 'agency')])
    for r in p.get('year_rows') or []:
        parts.append(norm_text(r.get('label')))
        for k in (
            'pension_months',
            'pension_base',
            'pension_pay',
            'unemp_months',
            'unemp_base',
            'unemp_pay',
            'injury_months',
            'injury_base',
            'medical_months',
            'medical_base',
            'medical_pay',
            'maternity_months',
            'maternity_base',
        ):
            parts.append(norm_text(r.get(k)))
    t = p.get('totals') or {}
    parts.extend([norm_text(v) for v in t.values()])
    return ''.join(parts)


def page1_year_cap(emp_n):
    n = max(1, int(emp_n or 1))
    y = 175.0 + 18.0 + ROW_H * (n + 1) + 10.0 + 18.0 + 40.0
    return max(1, int((Y_BOTTOM - y) // ROW_H))


def cont_year_cap():
    y = 168.0 + 40.0
    return max(1, int((Y_BOTTOM - y) // ROW_H))


def chunk_employers(employers):
    rows = list(employers or []) or [{}]
    first, rest = 14, 18
    if len(rows) <= first:
        return [rows]
    chunks = [rows[:first]]
    tail = rows[first:]
    while tail:
        chunks.append(tail[:rest])
        tail = tail[rest:]
    return chunks


def chunk_years(year_rows, first_cap):
    rows = list(year_rows or [])
    if len(rows) <= first_cap:
        return [rows]
    chunks = [rows[:first_cap]]
    cap = cont_year_cap()
    rest = rows[first_cap:]
    while rest:
        # last continuation reserves one row for 合计
        take = cap if rest[cap:] else cap
        chunks.append(rest[:take])
        rest = rest[take:]
    return chunks


def render(payload, out_pdf, auth_code=''):
    p = payload or {}
    year_rows = list(p.get('year_rows') or [])
    emp_chunks = chunk_employers(p.get('employers'))
    first_years = page1_year_cap(len(emp_chunks[0])) if len(emp_chunks) == 1 else 0
    if first_years <= 0:
        first_years = 1 if len(emp_chunks) == 1 else 0
    if len(emp_chunks) > 1:
        year_chunks = chunk_years(year_rows, cont_year_cap() - 1)
    else:
        year_chunks = chunk_years(year_rows, first_years)
    total_pages = len(emp_chunks) + max(0, len(year_chunks) - (1 if len(emp_chunks) == 1 else 0)) + 1
    if len(emp_chunks) == 1:
        total_pages = len(year_chunks) + 1
    else:
        total_pages = len(emp_chunks) + len(year_chunks) + 1
    blob = collect_text(p, auth_code)
    hei = ensure_hei_cjk_font()
    body_path = make_subset_font(hei, blob + TITLE, prefix='sbdy_bj_')
    title_path = body_path
    doc = fitz.open()
    try:
        page_i = 0
        year_i = 0
        for ei, emps in enumerate(emp_chunks):
            page = doc.new_page(width=PAGE_W, height=PAGE_H)
            fn, fbn = register_fonts(page, body_path, title_path)
            y = draw_header(page, body_path, fn, title_path, fbn, p, auth_code)
            if ei == 0:
                y = draw_section(page, body_path, fn, '一、养老保险单位变动记录：', y)
            y = draw_emp_table(page, body_path, fn, emps, y + 2)
            last_emp = ei == len(emp_chunks) - 1
            if last_emp and year_chunks:
                y = draw_section(page, body_path, fn, '二、五险缴费明细：', y + 8)
                y = draw_detail_header(page, body_path, fn, y)
                last_year = year_i == len(year_chunks) - 1
                draw_detail_rows(
                    page,
                    body_path,
                    fn,
                    year_chunks[year_i],
                    y,
                    include_total=p.get('totals') if last_year else None,
                )
                year_i += 1
            page_i += 1
            draw_page_no(page, body_path, fn, page_i, total_pages)
        while year_i < len(year_chunks):
            page = doc.new_page(width=PAGE_W, height=PAGE_H)
            fn, fbn = register_fonts(page, body_path, title_path)
            y = draw_header(page, body_path, fn, title_path, fbn, p, auth_code)
            y = draw_detail_header(page, body_path, fn, y + 4)
            last_year = year_i == len(year_chunks) - 1
            draw_detail_rows(
                page,
                body_path,
                fn,
                year_chunks[year_i],
                y,
                include_total=p.get('totals') if last_year else None,
            )
            page_i += 1
            draw_page_no(page, body_path, fn, page_i, total_pages)
            year_i += 1
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        fn, fbn = register_fonts(page, body_path, title_path)
        draw_header(page, body_path, fn, title_path, fbn, p, auth_code)
        draw_summary_page(page, body_path, fn, p)
        page_i += 1
        draw_page_no(page, body_path, fn, page_i, total_pages)
        os.makedirs(os.path.dirname(out_pdf) or '.', exist_ok=True)
        doc.save(out_pdf, deflate=True, garbage=4)
    finally:
        doc.close()
        for path in (body_path,):
            try:
                if path and os.path.isfile(path) and path.startswith('/tmp') and 'fontcache' not in path:
                    os.remove(path)
            except Exception:
                pass


def main():
    if len(sys.argv) < 3:
        print('usage: sbdy_bj_render_pdf.py in.json out.pdf', file=sys.stderr)
        return 2
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)
    payload = data.get('payload') if isinstance(data, dict) and data.get('payload') else data
    auth = ''
    if isinstance(data, dict):
        auth = str(data.get('auth_code') or '')
    if isinstance(payload, dict) and not auth:
        auth = str(payload.get('query_serial') or payload.get('auth_code') or '')
    render(payload or {}, sys.argv[2], auth)
    return 0


if __name__ == '__main__':
    sys.exit(main())
