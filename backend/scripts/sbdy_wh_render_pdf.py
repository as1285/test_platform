#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""湖北省社会保险参保证明（个人专用）演示 PDF。版式对齐武汉市参保证明扫描件。"""
from __future__ import print_function

import json
import math
import os
import sys

import fitz

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sbdy_render_pdf import (  # noqa: E402
    ensure_full_cjk_font,
    fit_fontsize,
    make_subset_font,
    money,
    norm_text,
    register_fonts,
    text_width,
)

ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
SEAL_PNG = os.path.join(ASSETS, 'wh_seal.png')

PAGE_W, PAGE_H = 595.28, 841.88
X0, X1 = 23.1, 571.4
LW = 0.75

# 信息行 1：姓名 / 值 / 性别 / 值 / 个人编号 / 值 / 社会保障号 / 值
INFO1_X = [23.1, 78.2, 121.9, 154.8, 193.5, 297.2, 363.1, 478.3, 571.4]
# 信息行 2：参保缴费地 / 值 / 本地缴费月数 / 值 / 参保险种 / 值
INFO2_X = [23.1, 78.2, 193.5, 297.2, 363.1, 478.3, 571.4]
# 单位行：单位编号 / 值 / 单位名称 / 值
UNIT_X = [23.1, 121.9, 193.5, 297.2, 571.4]
# 双列表：记录月份 缴费基数(元) 缴费类型 ×2（以 297.2 为中缝）
DUAL_X = [23.1, 121.9, 193.5, 297.2, 363.1, 478.3, 571.4]

# 依据 723×1024 参考扫描件换算到 A4 点坐标。
Y_INFO1 = 51.0
Y_INFO2 = 73.2
Y_SEC_UNIT = 95.4
Y_UNIT = 126.6
Y_SEC_36 = 148.8
Y_HEAD = 179.2
Y_DATA = [
    202.3,
    224.5,
    246.7,
    269.7,
    291.9,
    314.9,
    337.1,
    359.3,
    382.3,
    404.5,
    426.7,
    449.7,
    471.9,
    494.1,
    517.1,
    539.3,
    562.3,
    584.5,
    606.7,
]
N_ROWS = 18
MAX_SHOW = 12
FS = 7.5
FS_TITLE = 21.1
FS_SEC = 13.3
# Noto CJK 实测：字形约在 baseline-1.12s ~ baseline+0.28s
CJK_ASCENT = 1.12
CJK_DESCENT = 0.28

VERIFY_URL = 'https://hbsb.hb12333.com/hbrswt/template/dzsbzmyz.html'
TITLE = '湖北省社会保险参保证明（个人专用）'
SEC_PAY = '近12个月参保缴费情况'

NOTES = [
    '1、社会保障号:中国公民的“社会保障号”为身份证号;外国公民的“社会保障号”为护照号或居留证号。',
    '2、本证明由参保人自行保管，因遗失或泄露造成的不良后果，由参保人负责。',
    '3、本地缴费月数是指：参保缴费地实际缴费月数与转入缴费月数之和。',
    '4、本参保证明出具后3个月内可在“湖北省社保证明验证平台”进行验证。',
]


def cell_wh(page, font_path, fontname, text, x0, x1, y0, y1, size=FS, pad=1.2, min_size=5.5, y_shift=0.0):
    """格内水平+垂直居中；按 Noto CJK 实测 ascent/descent 算基线，并钳制在格内。"""
    text = norm_text(text)
    if not text:
        return
    max_w = max(1.0, (x1 - x0) - pad * 2)
    s = fit_fontsize(font_path, text, max_w, size, min_size=min_size)
    pad_v = 1.0
    # 字号过大时先缩小，保证上下各留 pad_v
    max_s = max(min_size, (y1 - y0 - 2.0 * pad_v) / (CJK_ASCENT + CJK_DESCENT))
    if s > max_s:
        s = max_s
    tw = text_width(font_path, text, s)
    x = x0 + (x1 - x0 - tw) / 2.0
    mid = (y0 + y1) / 2.0
    y = mid + s * (CJK_ASCENT - CJK_DESCENT) / 2.0 + y_shift
    max_baseline = y1 - pad_v - s * CJK_DESCENT
    min_baseline = y0 + pad_v + s * CJK_ASCENT
    if min_baseline <= max_baseline:
        if y > max_baseline:
            y = max_baseline
        elif y < min_baseline:
            y = min_baseline
    else:
        y = mid + s * 0.35
    page.insert_text((x, y), text, fontname=fontname, fontsize=s, color=(0, 0, 0))


