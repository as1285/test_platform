#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""北京市社会保险个人权益记录（参保人员缴费信息）演示 PDF。

版式对齐北京市社会保险个人权益记录样张：
- 居中标题 + 左右两枚红章；
- 参保人姓名 / 社会保障号码 / 单位名称 + 校验码 / 查询流水号 / 查询日期 / 查询时间段；
- 一、养老保险单位变动记录（缴费区县为北京市××区）；
- 二、五险缴费明细（按年，* 为补缴）；
- 三、补充资料（累计缴费月数 + 个人账户资金余额）+ 备注 + 出具机构与日期。
"""
from __future__ import print_function

import json
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
)

ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
SEAL_SI = os.path.join(ASSETS, 'bj_si_seal.png')
SEAL_MI = os.path.join(ASSETS, 'bj_mi_seal.png')

PAGE_W, PAGE_H = 595.0, 842.0
X0, X1 = 26.0, 569.0
LW = 0.55
TITLE1 = '北京市社会保险个人权益记录'
TITLE2 = '（参保人员缴费信息）'
VERIFY_URL = 'http://fuwu.rsj.beijing.gov.cn/bjdkhy/ggfw/'
NOTE_LINES = [
    '备注：',
    '1. 本记录可通过北京市人力资源和社会保障局公共服务平台核验：' + VERIFY_URL,
    '2. 本记录涉及个人权益信息，请妥善保管，因泄露造成的不良后果由参保人自行承担。',
    '3. 缴费起止年月前标注“*”的，含补缴信息。',
    '4. 养老保险、工伤保险、失业保险数据来源于社会保险经办机构；医疗保险、生育保险数据来源于医疗保险经办机构。',
]

EMP_X = [26.0, 88.0, 150.0, 198.0, 360.0, 569.0]
# 缴费起止 | 养老3 | 失业3 | 工伤2 | 医疗3 | 生育2
DETAIL_W = [70, 24, 40, 38, 24, 40, 38, 24, 40, 24, 40, 38, 24, 39]


def detail_x():
    xs = [X0]
    for w in DETAIL_W:
        xs.append(xs[-1] + w)
    xs[-1] = X1
    return xs


DETAIL_X = detail_x()


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
    size = 78.0
    y = 18.0
    if os.path.isfile(SEAL_SI):
        page.insert_image(fitz.Rect(38, y, 38 + size, y + size), filename=SEAL_SI)
    if os.path.isfile(SEAL_MI):
        page.insert_image(fitz.Rect(PAGE_W - 38 - size, y, PAGE_W - 38, y + size), filename=SEAL_MI)


def draw_watermark(page, fp, fn):
    text = '本文件由全国社保卡服务平台提供 仅供查询使用'
    color = (0.84, 0.84, 0.84)
    mat = fitz.Matrix(1, 1).prerotate(28)
    y = 180.0
    x = 90.0
    while y < PAGE_H - 50:
        origin = fitz.Point(x, y)
        page.insert_text(
            origin,
            text,
            fontname=fn,
            fontsize=12.5,
            color=color,
            morph=(origin, mat),
        )
        y += 100.0
        x = 70.0 if x > 80 else 120.0


def draw_header(page, fp, fn, fb, fbn, p, auth_code):
    draw_watermark(page, fp, fn)
    draw_seals(page)
    cell_box(page, fb, fbn, TITLE1, 70, PAGE_W - 70, 28, 50, size=15.0, min_size=11.0)
    cell_box(page, fb, fbn, TITLE2, 70, PAGE_W - 70, 48, 66, size=12.5, min_size=10.0)
    y0 = 88.0
    row_h = 16.0
    labels = [
        ('参保人姓名', p.get('name') or ''),
        ('校验码', p.get('verify_code') or ''),
        ('社会保障号码', p.get('id_number') or ''),
        ('查询流水号', p.get('query_serial') or auth_code or ''),
        ('单位名称', p.get('header_company') if p.get('header_company') is not None else p.get('company_name') or ''),
        ('查询日期', p.get('query_date_label') or p.get('print_date') or ''),
        ('查询时间段', p.get('query_period_label') or p.get('period_label') or ''),
        ('', ''),
    ]
    mid = (X0 + X1) / 2.0
    for i, (lab, val) in enumerate(labels):
        col = i % 2
        row = i // 2
        x0 = X0 if col == 0 else mid + 8
        x1 = mid - 8 if col == 0 else X1
        y = y0 + row * row_h
        if lab:
            cell_box(page, fb, fbn, lab, x0, x0 + 78, y, y + row_h, size=10.0, align='left', pad=0.5)
            cell_box(page, fp, fn, val, x0 + 78, x1, y, y + row_h, size=10.0, align='left', pad=0.5)
    return y0 + 4 * row_h + 6


def draw_page_no(page, fp, fn, idx, total):
    cell_box(
        page,
        fp,
        fn,
        '第%d页 （共%d页）' % (idx, total),
        X0,
        X1,
        PAGE_H - 36,
        PAGE_H - 20,
        size=10.0,
    )


def draw_emp_table(page, fp, fn, fb, fbn, employers, y):
    cell_box(page, fb, fbn, '一、养老保险单位变动记录', X0, X1, y, y + 18, size=11.5, align='left', pad=0)
    y += 20
    heads = ['缴费起始年月', '缴费截止年月', '实际缴费月数', '单位名称', '缴费区县']
    row_h = 18.0
    rows = list(employers or []) or [{}]
    ys = [y]
    for _ in range(len(rows) + 1):
        ys.append(ys[-1] + row_h)
    grid(page, EMP_X, ys)
    for i, h in enumerate(heads):
        cell_box(page, fb, fbn, h, EMP_X[i], EMP_X[i + 1], ys[0], ys[1], size=8.2, min_size=6.5)
    for i, r in enumerate(rows):
        vals = [
            r.get('start_ym') or '',
            r.get('end_ym') or '',
            str(r.get('months') or '') if r else '',
            r.get('company_name') or '',
            r.get('agency') or '',
        ]
        for j, val in enumerate(vals):
            align = 'left' if j >= 3 else 'center'
            cell_box(
                page,
                fp,
                fn,
                val,
                EMP_X[j],
                EMP_X[j + 1],
                ys[i + 1],
                ys[i + 2],
                size=8.0,
                align=align,
                min_size=6.0,
            )
    return ys[-1] + 10


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
        '',
        money2(t.get('pension_pay'), t.get('pension_months')),
        months_or_blank(t.get('unemp_months')),
        '',
        money2(t.get('unemp_pay'), t.get('unemp_months')),
        months_or_blank(t.get('injury_months')),
        '',
        months_or_blank(t.get('medical_months')),
        '',
        money2(t.get('medical_pay'), t.get('medical_months')),
        months_or_blank(t.get('maternity_months')),
        '',
    ]


def draw_detail_header(page, fp, fn, fb, fbn, y):
    cell_box(page, fb, fbn, '二、五险缴费明细', X0, X1, y, y + 18, size=11.5, align='left', pad=0)
    y += 20
    h1 = y
    mid = y + 16
    h2 = y + 32
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
    # 去掉分组跨行时的中缝（缴费起止年月整列）
    page.draw_line(fitz.Point(xs[0] + 0.4, mid), fitz.Point(xs[1] - 0.4, mid), color=(1, 1, 1), width=1.2)
    for a, b, title in groups:
        if b - a == 1:
            cell_box(page, fb, fbn, title, xs[a], xs[b], h1, h2, size=7.4, min_size=6.0)
        else:
            cell_box(page, fb, fbn, title, xs[a], xs[b], h1, mid, size=7.6, min_size=6.0)
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
        cell_box(page, fb, fbn, lab, xs[i], xs[i + 1], mid, h2, size=6.8, min_size=5.6)
    return h2


def draw_detail_rows(page, fp, fn, rows, y0, include_total=None):
    xs = DETAIL_X
    row_h = 14.5
    data = list(rows or [])
    if include_total is not None:
        data = data + [None]
    y = y0
    for i, r in enumerate(data):
        y1 = y + row_h
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
                size=7.0,
                align='left' if j == 0 else 'center',
                min_size=5.5,
                pad=1.0,
            )
        y = y1
    return y


def draw_summary_page(page, fp, fn, fb, fbn, p):
    cell_box(page, fb, fbn, '三、补充资料', X0, X1, 188, 208, size=11.5, align='left', pad=0)
    text = (
        '参保人在我市养老保险累计实际缴费月数为%s个月，医疗保险累计实际缴费月数为%s个月。'
        '北京市养老保险个人账户资金余额为%s元。'
        % (
            norm_text(p.get('pension_total_months')),
            norm_text(p.get('medical_total_months')),
            money2(p.get('account_balance'), 1),
        )
    )
    page.insert_textbox(
        fitz.Rect(X0 + 4, 214, X1 - 4, 300),
        text,
        fontname=fn,
        fontsize=11.0,
        align=0,
    )
    y = 310.0
    cell_box(page, fb, fbn, NOTE_LINES[0], X0, X1, y, y + 18, size=11.0, align='left', pad=0)
    y += 22
    for line in NOTE_LINES[1:]:
        box = fitz.Rect(X0, y, X1, y + 48)
        used = page.insert_textbox(box, line, fontname=fn, fontsize=10.0, align=0)
        y += max(28.0, 48.0 - used + 6.0)
    agency = norm_text(p.get('agency_name') or '北京市朝阳区社会保险基金管理中心')
    date = '日期：' + norm_text(p.get('print_date') or '')
    cell_box(page, fp, fn, agency, X0, X1 - 20, 680, 700, size=11.0, align='right', pad=0)
    cell_box(page, fp, fn, date, X0, X1 - 20, 702, 722, size=11.0, align='right', pad=0)


def collect_text(p, auth_code):
    parts = [
        TITLE1,
        TITLE2,
        '参保人姓名社会保障号码单位名称校验码查询流水号查询日期查询时间段',
        '一、养老保险单位变动记录缴费起始年月缴费截止年月实际缴费月数缴费区县',
        '二、五险缴费明细养老失业工伤医疗生育实际缴费月数年缴费基数个人缴费合计',
        '三、补充资料参保人在我市养老保险累计实际缴费月数为个月医疗保险北京市养老保险个人账户资金余额为元',
        '本文件由全国社保卡服务平台提供仅供查询使用',
        ''.join(NOTE_LINES),
        '数据来源于社会保险经办机构医疗保险经办机构日期第页共涉及请妥善保管因泄露造成不良后果由自行承担前标注',
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


def paginate_years(year_rows, first_cap=16, next_cap=26):
    rows = list(year_rows or [])
    if len(rows) <= first_cap:
        return [rows]
    chunks = [rows[:first_cap]]
    rest = rows[first_cap:]
    while rest:
        chunks.append(rest[:next_cap])
        rest = rest[next_cap:]
    return chunks


def render(payload, out_pdf, auth_code=''):
    p = payload or {}
    year_rows = list(p.get('year_rows') or [])
    employers = list(p.get('employers') or [])
    emp_n = len(employers) or 1
    first_cap = 16 if emp_n <= 4 else max(8, 16 - emp_n)
    chunks = paginate_years(year_rows, first_cap=first_cap)
    total_pages = len(chunks) + 1
    blob = collect_text(p, auth_code)
    body_full = ensure_full_cjk_font()
    bold_full = ensure_bold_cjk_font()
    body_path = make_subset_font(body_full, blob, prefix='sbdy_bj_')
    title_path = make_subset_font(bold_full, blob + TITLE1 + TITLE2, prefix='sbdy_bj_b_')
    doc = fitz.open()
    try:
        for i, chunk in enumerate(chunks):
            page = doc.new_page(width=PAGE_W, height=PAGE_H)
            fn, fbn = register_fonts(page, body_path, title_path)
            y = draw_header(page, body_path, fn, title_path, fbn, p, auth_code)
            if i == 0:
                y = draw_emp_table(page, body_path, fn, title_path, fbn, employers, y)
            y = draw_detail_header(page, body_path, fn, title_path, fbn, y if i == 0 else y)
            last = i == len(chunks) - 1
            draw_detail_rows(
                page,
                body_path,
                fn,
                chunk,
                y,
                include_total=p.get('totals') if last else None,
            )
            draw_page_no(page, body_path, fn, i + 1, total_pages)
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        fn, fbn = register_fonts(page, body_path, title_path)
        draw_header(page, body_path, fn, title_path, fbn, p, auth_code)
        draw_summary_page(page, body_path, fn, title_path, fbn, p)
        draw_page_no(page, body_path, fn, total_pages, total_pages)
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
