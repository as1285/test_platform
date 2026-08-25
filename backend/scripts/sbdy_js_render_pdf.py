#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""江苏省社会保险权益记录单（参保人员）演示 PDF。

版式对齐江苏智慧人社「社会保险权益记录单」样张：
- 两行居中标题 + 右上二维码与扫码说明；
- 带框信息表（姓名 / 公民身份号码（社会保障号）/ 性别）+ 共X页第X页；
- 「参加社会保险基本情况」：险种(养老/工伤/失业) + 参保状态 + 现参保单位全称/现参保地；
- 「出具证明前N个月缴费情况（YYYYMM-YYYYMM）」逐月明细表：
  年 / 月 / 单位全称 / 养老保险(缴费基数,个人缴费) / 失业保险(缴费基数,个人缴费) / 工伤保险(缴费基数) / 备注；
- 说明三条；右下角红色电子印章 + 打印时间。
"""
from __future__ import print_function

import json
import os
import re
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
    norm_text,
    register_fonts,
    text_width,
)

ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
SEAL_PNG = os.path.join(ASSETS, 'js_seal.png')

PAGE_W, PAGE_H = 595.0, 842.0
X0, X1 = 34.0, 561.0
LW = 0.6

TITLE1 = '江苏省社会保险权益记录单'
TITLE2 = '（参保人员）'
QR_CAP = '请使用官方江苏智慧人社APP扫描验证'

# 信息表列线：姓名 | 值 | 公民身份号码（社会保障号）| 值 | 性别 | 值
INFO_X = [34.0, 78.0, 168.0, 300.0, 470.0, 512.0, 561.0]
# 参保基本情况：险种/参保状态行的列线（标签 | 养老 | 工伤 | 失业）
BS_X = [34.0, 130.0, 250.0, 355.0, 561.0]
# 现参保单位全称行的列线（标签 | 单位值 | 现参保地 | 值）
BS3_X = [34.0, 130.0, 430.0, 490.0, 561.0]
# 明细表列线：年|月|单位全称|养老基数|养老个人|失业基数|失业个人|工伤基数|备注
COL_X = [34.0, 66.0, 92.0, 228.0, 290.0, 350.0, 412.0, 472.0, 534.0, 561.0]

NOTES = [
    '1.本权益单信息为打印时参保情况，供参考，由参保人员自行保管。',
    '2.本权益单已签具电子印章，不再加盖鲜章。',
    '3.本权益记录单出具后有效期（6个月）内，如需核对真伪，请使用江苏智慧人社APP，扫描右上方二维码进行验证（可多次验证）。',
]


def money2(n):
    try:
        return '%.2f' % float(n)
    except Exception:
        return ''


def hline(page, y, x0=None, x1=None, width=LW):
    a = X0 if x0 is None else x0
    b = X1 if x1 is None else x1
    page.draw_line(fitz.Point(a, y), fitz.Point(b, y), color=(0, 0, 0), width=width)


def vline(page, x, y0, y1, width=LW):
    page.draw_line(fitz.Point(x, y0), fitz.Point(x, y1), color=(0, 0, 0), width=width)


def rect(page, x0, y0, x1, y1, width=LW):
    page.draw_rect(fitz.Rect(x0, y0, x1, y1), color=(0, 0, 0), width=width)


def cell_two(page, fp, fn, l1, l2, x0, x1, y0, y1, size):
    mid = (y0 + y1) / 2.0
    cell_box(page, fp, fn, l1, x0, x1, y0, mid + 1.0, size=size, align='center', min_size=6.0)
    cell_box(page, fp, fn, l2, x0, x1, mid - 1.0, y1, size=size, align='center', min_size=6.0)


def seal_date(s):
    m = re.match(r'^\s*(\d{4})\s*年\s*0?(\d{1,2})\s*月\s*0?(\d{1,2})\s*日', str(s or ''))
    if m:
        return '%s年%s月%s日' % (m.group(1), int(m.group(2)), int(m.group(3)))
    return norm_text(s)


def ensure_rows(p):
    rows = list(p.get('detail_rows') or p.get('months') or [])
    company_default = str(p.get('company_display') or p.get('company_name') or '')
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        out.append(
            {
                'year': str(r.get('year') or ''),
                'month': str(r.get('month') or '').zfill(2)[-2:],
                'unit_name': str(r.get('unit_name') or r.get('company_name') or company_default),
                'pension_base': r.get('pension_base', r.get('base')),
                'pension_pay': r.get('pension_pay'),
                'unemp_base': r.get('unemp_base', r.get('base')),
                'unemp_pay': r.get('unemp_pay'),
                'injury_base': r.get('injury_base', r.get('base')),
                'remark': str(r.get('remark') or ''),
            }
        )
    return out


def collect_blob(p, rows, auth_code):
    parts = [
        TITLE1,
        TITLE2,
        QR_CAP,
        '姓名公民身份号码（社会保障号）性别共页第',
        '参加社会保险基本情况险种养老保险工伤保险失业保险参保状态现参保单位全称现参保地',
        '出具证明前个月缴费情况年月单位全称缴费基数（元）个人缴费工伤保险备注',
        '说明：江苏省社会保险局电子专用章打印时间：',
        str(p.get('name') or ''),
        str(p.get('id_number') or ''),
        str(p.get('gender') or ''),
        str(p.get('status_pension') or p.get('status') or ''),
        str(p.get('status_injury') or p.get('status') or ''),
        str(p.get('status_unemployment') or p.get('status') or ''),
        str(p.get('company_display') or p.get('company_name') or ''),
        str(p.get('area') or ''),
        str(p.get('print_date') or ''),
        str(p.get('period_compact') or ''),
        str(auth_code or ''),
    ]
    parts.extend(NOTES)
    for r in rows:
        parts.extend(
            [
                r.get('year') or '',
                r.get('month') or '',
                r.get('unit_name') or '',
                money2(r.get('pension_base')),
                money2(r.get('pension_pay')),
                money2(r.get('unemp_base')),
                money2(r.get('unemp_pay')),
                money2(r.get('injury_base')),
                r.get('remark') or '',
            ]
        )
    return ''.join(norm_text(x) for x in parts)


def draw_title(page, fp_t, fn_t, qr_path):
    tw = text_width(fp_t, TITLE1, 20.0)
    page.insert_text(((PAGE_W - tw) / 2.0, 74.0), TITLE1, fontname=fn_t, fontsize=20.0, color=(0, 0, 0))
    tw2 = text_width(fp_t, TITLE2, 16.0)
    page.insert_text(((PAGE_W - tw2) / 2.0, 98.0), TITLE2, fontname=fn_t, fontsize=16.0, color=(0, 0, 0))
    if qr_path and os.path.isfile(qr_path):
        page.insert_image(fitz.Rect(487.0, 38.0, 561.0, 112.0), filename=qr_path)


def draw_qr_caption(page, fp, fn):
    s = fit_fontsize(fp, QR_CAP, X1 - 300.0, 8.6, min_size=6.5)
    tw = text_width(fp, QR_CAP, s)
    page.insert_text((X1 - tw, 126.0), QR_CAP, fontname=fn, fontsize=s, color=(0, 0, 0))


def draw_info_table(page, fp_b, fn_b, fp_t, fn_t, p, y0):
    """姓名/公民身份号码（社会保障号）/性别；返回底 y。"""
    h = 32.0
    y1 = y0 + h
    rect(page, X0, y0, X1, y1)
    for x in INFO_X[1:-1]:
        vline(page, x, y0, y1)
    cell_box(page, fp_t, fn_t, '姓名', INFO_X[0], INFO_X[1], y0, y1, size=9.6, align='center')
    cell_box(page, fp_b, fn_b, p.get('name') or '', INFO_X[1], INFO_X[2], y0, y1, size=9.6, align='center')
    cell_two(page, fp_t, fn_t, '公民身份号码', '（社会保障号）', INFO_X[2], INFO_X[3], y0, y1, 9.2)
    cell_box(page, fp_b, fn_b, p.get('id_number') or '', INFO_X[3], INFO_X[4], y0, y1, size=9.6, align='center')
    cell_box(page, fp_t, fn_t, '性别', INFO_X[4], INFO_X[5], y0, y1, size=9.6, align='center')
    cell_box(page, fp_b, fn_b, p.get('gender') or '', INFO_X[5], INFO_X[6], y0, y1, size=9.6, align='center')
    return y1


def draw_basic_situation(page, fp_b, fn_b, fp_t, fn_t, p, y0):
    rh = 20.0
    y_sec = y0 + rh
    y_r1 = y_sec + rh
    y_r2 = y_r1 + rh
    y_r3 = y_r2 + rh
    rect(page, X0, y0, X1, y_r3)
    hline(page, y_sec)
    hline(page, y_r1)
    hline(page, y_r2)
    cell_box(page, fp_t, fn_t, '参加社会保险基本情况', X0, X1, y0, y_sec, size=10.5, align='center')
    # 险种行 / 参保状态行
    for x in BS_X[1:-1]:
        vline(page, x, y_sec, y_r2)
    xian = ['险种', '养老保险', '工伤保险', '失业保险']
    for i, t in enumerate(xian):
        cell_box(page, fp_t, fn_t, t, BS_X[i], BS_X[i + 1], y_sec, y_r1, size=9.6, align='center')
    st_p = str(p.get('status_pension') or p.get('status') or '')
    st_i = str(p.get('status_injury') or p.get('status') or '')
    st_u = str(p.get('status_unemployment') or p.get('status') or '')
    status_row = ['参保状态', st_p, st_i, st_u]
    for i, t in enumerate(status_row):
        use_bold = i == 0
        cell_box(
            page,
            fp_t if use_bold else fp_b,
            fn_t if use_bold else fn_b,
            t,
            BS_X[i],
            BS_X[i + 1],
            y_r1,
            y_r2,
            size=9.4,
            align='center',
        )
    # 现参保单位全称行（独立列线）
    for x in BS3_X[1:-1]:
        vline(page, x, y_r2, y_r3)
    cell_box(page, fp_t, fn_t, '现参保单位全称', BS3_X[0], BS3_X[1], y_r2, y_r3, size=9.2, align='center')
    cell_box(
        page, fp_b, fn_b, p.get('company_display') or p.get('company_name') or '',
        BS3_X[1], BS3_X[2], y_r2, y_r3, size=9.2, align='center', min_size=6.5,
    )
    cell_box(page, fp_t, fn_t, '现参保地', BS3_X[2], BS3_X[3], y_r2, y_r3, size=9.2, align='center')
    cell_box(page, fp_b, fn_b, p.get('area') or '', BS3_X[3], BS3_X[4], y_r2, y_r3, size=9.2, align='center')
    return y_r3


def draw_section_title(page, fp_t, fn_t, text, y0):
    h = 20.0
    y1 = y0 + h
    rect(page, X0, y0, X1, y1)
    cell_box(page, fp_t, fn_t, text, X0, X1, y0, y1, size=10.5, align='center')
    return y1


def draw_table(page, fp_b, fn_b, fp_t, fn_t, rows, y0):
    head1_h = 15.0
    head2_h = 24.0
    y_h1 = y0 + head1_h
    y_h2 = y_h1 + head2_h
    n = max(1, len(rows))
    row_h = max(13.0, min(20.0, 300.0 / n))
    y_end = y_h2 + row_h * len(rows)
    rect(page, X0, y0, X1, y_end)
    hline(page, y_h2)
    # 表头分组竖线
    for x in COL_X[1:-1]:
        vline(page, x, y0, y_end)
    # 养老/失业/工伤 分组横线（组内子列仅在第二行以下有竖线，上部合并）
    hline(page, y_h1, x0=COL_X[3], x1=COL_X[8])
    # 年/月/单位全称/备注 跨两行
    cell_box(page, fp_t, fn_t, '年', COL_X[0], COL_X[1], y0, y_h2, size=9.0, align='center')
    cell_box(page, fp_t, fn_t, '月', COL_X[1], COL_X[2], y0, y_h2, size=9.0, align='center')
    cell_box(page, fp_t, fn_t, '单位全称', COL_X[2], COL_X[3], y0, y_h2, size=9.0, align='center')
    cell_box(page, fp_t, fn_t, '备注', COL_X[8], COL_X[9], y0, y_h2, size=9.0, align='center')
    # 组标题
    cell_box(page, fp_t, fn_t, '养老保险', COL_X[3], COL_X[5], y0, y_h1, size=9.0, align='center')
    cell_box(page, fp_t, fn_t, '失业保险', COL_X[5], COL_X[7], y0, y_h1, size=9.0, align='center')
    cell_box(page, fp_t, fn_t, '工伤保险', COL_X[7], COL_X[8], y0, y_h1, size=9.0, align='center')
    # 子表头（两行）
    subs = [
        (3, '缴费基数（', '元）'),
        (4, '个人缴', '费（元）'),
        (5, '缴费基数（', '元）'),
        (6, '个人缴', '费（元）'),
        (7, '缴费基数（', '元）'),
    ]
    for ci, a, b in subs:
        cell_two(page, fp_t, fn_t, a, b, COL_X[ci], COL_X[ci + 1], y_h1, y_h2, 7.6)
    # 数据行
    for i, r in enumerate(rows):
        yy0 = y_h2 + row_h * i
        yy1 = yy0 + row_h
        if i > 0:
            hline(page, yy0)
        vals = [
            r.get('year') or '',
            r.get('month') or '',
            r.get('unit_name') or '',
            money2(r.get('pension_base')),
            money2(r.get('pension_pay')),
            money2(r.get('unemp_base')),
            money2(r.get('unemp_pay')),
            money2(r.get('injury_base')),
            r.get('remark') or '',
        ]
        for ci, v in enumerate(vals):
            align = 'center'
            cell_box(
                page, fp_b, fn_b, v, COL_X[ci], COL_X[ci + 1], yy0, yy1,
                size=8.6 if ci != 2 else 8.8, align=align, min_size=6.0,
            )
    return y_end


def draw_notes(page, fp, fn, y0):
    x_lab = X0
    size = 9.0
    line_h = 15.0
    page.insert_text((x_lab, y0 + size * 0.35), '说明：', fontname=fn, fontsize=size, color=(0, 0, 0))
    y = y0 + line_h
    x_body = X0 + 4.0
    for i, note in enumerate(NOTES):
        if i < 2:
            page.insert_text((x_body, y + size * 0.35), note, fontname=fn, fontsize=size, color=(0, 0, 0))
            y += line_h
        else:
            y = draw_wrapped(page, fp, fn, note, x_body, X1 - 4.0, y, size, line_h)
    return y


def draw_wrapped(page, fp, fn, text, x0, x1, y, size, line_h):
    max_w = x1 - x0
    line = ''
    yy = y
    for ch in norm_text(text):
        if text_width(fp, line + ch, size) > max_w and line:
            page.insert_text((x0, yy + size * 0.35), line, fontname=fn, fontsize=size, color=(0, 0, 0))
            yy += line_h
            line = ch
        else:
            line += ch
    if line:
        page.insert_text((x0, yy + size * 0.35), line, fontname=fn, fontsize=size, color=(0, 0, 0))
        yy += line_h
    return yy


def draw_seal(page, fp, fn, print_date):
    box = fitz.Rect(410.0, 648.0, 566.0, 804.0)
    if os.path.isfile(SEAL_PNG):
        page.insert_image(box, filename=SEAL_PNG, keep_proportion=True, overlay=True)
    date = seal_date(print_date)
    if date:
        s = 9.4
        label = '打印时间：' + date
        cy = (box.y0 + box.y1) / 2.0
        # 打印时间落在印章左侧并略压入章内（对齐样张）
        x = box.x0 - 66.0
        page.insert_text((x, cy + s * 0.35), label, fontname=fn, fontsize=s, color=(0.1, 0.1, 0.1))


def render(payload, auth_code, qr_url, out_path):
    p = payload or {}
    rows = ensure_rows(p)
    blob = collect_blob(p, rows, auth_code)
    full_body = ensure_full_cjk_font()
    full_title = ensure_bold_cjk_font()
    subset_body = make_subset_font(full_body, blob, prefix='sbdy_js_body_')
    subset_title = (
        make_subset_font(full_title, blob, prefix='sbdy_js_title_')
        if full_title != full_body
        else subset_body
    )
    qr_path = None
    doc = None
    try:
        doc = fitz.open()
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        body_name, title_name = register_fonts(page, subset_body, subset_title)
        try:
            fd, qr_path = tempfile.mkstemp(suffix='.png', prefix='sbdy_js_qr_')
            os.close(fd)
            make_qr_png(qr_url or 'https://geshui.vip/', qr_path)
        except Exception:
            qr_path = None
        draw_title(page, subset_title, title_name, qr_path)
        draw_qr_caption(page, subset_body, body_name)

        y = 140.0
        y = draw_info_table(page, subset_body, body_name, subset_title, title_name, p, y)
        # 共X页 第X页
        page_no = '共%d页，第%d页' % (int(p.get('total_pages') or 1), int(p.get('page_idx') or 1))
        pw = text_width(subset_body, page_no, 9.4)
        page.insert_text((X1 - pw, y + 13.0), page_no, fontname=body_name, fontsize=9.4, color=(0, 0, 0))
        y = y + 18.0
        y = draw_basic_situation(page, subset_body, body_name, subset_title, title_name, p, y)
        y = y + 6.0
        sec = '出具证明前%d个月缴费情况（%s）' % (
            int(p.get('span_months') or len(rows) or 1),
            str(p.get('period_compact') or ''),
        )
        y = draw_section_title(page, subset_title, title_name, sec, y)
        y = draw_table(page, subset_body, body_name, subset_title, title_name, rows, y)
        draw_notes(page, subset_body, body_name, y + 14.0)
        draw_seal(page, subset_body, body_name, p.get('print_date') or '')

        doc.save(out_path, deflate=True, garbage=4)
        doc.close()
        doc = None
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass
        for path in (qr_path, subset_body, subset_title if subset_title != subset_body else None):
            if path:
                try:
                    os.remove(path)
                except Exception:
                    pass


def main():
    if len(sys.argv) < 3:
        print('usage: sbdy_js_render_pdf.py <payload.json> <out.pdf>', file=sys.stderr)
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