def hline(page, y, x0=None, x1=None):
    a = X0 if x0 is None else x0
    b = X1 if x1 is None else x1
    page.draw_rect(fitz.Rect(a, y, b + LW, y + LW), color=None, fill=(0, 0, 0), width=0)


def vline(page, x, y0, y1):
    page.draw_rect(fitz.Rect(x, y0, x + LW, y1 + LW), color=None, fill=(0, 0, 0), width=0)


def draw_grid(page):
    ys = [Y_INFO1, Y_INFO2, Y_SEC_UNIT, Y_UNIT, Y_SEC_36, Y_HEAD] + list(Y_DATA)
    for y in ys:
        hline(page, y)
    vline(page, X0, Y_INFO1, Y_DATA[-1])
    vline(page, X1, Y_INFO1, Y_DATA[-1])
    for x in INFO1_X[1:-1]:
        vline(page, x, Y_INFO1, Y_INFO2)
    for x in INFO2_X[1:-1]:
        vline(page, x, Y_INFO2, Y_SEC_UNIT)
    for x in UNIT_X[1:-1]:
        vline(page, x, Y_UNIT, Y_SEC_36)
    for x in DUAL_X[1:-1]:
        vline(page, x, Y_HEAD, Y_DATA[-1])


def ym_label(row):
    if not row:
        return ''
    if row.get('ym'):
        return str(row.get('ym'))
    y = str(row.get('year') or '')
    m = str(row.get('month') or '').zfill(2)[-2:]
    if y and m:
        return y + m
    return ''


def ensure_months(p):
    months = list(p.get('months') or [])
    company = str(p.get('company_name') or '')
    base = p.get('base_amount')
    out = []
    for r in months:
        if not isinstance(r, dict):
            continue
        y = str(r.get('year') or '')
        m = str(r.get('month') or '').zfill(2)[-2:]
        ym = str(r.get('ym') or (y + m if y and m else ''))
        out.append(
            {
                'year': y,
                'month': m,
                'ym': ym,
                'unit_name': str(r.get('unit_name') or r.get('company_name') or company),
                'base': r.get('base', r.get('pension_base', r.get('base_amount', base))),
                'status': str(r.get('status') or r.get('pay_type') or r.get('pension_status') or '正常'),
            }
        )
    def key(r):
        try:
            return int(r.get('ym') or (str(r.get('year') or '0') + str(r.get('month') or '00')))
        except Exception:
            return 0

    # 近12个月：从最近月份往下排（新→旧），超出只保留最近 12 条
    out.sort(key=key, reverse=True)
    if len(out) > MAX_SHOW:
        out = out[:MAX_SHOW]
    return out


def split_dual(months):
    n = len(months)
    left_n = int(math.ceil(n / 2.0)) if n else 0
    left = list(months[:left_n])
    right = list(months[left_n:])
    while len(left) < N_ROWS:
        left.append(None)
    while len(right) < N_ROWS:
        right.append(None)
    return left[:N_ROWS], right[:N_ROWS]


