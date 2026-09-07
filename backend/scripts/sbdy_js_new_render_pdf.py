#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""江苏省社会保险权益记录单（参保人员）·江苏新 演示 PDF。

在旧江苏权益单版式基础上增加全国社保卡服务平台斜向水印。
核验文案横排在二维码下方；说明第 3 行加宽靠右；电子章与打印时间落在第 3 行下方右侧。
旧江苏模板仍用 sbdy_js_render_pdf.py。
"""
from __future__ import print_function

import json
import math
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
# 江苏新与官方样张一致：弧字「江苏省社会保险」+「电子专用章」（勿用基金管理中心章）
SEAL_PNG = os.path.join(ASSETS, 'js_seal.png')
if not os.path.isfile(SEAL_PNG):
    SEAL_PNG = os.path.join(ASSETS, 'js_new_seal.png')
# 盖章/打印时间：与官方参保证明一致，使用真·宋体 SimSun（从官方 PDF 子集重建）
SIMSUN_TTF = os.path.join(ASSETS, 'SimSun.ttf')
if not os.path.isfile(SIMSUN_TTF):
    SIMSUN_TTF = os.path.join(ASSETS, 'SimSun-AR.ttf')
if not os.path.isfile(SIMSUN_TTF):
    SIMSUN_TTF = '/usr/share/fonts/truetype/arphic-gbsn00lp/gbsn00lp.ttf'

PAGE_W, PAGE_H = 595.0, 842.0
# 原版 723×1024 样张实测：正文框约 x=53.5..540pt，不是通栏 A4。
X0, X1 = 53.5, 540.0
LW = 0.6
TITLE_CENTER_X = 266.0

TITLE1 = '江苏省社会保险权益记录单'
TITLE2 = '（参保人员）'
QR_CAP = '请使用官方江苏智慧人社APP扫描验证'
WATERMARK_BASE = (
    '本文件由全国社保卡服务平台提供，任何第三方机构不得进行二次加工、'
    '处理、解析或以任何形式用于商业用途，否则将追究法律责任。'
)
WM_LINE1 = '本文件由全国社保卡服务平台提供，任何第三方机构不得进行'
WM_LINE2 = '二次加工、处理、解析或以任何形式用于商业用途，否则将追究'
WM_LINE3_PREFIX = '法律责任。'

# 信息表列线：姓名 | 值 | 公民身份号码（社会保障号）| 值 | 性别 | 值
INFO_X = [53.5, 83.0, 155.0, 268.5, 430.5, 490.0, 540.0]
# 参保基本情况：险种/参保状态行的列线（标签 | 养老 | 工伤 | 失业）
BS_X = [53.5, 155.0, 268.5, 379.5, 540.0]
# 现参保单位全称行的列线（标签 | 单位值 | 现参保地 | 值）
BS3_X = [53.5, 155.0, 379.5, 430.5, 540.0]
# 明细表列线：年|月|单位全称|养老基数|养老个人|失业基数|失业个人|工伤基数|备注
COL_X = [53.5, 83.0, 102.0, 212.5, 268.5, 322.5, 379.5, 430.5, 490.0, 540.0]

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


def wrap_cell_text(fp, text, max_w, size):
    """按字符折为最多两行；用于原版单位全称窄列。"""
    src = norm_text(text)
    if not src:
        return ['']
    lines = []
    line = ''
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


def cell_lines(page, fp, fn, lines, x0, x1, y0, y1, size):
    lines = [norm_text(x) for x in (lines or []) if norm_text(x)]
    if len(lines) <= 1:
        cell_box(page, fp, fn, lines[0] if lines else '', x0, x1, y0, y1, size=size, pad=1.2)
        return
    mid = (y0 + y1) / 2.0
    cell_box(page, fp, fn, lines[0], x0, x1, y0, mid + 0.3, size=size, pad=1.2)
    cell_box(page, fp, fn, lines[1], x0, x1, mid - 0.3, y1, size=size, pad=1.2)


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
        WATERMARK_BASE,
        WM_LINE1,
        WM_LINE2,
        WM_LINE3_PREFIX,
        '姓名公民身份号码（社会保障号）性别共页第',
        '参加社会保险基本情况险种养老保险工伤保险失业保险参保状态现参保单位全称现参保地',
        '出具证明前个月缴费情况（续）年月单位全称缴费基数（元）个人缴费工伤保险备注',
        '说明：江苏省社会保险电子专用章（盖章）打印时间：',
        QR_CAP,
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
        str(p.get('watermark_id') or ''),
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
    title_size = 18.6
    tw = text_width(fp_t, TITLE1, title_size)
    page.insert_text((TITLE_CENTER_X - tw / 2.0, 70.0), TITLE1, fontname=fn_t, fontsize=title_size, color=(0, 0, 0))
    sub_size = 15.5
    tw2 = text_width(fp_t, TITLE2, sub_size)
    page.insert_text((TITLE_CENTER_X - tw2 / 2.0, 98.0), TITLE2, fontname=fn_t, fontsize=sub_size, color=(0, 0, 0))
    if qr_path and os.path.isfile(qr_path):
        page.insert_image(fitz.Rect(404.0, 37.0, 485.0, 118.0), filename=qr_path)


def draw_qr_caption(page, fp, fn, stamp=''):
    """核验文案横排，居中对齐在二维码正下方。"""
    # 二维码 Rect(404, 37, 485, 118)
    qr_x0, qr_x1, qr_y1 = 404.0, 485.0, 118.0
    qr_cx = (qr_x0 + qr_x1) / 2.0
    s = fit_fontsize(fp, QR_CAP, 240.0, 8.2, min_size=6.4)
    tw = text_width(fp, QR_CAP, s)
    page.insert_text((qr_cx - tw / 2.0, qr_y1 + 24.0), QR_CAP, fontname=fn, fontsize=s, color=(0, 0, 0))


def draw_watermark(page, fontfile, fn, stamp):
    """全国社保卡服务平台斜向水印：固定 3 行，行距拉开避免字体重叠。"""
    line3 = WM_LINE3_PREFIX + ('(%s)' % norm_text(stamp) if stamp else '')
    lines = [WM_LINE1, WM_LINE2, line3]
    size = 9.8
    color = (0.72, 0.72, 0.72)
    ang = -32.0
    rad = math.radians(ang)
    # 沿旋转后的「行方向」垂直偏移；系数过小会叠字
    perp = (-math.sin(rad), math.cos(rad))
    line_gap = size * 2.55
    mat = fitz.Matrix(1, 1).prerotate(ang)
    col_x = [-30.0, 220.0, 470.0]
    row_y = [80.0, 280.0, 480.0, 680.0, 880.0]
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


def draw_info_table(page, fp_b, fn_b, fp_t, fn_t, p, y0):
    """姓名/公民身份号码（社会保障号）/性别；返回底 y。"""
    h = 24.0
    y1 = y0 + h
    rect(page, X0, y0, X1, y1)
    for x in INFO_X[1:-1]:
        vline(page, x, y0, y1)
    cell_box(page, fp_t, fn_t, '姓名', INFO_X[0], INFO_X[1], y0, y1, size=8.8, align='center')
    cell_box(page, fp_b, fn_b, p.get('name') or '', INFO_X[1], INFO_X[2], y0, y1, size=8.4, align='center')
    cell_two(page, fp_t, fn_t, '公民身份号码', '（社会保障号）', INFO_X[2], INFO_X[3], y0, y1, 8.5)
    cell_box(page, fp_b, fn_b, p.get('id_number') or '', INFO_X[3], INFO_X[4], y0, y1, size=8.4, align='center')
    cell_box(page, fp_t, fn_t, '性别', INFO_X[4], INFO_X[5], y0, y1, size=8.8, align='center')
    cell_box(page, fp_b, fn_b, p.get('gender') or '', INFO_X[5], INFO_X[6], y0, y1, size=8.4, align='center')
    return y1


def draw_basic_situation(page, fp_b, fn_b, fp_t, fn_t, p, y0):
    rh = 22.5
    y_sec = y0 + rh
    y_r1 = y_sec + rh
    y_r2 = y_r1 + rh
    y_r3 = y_r2 + rh
    rect(page, X0, y0, X1, y_r3)
    hline(page, y_sec)
    hline(page, y_r1)
    hline(page, y_r2)
    cell_box(page, fp_t, fn_t, '参加社会保险基本情况', X0, X1, y0, y_sec, size=10.0, align='center')
    # 险种行 / 参保状态行
    for x in BS_X[1:-1]:
        vline(page, x, y_sec, y_r2)
    xian = ['险种', '养老保险', '工伤保险', '失业保险']
    for i, t in enumerate(xian):
        cell_box(page, fp_t, fn_t, t, BS_X[i], BS_X[i + 1], y_sec, y_r1, size=9.0, align='center')
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
            size=8.5,
            align='center',
        )
    # 现参保单位全称行（独立列线）
    for x in BS3_X[1:-1]:
        vline(page, x, y_r2, y_r3)
    cell_box(page, fp_t, fn_t, '现参保单位全称', BS3_X[0], BS3_X[1], y_r2, y_r3, size=8.7, align='center')
    cell_box(
        page, fp_b, fn_b, p.get('company_display') or p.get('company_name') or '',
        BS3_X[1], BS3_X[2], y_r2, y_r3, size=8.4, align='center', min_size=6.5,
    )
    cell_box(page, fp_t, fn_t, '现参保地', BS3_X[2], BS3_X[3], y_r2, y_r3, size=8.7, align='center')
    cell_box(page, fp_b, fn_b, p.get('area') or '', BS3_X[3], BS3_X[4], y_r2, y_r3, size=8.4, align='center')
    return y_r3


def draw_section_title(page, fp_t, fn_t, text, y0):
    h = 22.0
    y1 = y0 + h
    rect(page, X0, y0, X1, y1)
    cell_box(page, fp_t, fn_t, text, X0, X1, y0, y1, size=10.5, align='center')
    return y1


def table_row_meta(fp_b, rows):
    unit_size = 8.4
    unit_max_w = (COL_X[3] - COL_X[2]) - 3.6
    unit_lines = [wrap_cell_text(fp_b, r.get('unit_name') or '', unit_max_w, unit_size) for r in rows]
    row_heights = [20.6 if len(lines) > 1 else 13.4 for lines in unit_lines]
    return unit_lines, row_heights


def chunk_table_rows(fp_b, rows, first_data_h, cont_data_h):
    """按可用高度拆页，第 1 页对齐原样张（约 16～17 行）。"""
    if not rows:
        return [[]]
    _lines, heights = table_row_meta(fp_b, rows)
    pages = []
    i = 0
    first = True
    while i < len(rows):
        budget = first_data_h if first else cont_data_h
        used = 0.0
        chunk = []
        while i < len(rows):
            h = heights[i]
            if chunk and used + h > budget:
                break
            chunk.append(rows[i])
            used += h
            i += 1
        pages.append(chunk)
        first = False
        if not chunk:
            break
    return pages


def draw_table(page, fp_b, fn_b, fp_t, fn_t, rows, y0):
    head1_h = 15.5
    head2_h = 26.5
    y_h1 = y0 + head1_h
    y_h2 = y_h1 + head2_h
    unit_size = 8.4
    unit_lines, row_heights = table_row_meta(fp_b, rows)
    y_end = y_h2 + sum(row_heights)
    rect(page, X0, y0, X1, y_end)
    hline(page, y_h2)
    # 年/月/单位/险种分组/备注边界贯穿整表；养老与失业的组内分隔线
    # 只从第二层表头开始，不能穿过上方「养老保险 / 失业保险」合并标题。
    for ci in (1, 2, 3, 5, 7, 8):
        vline(page, COL_X[ci], y0, y_end)
    for ci in (4, 6):
        vline(page, COL_X[ci], y_h1, y_end)
    # 养老/失业/工伤分组横线
    hline(page, y_h1, x0=COL_X[3], x1=COL_X[8])
    # 年/月/单位全称/备注 跨两行
    cell_box(page, fp_t, fn_t, '年', COL_X[0], COL_X[1], y0, y_h2, size=8.4, align='center')
    cell_box(page, fp_t, fn_t, '月', COL_X[1], COL_X[2], y0, y_h2, size=8.4, align='center')
    cell_box(page, fp_t, fn_t, '单位全称', COL_X[2], COL_X[3], y0, y_h2, size=8.4, align='center')
    cell_box(page, fp_t, fn_t, '备注', COL_X[8], COL_X[9], y0, y_h2, size=8.4, align='center')
    # 组标题
    cell_box(page, fp_t, fn_t, '养老保险', COL_X[3], COL_X[5], y0, y_h1, size=8.4, align='center')
    cell_box(page, fp_t, fn_t, '失业保险', COL_X[5], COL_X[7], y0, y_h1, size=8.4, align='center')
    cell_box(page, fp_t, fn_t, '工伤保险', COL_X[7], COL_X[8], y0, y_h1, size=8.4, align='center')
    # 子表头（两行）
    subs = [
        (3, '缴费基数（', '元）'),
        (4, '个人缴', '费（元）'),
        (5, '缴费基数（', '元）'),
        (6, '个人缴', '费（元）'),
        (7, '缴费基数（', '元）'),
    ]
    for ci, a, b in subs:
        cell_two(page, fp_t, fn_t, a, b, COL_X[ci], COL_X[ci + 1], y_h1, y_h2, 7.2)
    # 数据行
    yy0 = y_h2
    for i, r in enumerate(rows):
        yy1 = yy0 + row_heights[i]
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
            if ci == 2:
                cell_lines(page, fp_b, fn_b, unit_lines[i], COL_X[ci], COL_X[ci + 1], yy0, yy1, unit_size)
            else:
                cell_box(
                    page, fp_b, fn_b, v, COL_X[ci], COL_X[ci + 1], yy0, yy1,
                    size=7.4, align='center', min_size=6.0,
                )
        yy0 = yy1
    return y_end


def draw_notes(page, fp, fn, y0):
    """说明在表下靠左；第 3 行加宽靠右排，章改到其下方。"""
    x_lab = X0
    size = 8.85
    line_h = 11.5
    # 第 3 行尽量靠右显示，接近表右缘（章在说明下方，不再并排让宽）
    notes_right = X1 - 6.0
    page.insert_text((x_lab, y0 + size * 0.35), '说明：', fontname=fn, fontsize=size, color=(0, 0, 0))
    y = y0 + line_h
    x_body = X0 + 4.0
    for i, note in enumerate(NOTES):
        if i < 2:
            page.insert_text((x_body, y + size * 0.35), note, fontname=fn, fontsize=size, color=(0, 0, 0))
            y += line_h
        else:
            y = draw_wrapped(page, fp, fn, note, x_body, notes_right, y, size, line_h)
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


def draw_seal(page, fp, fn, print_date, table_bottom, notes_end=None, simsun_path=None, simsun_name=None):
    """电子章右下；文案宋体 9pt 两行：（盖章）压五角星，打印时间在其下（对齐官方参保证明）。"""
    size = 112.0
    x1 = X1 + 4.0
    base = float(notes_end) if notes_end is not None else (float(table_bottom) + 8.0)
    y0 = base + 2.0
    y1 = y0 + size
    if y1 > PAGE_H - 10.0:
        y1 = PAGE_H - 10.0
        y0 = max(base - 20.0, y1 - size)
    x0 = x1 - size
    box = fitz.Rect(x0, y0, x1, y1)
    date = seal_date(print_date)
    # 先写宋体文案，再盖章（与官方一致：章压在字上）
    seal_fp = simsun_path or fp
    seal_fn = simsun_name or fn
    if date:
        mark = '（盖章）'
        label = '打印时间：' + date
        s = 9.0
        tw_mark = text_width(seal_fp, mark, s)
        cx = x0 + size * 0.5
        # 官方：章 112pt，（盖章）宽 36pt 居中于星；打印时间起点约章左 -18pt、基线约星下 +14pt
        mark_x = cx - tw_mark * 0.5
        mark_baseline = y0 + size * 0.5
        label_x = x0 - 18.25
        label_baseline = y0 + 70.25
        page.insert_text(
            (mark_x, mark_baseline),
            mark,
            fontname=seal_fn,
            fontsize=s,
            color=(0, 0, 0),
        )
        page.insert_text(
            (label_x, label_baseline),
            label,
            fontname=seal_fn,
            fontsize=s,
            color=(0, 0, 0),
        )
    if os.path.isfile(SEAL_PNG):
        page.insert_image(box, filename=SEAL_PNG, keep_proportion=True, overlay=True)


def render(payload, auth_code, qr_url, out_path):
    p = payload or {}
    rows = ensure_rows(p)
    blob = collect_blob(p, rows, auth_code)
    full_body = ensure_full_cjk_font()
    full_title = ensure_bold_cjk_font()
    subset_body = make_subset_font(full_body, blob, prefix='sbdy_jsn_body_')
    subset_title = (
        make_subset_font(full_title, blob, prefix='sbdy_jsn_title_')
        if full_title != full_body
        else subset_body
    )
    subset_simsun = None
    if os.path.isfile(SIMSUN_TTF):
        try:
            subset_simsun = make_subset_font(
                SIMSUN_TTF,
                '（盖章）打印时间：年月日' + str(p.get('print_date') or '') + '0123456789',
                prefix='sbdy_jsn_simsun_',
            )
        except Exception:
            subset_simsun = SIMSUN_TTF
    qr_path = None
    doc = None
    try:
        try:
            fd, qr_path = tempfile.mkstemp(suffix='.png', prefix='sbdy_jsn_qr_')
            os.close(fd)
            make_qr_png(qr_url or 'https://geshui.vip/', qr_path)
        except Exception:
            qr_path = None

        # 原样张第 1 页约 17 行；说明加宽后章在第 3 行下方，需多预留纵向空间。
        notes_reserve = 210.0
        table_head_h = 42.0
        first_table_top = 150.0 + 24.0 + 18.0 + 90.0 + 22.0
        cont_table_top = 150.0 + 24.0 + 18.0 + 22.0
        first_data_h = min(
            max(80.0, PAGE_H - first_table_top - table_head_h - notes_reserve),
            17 * 14.2 + 2.0,
        )
        cont_data_h = max(80.0, PAGE_H - cont_table_top - table_head_h - notes_reserve)
        chunks = chunk_table_rows(full_body, rows, first_data_h, cont_data_h)
        total_pages = max(1, len(chunks))
        sec_base = '出具证明前%d个月缴费情况（%s）' % (
            int(p.get('span_months') or p.get('month_count') or len(rows) or 1),
            str(p.get('period_compact') or ''),
        )

        doc = fitz.open()
        for idx, chunk in enumerate(chunks):
            page = doc.new_page(width=PAGE_W, height=PAGE_H)
            body_name, title_name = register_fonts(page, subset_body, subset_title)
            simsun_path = subset_simsun or subset_body
            simsun_name = body_name
            if subset_simsun:
                page.insert_font(fontname='sbdysimsun', fontfile=subset_simsun)
                simsun_name = 'sbdysimsun'
            draw_watermark(page, subset_body, body_name, p.get('watermark_id') or '')
            draw_title(page, subset_title, title_name, qr_path)
            draw_qr_caption(page, subset_body, body_name, p.get('watermark_id') or auth_code or '')
            y = 150.0
            y = draw_info_table(page, subset_body, body_name, subset_title, title_name, p, y)
            page_no = '共%d页，第%d页' % (total_pages, idx + 1)
            page_no_size = 9.0
            pw = text_width(subset_body, page_no, page_no_size)
            page.insert_text((X1 - pw, y + 13.0), page_no, fontname=body_name, fontsize=page_no_size, color=(0, 0, 0))
            y = y + 18.0
            if idx == 0:
                y = draw_basic_situation(page, subset_body, body_name, subset_title, title_name, p, y)
            sec = sec_base if idx == 0 else ('出具证明前%d个月缴费情况（续）（%s）' % (
                int(p.get('span_months') or p.get('month_count') or len(rows) or 1),
                str(p.get('period_compact') or ''),
            ))
            y = draw_section_title(page, subset_title, title_name, sec, y)
            table_bottom = draw_table(page, subset_body, body_name, subset_title, title_name, chunk, y)
            notes_end = draw_notes(page, subset_body, body_name, table_bottom + 8.0)
            draw_seal(
                page,
                subset_body,
                body_name,
                p.get('print_date') or '',
                table_bottom,
                notes_end,
                simsun_path=simsun_path,
                simsun_name=simsun_name,
            )

        doc.save(out_path, deflate=True, garbage=4)
        doc.close()
        doc = None
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass
        for path in (
            qr_path,
            subset_body,
            subset_title if subset_title != subset_body else None,
            subset_simsun if subset_simsun and subset_simsun != SIMSUN_TTF else None,
        ):
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
