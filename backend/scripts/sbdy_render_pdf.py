#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按参考 show.pdf（PD4ML A4）坐标生成浙江省社保参保证明演示 PDF。

字体：正文 Noto Serif CJK SC Regular（贴近官方 NSimSun，不加描边）；
标题用 Bold。字库按本文裁切（retain_gids）后绘制。

单元格（溢出框）：缩字号适配边距；仍超宽则 textbox 限制在格线内。
"""
from __future__ import print_function

import json
import os
import re
import sys
import tempfile

import fitz
import qrcode
from fontTools.ttLib import TTCollection, TTFont
from fontTools import subset as ft_subset

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
SEAL_PNG = os.path.join(ASSETS, 'seal.png')
NOTO_TTC = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc'
NOTO_BOLD_TTC = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
NOTO_SC_OTF = os.path.join(ASSETS, 'NotoSerifCJKsc-Regular.otf')
NOTO_SC_CACHE = os.path.join(tempfile.gettempdir(), 'sbdy_NotoSerifCJKsc-Regular.otf')
NOTO_BOLD_CACHE = os.path.join(tempfile.gettempdir(), 'sbdy_NotoSerifCJKsc-Bold.otf')

PAGE_W, PAGE_H = 595.0, 842.0
X0, X1 = 34.3, 560.2

# 明细表列宽（对齐参考 PDF 竖线）
COL_X = [34.5, 62.4, 79.5, 167.8, 234.6, 274.2, 318.1, 371.6, 416.5, 454.5, 511.2, 542.3, 560.5]

_FULL_FONT_PATH = None
_BOLD_FONT_PATH = None
_FONT_CACHE = {}


def _extract_sc_face(ttc_path, out_path):
    ttc = TTCollection(ttc_path)
    # Noto Serif CJK: JP=0 KR=1 SC=2 TC=3 HK=4
    face = ttc.fonts[2]
    face.flavor = None
    face.save(out_path)
    return out_path


def ensure_full_cjk_font():
    """正文：完整简体 Serif Regular。"""
    global _FULL_FONT_PATH
    if _FULL_FONT_PATH and os.path.isfile(_FULL_FONT_PATH):
        return _FULL_FONT_PATH
    for path in (NOTO_SC_OTF, NOTO_SC_CACHE):
        if os.path.isfile(path) and os.path.getsize(path) > 1_000_000:
            _FULL_FONT_PATH = path
            return path
    if os.path.isfile(NOTO_TTC):
        _FULL_FONT_PATH = _extract_sc_face(NOTO_TTC, NOTO_SC_CACHE)
        return _FULL_FONT_PATH
    raise RuntimeError('missing CJK font: install fonts-noto-cjk or place NotoSerifCJKsc-Regular.otf')


def ensure_bold_cjk_font():
    """标题：Serif Bold（仅标题，正文不用以免糊成一团）。"""
    global _BOLD_FONT_PATH
    if _BOLD_FONT_PATH and os.path.isfile(_BOLD_FONT_PATH):
        return _BOLD_FONT_PATH
    if os.path.isfile(NOTO_BOLD_CACHE) and os.path.getsize(NOTO_BOLD_CACHE) > 1_000_000:
        _BOLD_FONT_PATH = NOTO_BOLD_CACHE
        return _BOLD_FONT_PATH
    if os.path.isfile(NOTO_BOLD_TTC):
        _BOLD_FONT_PATH = _extract_sc_face(NOTO_BOLD_TTC, NOTO_BOLD_CACHE)
        return _BOLD_FONT_PATH
    return ensure_full_cjk_font()


def make_subset_font(src_path, text_blob, prefix='sbdy_sub_'):
    """裁切 CJK CFF 字库；retain_gids 避免 MuPDF 缺字/乱码。"""
    text_blob = (text_blob or '') + (
        ' 0123456789.-/():（）%，第页共年月授权码验证平台：、'
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    )
    opts = ft_subset.Options()
    opts.layout_closure = False
    opts.layout_features = []  # 去掉替换特征，减少竖排/异体干扰
    opts.name_IDs = ['*']
    opts.name_languages = ['*']
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.retain_gids = True
    opts.ignore_missing_unicodes = True
    font = TTFont(src_path)
    subsetter = ft_subset.Subsetter(options=opts)
    subsetter.populate(text=text_blob)
    subsetter.subset(font)
    for tag in ('VORG', 'vhea', 'vmtx'):
        if tag in font:
            del font[tag]
    fd, path = tempfile.mkstemp(suffix='.otf', prefix=prefix)
    os.close(fd)
    font.save(path)
    return path


def money(n):
    try:
        x = float(n)
    except Exception:
        return '0'
    if abs(x - round(x)) < 1e-9:
        return str(int(round(x)))
    return '%.2f' % x


def norm_text(text):
    if text is None:
        return ''
    return str(text)


def _strip_trailing_credit(company):
    import re
    s = str(company or '').strip()
    if not s:
        return ''
    return re.sub(r'[（(]\s*[0-9A-Za-z]{15,20}\s*[）)]\s*$', '', s).strip()


def _extract_credit(company):
    import re
    s = str(company or '').strip()
    m = re.search(r'[（(]\s*([0-9A-Za-z]{15,20})\s*[）)]\s*$', s)
    return m.group(1) if m else ''


def company_display(p):
    if p.get('company_display'):
        text = str(p['company_display'])
        # 已含两份信用代码时压成一份
        import re
        m = re.match(
            r'^(.*?)[（(]\s*([0-9A-Za-z]{15,20})\s*[）)]\s*[（(]\s*\2\s*[）)]\s*$',
            text,
        )
        if m:
            return '%s（%s）' % (m.group(1).strip(), m.group(2))
        return text
    c = str(p.get('company_name') or '')
    code = str(p.get('credit_code') or '') or _extract_credit(c)
    c = _strip_trailing_credit(c)
    if c and code:
        return '%s（%s）' % (c, code)
    return c or code or ''


ROWS_PER_PAGE = 24
MAX_MONTHS = 48


def ensure_months(p):
    months = list(p.get('months') or [])
    area = str(p.get('area') or '')
    code = str(p.get('credit_code') or '')
    base = p.get('base_amount')
    pension = p.get('pension_pay')
    unemp = p.get('unemployment_pay')
    out = []
    for r in months:
        if not isinstance(r, dict):
            continue
        out.append(
            {
                'year': str(r.get('year') or ''),
                'month': str(r.get('month') or '').zfill(2)[-2:],
                'unit_code': str(r.get('unit_code') or code),
                'area': str(r.get('area') or area),
                'pension_base': r.get('pension_base', base),
                'pension_pay': r.get('pension_pay', pension),
                'pension_status': str(r.get('pension_status') or '已到账'),
                'unemp_area': str(r.get('unemp_area') or r.get('area') or area),
                'unemp_base': r.get('unemp_base', r.get('pension_base', base)),
                'unemp_pay': r.get('unemp_pay', unemp),
                'unemp_status': str(r.get('unemp_status') or '已到账'),
                'remark': str(r.get('remark') or ''),
            }
        )
    if len(out) > MAX_MONTHS:
        out = out[-MAX_MONTHS:]
    return out


def chunk_months(months, size=ROWS_PER_PAGE):
    """按每页 size 行切分；不足补空行，保证每页表格等高。"""
    rows = list(months or [])
    if not rows:
        return [[None] * size]
    chunks = []
    i = 0
    while i < len(rows):
        part = list(rows[i : i + size])
        while len(part) < size:
            part.append(None)
        chunks.append(part)
        i += size
    return chunks



def draw_hline(page, y, width=0.6):
    page.draw_line(fitz.Point(X0, y), fitz.Point(X1, y), color=(0, 0, 0), width=width)


def draw_vline(page, x, y0, y1, width=0.6):
    page.draw_line(fitz.Point(x, y0), fitz.Point(x, y1), color=(0, 0, 0), width=width)


def draw_rect(page, y0, y1, width=0.8):
    page.draw_rect(fitz.Rect(X0, y0, X1, y1), color=(0, 0, 0), width=width)


def _font_obj(path):
    if path not in _FONT_CACHE:
        _FONT_CACHE[path] = fitz.Font(fontfile=path)
    return _FONT_CACHE[path]


def text_width(font_path, text, size):
    fo = _font_obj(font_path)
    return fo.text_length('' if text is None else str(text), fontsize=size)


def make_qr_png(url, path):
    img = qrcode.make(url or 'https://geshui.vip/', border=1, box_size=6)
    img.save(path)


def register_fonts(page, body_path, title_path):
    page.insert_font(fontname='sbdybody', fontfile=body_path)
    if title_path == body_path:
        return 'sbdybody', 'sbdybody'
    page.insert_font(fontname='sbdytitle', fontfile=title_path)
    return 'sbdybody', 'sbdytitle'


def fit_fontsize(font_path, text, max_w, size, min_size=6.0):
    """字号缩小直到文本宽度落入 max_w。"""
    text = '' if text is None else str(text)
    if not text or max_w <= 1:
        return size
    s = float(size)
    while s > min_size and text_width(font_path, text, s) > max_w:
        s -= 0.3
    return s


def cell_box(
    page,
    font_path,
    fontname,
    text,
    x0,
    x1,
    y0,
    y1,
    size=9.6,
    color=(0, 0, 0),
    align='center',
    pad=1.8,
    min_size=6.0,
):
    """溢出框：缩字号使文本落入单元格；极端超宽则 textbox 限制在格内。"""
    text = norm_text(text)
    if not text:
        return
    max_w = max(1.0, (x1 - x0) - pad * 2)
    s = fit_fontsize(font_path, text, max_w, size, min_size=min_size)
    tw = text_width(font_path, text, s)
    if tw <= max_w + 0.5:
        if align == 'left':
            x = x0 + pad
        elif align == 'right':
            x = x1 - pad - tw
        else:
            x = x0 + (x1 - x0 - tw) / 2.0
        y = (y0 + y1) / 2.0 + s * 0.35
        page.insert_text((x, y), text, fontname=fontname, fontsize=s, color=color)
        return
    align_code = {'left': 0, 'center': 1, 'right': 2}.get(align, 1)
    rect = fitz.Rect(x0 + pad, y0 + 0.5, x1 - pad, y1 - 0.5)
    page.insert_textbox(
        rect,
        text,
        fontname=fontname,
        fontsize=max(min_size, s - 0.5),
        color=color,
        align=align_code,
    )


def cell_center(page, font_path, fontname, text, x0, x1, y0, y1, size=9.6, color=(0, 0, 0)):
    cell_box(page, font_path, fontname, text, x0, x1, y0, y1, size=size, color=color, align='center')


def cell_twoline(page, font_path, fontname, line1, line2, x0, x1, y0, y1, size=8.0):
    """表头两行（缴费基数 / 数(元)），均在框内。"""
    mid = (y0 + y1) / 2.0
    cell_box(page, font_path, fontname, line1, x0, x1, y0, mid + 0.5, size=size, align='center', min_size=6.0)
    cell_box(page, font_path, fontname, line2, x0, x1, mid - 0.5, y1, size=size, align='center', min_size=6.0)


# 表头/标签加粗用字（不含正文数值；「参加社会保险基本情况」与险种名用正文字重）
BOLD_LABEL_CHARS = (
    '姓名社会保障号证件类型证件号码性别'
    '险　　种参保状态参保单位'
    '出具证明前个月缴费情况（续）'
    '年月单位编号备注参保地缴费基数(元)个人缴费状况'
    '共页第'
)


def collect_text_blob(p, months, auth_code):
    n = len([m for m in (months or []) if m])
    page_n = max(1, (n + ROWS_PER_PAGE - 1) // ROWS_PER_PAGE) if n else 1
    parts = [
        '浙江省社会保险参保证明（个人专用）',
        '共%d页，第1页' % page_n,
        '出具证明前%d个月缴费情况' % (n or 12),
        '参加社会保险基本情况',
        '养老保险工伤保险失业保险',
        BOLD_LABEL_CHARS,
        '（盖章）',
        '打印时间：',
        '本证明已签署经国家电子政务外网浙江省电子认证注册的机构认证的电子印章，社保经办机构不再另行签章。',
        '本证明出具后3个月内可在“浙江政务服务网”进行网上验证，授权码：',
        '验证平台：',
        '本证明为打印时48个月内的参保情况，如需打印48个月以上的，请至人工窗口办理。',
        '本证明妥善保管，最终解释权由参保地社保经办机构所有。',
        'https://mapi.zjzwfw.gov.cn/web/mgop/gov-open/zj/2002199511/reserved/index.html#/validate',
        company_display(p),
        str(p.get('name') or ''),
        str(p.get('id_number') or ''),
        str(p.get('id_type') or '居民身份证'),
        str(p.get('gender') or ''),
        str(p.get('status_pension') or ''),
        str(p.get('status_injury') or p.get('status_medical') or ''),
        str(p.get('status_unemployment') or ''),
        str(p.get('period_label') or ''),
        str(p.get('print_date') or ''),
        str(auth_code or ''),
        str(p.get('area') or ''),
        str(p.get('credit_code') or ''),
        str(p.get('company_name') or ''),
    ]
    for r in months:
        if not r:
            continue
        parts.extend(
            [
                r.get('year') or '',
                r.get('month') or '',
                r.get('unit_code') or '',
                r.get('area') or '',
                money(r.get('pension_base')),
                money(r.get('pension_pay')),
                r.get('pension_status') or '',
                r.get('unemp_area') or '',
                money(r.get('unemp_base')),
                money(r.get('unemp_pay')),
                r.get('unemp_status') or '',
                r.get('remark') or '',
            ]
        )
    return ''.join(norm_text(x) for x in parts)


def draw_title_chrome(page, font_body, body_name, font_title, title_name, qr_path, page_idx, total_pages):
    title = '浙江省社会保险参保证明（个人专用）'
    tsize = 21.4
    tw = text_width(font_title, title, tsize)
    page.insert_text(
        ((PAGE_W - tw) / 2.0, 72.0),
        title,
        fontname=title_name,
        fontsize=tsize,
        color=(0, 0, 0),
    )
    if qr_path and os.path.isfile(qr_path):
        page.insert_image(fitz.Rect(497.8, 10.4, 582.9, 101.1), filename=qr_path)
    page.insert_text(
        (496.5, 112.0),
        '共%d页，第%d页' % (total_pages, page_idx),
        fontname=body_name,
        fontsize=10.7,
        color=(0, 0, 0),
    )


def draw_payment_table(
    page,
    font_body,
    body_name,
    font_title,
    title_name,
    month_chunk,
    y3_0,
    section_title,
):
    """画缴费明细表（固定 ROWS_PER_PAGE 行），返回表底 y。"""
    y3_h1 = y3_0 + 14.7
    y3_h2 = y3_0 + 40.9
    row_h = 14.45
    n_body = ROWS_PER_PAGE
    y3_end = y3_h2 + row_h * n_body
    draw_rect(page, y3_0, y3_end)
    draw_hline(page, y3_h1)
    draw_hline(page, y3_h2)
    for i in range(1, n_body):
        draw_hline(page, y3_h2 + row_h * i)
    for x in COL_X:
        draw_vline(page, x, y3_0, y3_end)

    # 区段标题压在表上方外：由调用方画；此处画表头
    cell_center(page, font_title, title_name, '年', COL_X[0], COL_X[1], y3_0, y3_h2, 9.6)
    cell_center(page, font_title, title_name, '月', COL_X[1], COL_X[2], y3_0, y3_h2, 9.6)
    cell_center(page, font_title, title_name, '单位编号', COL_X[2], COL_X[3], y3_0, y3_h2, 9.6)
    cell_center(page, font_title, title_name, '养老保险', COL_X[3], COL_X[7], y3_0, y3_h1, 9.6)
    cell_center(page, font_title, title_name, '失业保险', COL_X[7], COL_X[11], y3_0, y3_h1, 9.6)
    cell_center(page, font_title, title_name, '备注', COL_X[11], COL_X[12], y3_0, y3_h2, 9.6)
    twoline_specs = [
        (3, '参保地', None),
        (4, '缴费基', '数(元)'),
        (5, '个人缴', '费(元)'),
        (6, '缴费', '状况'),
        (7, '参保地', None),
        (8, '缴费基', '数(元)'),
        (9, '个人缴', '费(元)'),
        (10, '缴费', '状况'),
    ]
    for ci, a, b in twoline_specs:
        if b:
            cell_twoline(page, font_title, title_name, a, b, COL_X[ci], COL_X[ci + 1], y3_h1, y3_h2, 8.0)
        else:
            cell_center(page, font_title, title_name, a, COL_X[ci], COL_X[ci + 1], y3_h1, y3_h2, 9.0)

    for i in range(n_body):
        y0 = y3_h2 + row_h * i
        y1 = y0 + row_h
        r = month_chunk[i] if i < len(month_chunk) else None
        if not r:
            continue
        vals = [
            r['year'],
            r['month'],
            r['unit_code'],
            r['area'],
            money(r['pension_base']),
            money(r['pension_pay']),
            r['pension_status'],
            r['unemp_area'],
            money(r['unemp_base']),
            money(r['unemp_pay']),
            r['unemp_status'],
            r.get('remark') or '',
        ]
        for ci, val in enumerate(vals):
            cell_box(
                page,
                font_body,
                body_name,
                val,
                COL_X[ci],
                COL_X[ci + 1],
                y0,
                y1,
                size=9.6,
                align='center',
                min_size=6.5,
            )
    return y3_end


def draw_cert_footer(page, font_body, body_name, auth_code, verify_url, print_date, y_top):
    auth = str(auth_code or '')
    validate = 'https://mapi.zjzwfw.gov.cn/web/mgop/gov-open/zj/2002199511/reserved/index.html#/validate'
    notes = [
        '备注：1.本证明已签署经国家电子政务外网浙江省电子认证注册的机构认证的电子印章，社保经办机构不再另行签章。',
        '2.本证明出具后3个月内可在“浙江政务服务网”进行网上验证，授权码：%s，' % auth,
        None,
        '3.本证明为打印时48个月内的参保情况，如需打印48个月以上的，请至人工窗口办理。',
        '4.本证明妥善保管，最终解释权由参保地社保经办机构所有。',
    ]
    ny = y_top + 10.0
    line_h = 13.4
    for i, line in enumerate(notes):
        x = 34.3 if i == 0 else 60.0
        y = ny + i * line_h
        if i == 2:
            prefix = '验证平台：'
            page.insert_text((x, y), prefix, fontname=body_name, fontsize=8.6, color=(0, 0, 0))
            px = x + text_width(font_body, prefix, 8.6)
            url_max = max(40.0, X1 - 8 - px - text_width(font_body, '。', 8.6))
            us = fit_fontsize(font_body, validate, url_max, 8.6, min_size=5.5)
            page.insert_text((px, y), validate, fontname=body_name, fontsize=us, color=(0, 0, 1))
            uw = min(text_width(font_body, validate, us), url_max)
            page.insert_link(
                {
                    'kind': fitz.LINK_URI,
                    'from': fitz.Rect(px, y - 10, px + uw, y + 2),
                    'uri': verify_url or validate,
                }
            )
            page.insert_text((px + uw, y), '。', fontname=body_name, fontsize=8.6, color=(0, 0, 0))
        else:
            page.insert_text((x, y), line, fontname=body_name, fontsize=8.6, color=(0, 0, 0))

    stamp_y = ny + 5 * line_h + 8
    page.insert_text((492.2, stamp_y), '（盖章）', fontname=body_name, fontsize=8.6, color=(0, 0, 0))
    pd = '打印时间：' + str(print_date or '')
    pdw = text_width(font_body, pd, 8.6)
    page.insert_text(
        ((PAGE_W - pdw) / 2.0, stamp_y + 10), pd, fontname=body_name, fontsize=8.6, color=(0, 0, 0)
    )
    if os.path.isfile(SEAL_PNG):
        page.insert_image(
            fitz.Rect(430, stamp_y - 55, 575, stamp_y + 90),
            filename=SEAL_PNG,
            keep_proportion=True,
            overlay=True,
        )


def render(payload, auth_code, qr_url, out_path):
    p = payload or {}
    months = ensure_months(p)
    month_chunks = chunk_months(months, ROWS_PER_PAGE)
    total_pages = len(month_chunks)
    real_count = len([m for m in months if m])
    period = p.get('period_label') or ''
    section_title = '出具证明前%d个月缴费情况（%s）' % (real_count or 12, period)

    blob = collect_text_blob(p, months, auth_code)
    full_body = ensure_full_cjk_font()
    full_title = ensure_bold_cjk_font()
    subset_body = make_subset_font(full_body, blob, prefix='sbdy_body_')
    bold_blob = (
        '浙江省社会保险参保证明（个人专用）'
        + BOLD_LABEL_CHARS
        + section_title
        + str(p.get('period_label') or '')
        + '0123456789（）()-—'
        + ''.join('共%d页，第%d页' % (total_pages, i + 1) for i in range(total_pages))
    )
    subset_title = (
        make_subset_font(full_title, bold_blob, prefix='sbdy_title_')
        if full_title != full_body
        else subset_body
    )
    font_body = subset_body
    font_title = subset_title
    qr_path = None
    doc = None

    try:
        doc = fitz.open()
        qr_path = os.path.join(tempfile.gettempdir(), 'sbdy_qr_%s.png' % os.getpid())
        # 二维码内容：PDF 样例页 URL，扫码直接打开本证明
        make_qr_png(qr_url, qr_path)

        for page_idx, chunk in enumerate(month_chunks, start=1):
            page = doc.new_page(width=PAGE_W, height=PAGE_H)
            body_name, title_name = register_fonts(page, font_body, font_title)
            draw_title_chrome(
                page, font_body, body_name, font_title, title_name, qr_path, page_idx, total_pages
            )

            if page_idx == 1:
                # —— 个人信息表 ——
                y_t1_0, y_t1_1, y_t1_2 = 120.8, 135.5, 149.7
                draw_rect(page, y_t1_0, y_t1_2)
                draw_hline(page, y_t1_1)
                info_xs = [34.3, 62.4, 112.1, 181.1, 259.8, 305.3, 362.0, 415.5, 493.6, 536.9, 560.2]
                info_labels = ['姓名', '社会保障号', '证件类型', '证件号码', '性别']
                info_vals = [
                    p.get('name') or '',
                    p.get('id_number') or '',
                    p.get('id_type') or '居民身份证',
                    p.get('id_number') or '',
                    p.get('gender') or '',
                ]
                for i in range(11):
                    draw_vline(page, info_xs[i], y_t1_0, y_t1_1)
                for i in range(5):
                    cell_center(
                        page,
                        font_title,
                        title_name,
                        info_labels[i],
                        info_xs[i * 2],
                        info_xs[i * 2 + 1],
                        y_t1_0,
                        y_t1_1,
                        9.6,
                    )
                    cell_center(
                        page,
                        font_body,
                        body_name,
                        info_vals[i],
                        info_xs[i * 2 + 1],
                        info_xs[i * 2 + 2],
                        y_t1_0,
                        y_t1_1,
                        9.6,
                    )
                cell_center(
                    page, font_body, body_name, '参加社会保险基本情况', X0, X1, y_t1_1, y_t1_2, 9.6
                )

                # —— 参保基本情况 ——
                y2 = [149.7, 164.4, 178.8, 193.3, 207.5]
                draw_rect(page, y2[0], y2[-1])
                for y in y2[1:-1]:
                    draw_hline(page, y)
                bx = [34.3, 112.1, 259.8, 415.5, 560.2]
                draw_vline(page, bx[0], y2[0], y2[3])
                draw_vline(page, bx[1], y2[0], y2[3])
                draw_vline(page, bx[2], y2[0], y2[2])
                draw_vline(page, bx[3], y2[0], y2[2])
                draw_vline(page, bx[4], y2[0], y2[3])
                rows2 = [
                    ('险　　种', '养老保险', '工伤保险', '失业保险'),
                    (
                        '参保状态',
                        p.get('status_pension') or '',
                        p.get('status_injury') or p.get('status_medical') or '',
                        p.get('status_unemployment') or '',
                    ),
                ]
                for ri, row in enumerate(rows2):
                    for ci, val in enumerate(row):
                        # 险种名称（养老保险等）不用黑体；仅左侧行标签加粗
                        use_bold = ci == 0
                        cell_center(
                            page,
                            font_title if use_bold else font_body,
                            title_name if use_bold else body_name,
                            val,
                            bx[ci],
                            bx[ci + 1],
                            y2[ri],
                            y2[ri + 1],
                            9.6,
                        )
                cell_center(page, font_title, title_name, '参保单位', bx[0], bx[1], y2[2], y2[3], 9.6)
                cell_box(
                    page,
                    font_body,
                    body_name,
                    company_display(p),
                    bx[1],
                    bx[4],
                    y2[2],
                    y2[3],
                    size=9.6,
                    align='center',
                    pad=3.0,
                    min_size=7.2,
                )
                cell_center(
                    page, font_title, title_name, section_title, X0, X1, y2[3], y2[4], 9.6
                )
                y_table = 207.5
            else:
                # 续页：表紧跟标题区
                cell_center(
                    page,
                    font_title,
                    title_name,
                    section_title + '（续）',
                    X0,
                    X1,
                    118.0,
                    134.0,
                    9.6,
                )
                y_table = 134.0

            y3_end = draw_payment_table(
                page,
                font_body,
                body_name,
                font_title,
                title_name,
                chunk,
                y_table,
                section_title,
            )
            # 每一页底部备注文案与电子印章相同（与官方多页证明一致）
            draw_cert_footer(
                page,
                font_body,
                body_name,
                auth_code,
                '',  # 页脚验证链接用官方平台；二维码另见 qr_url
                p.get('print_date') or '',
                y3_end,
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
        _FONT_CACHE.clear()
        for path in (qr_path, subset_body, subset_title if subset_title != subset_body else None):
            if path:
                try:
                    os.remove(path)
                except Exception:
                    pass



def main():
    if len(sys.argv) < 3:
        print('usage: sbdy_render_pdf.py <payload.json> <out.pdf>', file=sys.stderr)
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