def collect_blob(p, months, auth_code):
    parts = [
        TITLE,
        '姓名性别个人编号社会保障号参保缴费地本地缴费月数参保险种',
        '缴费地最末所在单位单位编号单位名称',
        '近12个月参保缴费情况记录月份缴费基数(元)缴费类型正常',
        '备注：',
        VERIFY_URL,
        '授权码：验证平台：打印时间：第1页/共1页',
        str(p.get('name') or ''),
        str(p.get('gender') or ''),
        str(p.get('person_no') or ''),
        str(p.get('id_number') or ''),
        str(p.get('area') or ''),
        str(p.get('local_month_count') or ''),
        str(p.get('insurance_type') or ''),
        str(p.get('unit_code') or ''),
        str(p.get('company_name') or ''),
        str(p.get('print_date') or ''),
        str(auth_code or ''),
    ]
    parts.extend(NOTES)
    for r in months:
        if not r:
            continue
        parts.extend(
            [
                ym_label(r),
                money(r.get('base')),
                r.get('status') or '正常',
            ]
        )
    return ''.join(norm_text(x) for x in parts)


def draw_title(page, font_path, fontname):
    """标题完整落在首行表格之上，底边与顶线至少留 3.5pt。"""
    tw = text_width(font_path, TITLE, FS_TITLE)
    # 参考图标题比首行顶线高约 9.5pt。
    baseline = Y_INFO1 - 9.5 - FS_TITLE * CJK_DESCENT
    if baseline < FS_TITLE * CJK_ASCENT + 4.0:
        baseline = FS_TITLE * CJK_ASCENT + 4.0
    page.insert_text(
        ((PAGE_W - tw) / 2.0, baseline),
        TITLE,
        fontname=fontname,
        fontsize=FS_TITLE,
        color=(0, 0, 0),
    )


def draw_info(page, font_path, fontname, p, months):
    name = str(p.get('name') or '')
    gender = str(p.get('gender') or '')
    person_no = str(p.get('person_no') or '')
    id_number = str(p.get('id_number') or '')
    area = str(p.get('area') or '武汉市')
    local_n = p.get('local_month_count')
    if local_n is None or local_n == '':
        local_n = len([m for m in months if m])
    insure = str(p.get('insurance_type') or '企业养老')
    unit_code = str(p.get('unit_code') or '')
    company = str(p.get('company_name') or '')

    labels = [
        (INFO1_X, Y_INFO1, Y_INFO2, ['姓名', name, '性别', gender, '个人编号', person_no, '社会保障号', id_number]),
        (INFO2_X, Y_INFO2, Y_SEC_UNIT, ['参保缴费地', area, '本地缴费月数', str(local_n), '参保险种', insure]),
        (UNIT_X, Y_UNIT, Y_SEC_36, ['单位编号', unit_code, '单位名称', company]),
    ]
    for xs, y0, y1, cells in labels:
        for i, text in enumerate(cells):
            cell_wh(page, font_path, fontname, text, xs[i], xs[i + 1], y0, y1, size=FS, pad=1.2, min_size=5.5)

    cell_wh(
        page,
        font_path,
        fontname,
        '缴费地最末所在单位',
        X0,
        X1,
        Y_SEC_UNIT,
        Y_UNIT,
        size=FS_SEC,
        pad=1.2,
        min_size=9.0,
    )
    cell_wh(
        page,
        font_path,
        fontname,
        SEC_PAY,
        X0,
        X1,
        Y_SEC_36,
        Y_HEAD,
        size=FS_SEC,
        pad=1.2,
        min_size=9.0,
    )


def draw_dual_table(page, font_path, fontname, left, right):
    heads = ['记录月份', '缴费基数(元)', '缴费类型']
    for i, text in enumerate(heads + heads):
        cell_wh(
            page,
            font_path,
            fontname,
            text,
            DUAL_X[i],
            DUAL_X[i + 1],
            Y_HEAD,
            Y_DATA[0],
            size=FS,
            pad=1.0,
            min_size=5.5,
        )

    def fill_col(rows, xoff):
        for i, r in enumerate(rows):
            y0 = Y_DATA[i]
            y1 = Y_DATA[i + 1]
            if not r:
                continue
            vals = [ym_label(r), money(r.get('base')), r.get('status') or '正常']
            for k, text in enumerate(vals):
                cell_wh(
                    page,
                    font_path,
                    fontname,
                    text,
                    DUAL_X[xoff + k],
                    DUAL_X[xoff + k + 1],
                    y0,
                    y1,
                    size=FS,
                    pad=1.0,
                    min_size=5.0,
                )

    fill_col(left, 0)
    fill_col(right, 3)


def draw_notes(page, font_path, fontname, p, auth_code):
    # 表格下沿 Y_DATA[-1]=606.7；备注与参考扫描件保持约 20pt 行距。
    page.insert_text((23.5, 620.0), '备注：', fontname=fontname, fontsize=FS, color=(0, 0, 0))
    y = 640.0
    for line in NOTES:
        page.insert_text((43.7, y), line, fontname=fontname, fontsize=FS, color=(0, 0, 0))
        y += 18.5
    page.insert_text((43.7, y), '验证平台：' + VERIFY_URL, fontname=fontname, fontsize=FS, color=(0, 0, 0))
    y += 18.5
    page.insert_text(
        (43.7, y),
        '授权码：' + str(auth_code or ''),
        fontname=fontname,
        fontsize=FS,
        color=(0, 0, 0),
    )
    print_date = str(p.get('print_date') or '')
    pd = '打印时间： ' + print_date
    tw = text_width(font_path, pd, FS)
    page.insert_text(((PAGE_W - tw) / 2.0, 776.0), pd, fontname=fontname, fontsize=FS, color=(0, 0, 0))
    pn = '第1页/共1页'
    tw = text_width(font_path, pn, FS)
    page.insert_text(((PAGE_W - tw) / 2.0, 809.0), pn, fontname=fontname, fontsize=FS, color=(0, 0, 0))


def draw_seal(page):
    if not os.path.isfile(SEAL_PNG):
        return
    # 参考图：印章位于表格下方备注区右侧，不压住缴费表格。
    # 先按目标尺寸最近邻缩放并二值化 alpha，避免 MuPDF 过滤缩放在章顶留下浅灰脏边。
    import io

    from PIL import Image

    rect = fitz.Rect(425.0, 628.0, 543.0, 747.0)
    tw = max(1, int(round(rect.width)))
    th = max(1, int(round(rect.height)))
    im = Image.open(SEAL_PNG).convert('RGBA').resize((tw, th), Image.Resampling.NEAREST)
    px = im.load()
    for y in range(th):
        for x in range(tw):
            r, g, b, a = px[x, y]
            if a < 96 or not (r > 118 and r > g + 28 and r > b + 28):
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (r, g, b, 255)
    buf = io.BytesIO()
    im.save(buf, format='PNG')
    page.insert_image(rect, stream=buf.getvalue(), overlay=True)


def render(payload, auth_code, qr_url, out_path):
    del qr_url  # 武汉证明无二维码
    p = payload or {}
    months = ensure_months(p)
    left, right = split_dual(months)
    blob = collect_blob(p, months, auth_code)
    full_body = ensure_full_cjk_font()
    subset = make_subset_font(full_body, blob, prefix='sbdy_wh_body_')
    doc = None
    try:
        doc = fitz.open()
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        body_name, _title_name = register_fonts(page, subset, subset)
        draw_title(page, subset, body_name)
        draw_grid(page)
        draw_info(page, subset, body_name, p, months)
        draw_dual_table(page, subset, body_name, left, right)
        draw_notes(page, subset, body_name, p, auth_code)
        draw_seal(page)
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


def main():
    if len(sys.argv) < 3:
        print('usage: sbdy_wh_render_pdf.py <payload.json> <out.pdf>', file=sys.stderr)
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
