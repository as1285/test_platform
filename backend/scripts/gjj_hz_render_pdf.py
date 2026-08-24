#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成「杭州住房公积金管理中心 一般住房公积金个人年度对账单（自助打印）」演示 PDF。

版式对齐样张：A4 竖版；顶部左二维码 / 右电子章；标题 + 对账日期；
双列身份信息（姓名·个人客户号 / 身份证号码·资金账号·页码单位）；
六列明细表（序号·记账日期·摘要·增加·减少·余额）；底部缴存状态/单位/打印日期/月缴存额。

字体：正文 Noto Serif CJK SC Regular；标题用 Bold（按本文裁切 retain_gids）。
本文件仅生成演示样例（非正式对账单）。
"""
from __future__ import print_function

import json
import os
import sys
import tempfile

import fitz
import qrcode
from fontTools.ttLib import TTCollection, TTFont
from fontTools import subset as ft_subset

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'gjj')
SEAL_PNG = os.path.join(ASSETS, 'seal.png')
SBDY_ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
NOTO_TTC = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc'
NOTO_BOLD_TTC = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
NOTO_SC_OTF = os.path.join(SBDY_ASSETS, 'NotoSerifCJKsc-Regular.otf')
NOTO_SC_CACHE = os.path.join(tempfile.gettempdir(), 'sbdy_NotoSerifCJKsc-Regular.otf')
NOTO_BOLD_CACHE = os.path.join(tempfile.gettempdir(), 'sbdy_NotoSerifCJKsc-Bold.otf')

PAGE_W, PAGE_H = 595.0, 842.0
X0, X1 = 40.0, 555.0

# 明细表列右边界：序号 记账日期 摘要 增加 减少 余额
COL_X = [40.0, 88.0, 196.0, 378.0, 438.0, 497.0, 555.0]

_FULL_FONT_PATH = None
_BOLD_FONT_PATH = None
_FONT_CACHE = {}


def _extract_sc_face(ttc_path, out_path):
    ttc = TTCollection(ttc_path)
    face = ttc.fonts[2]  # Noto Serif CJK: JP=0 KR=1 SC=2 TC=3 HK=4
    face.flavor = None
    face.save(out_path)
    return out_path


def ensure_full_cjk_font():
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


def make_subset_font(src_path, text_blob, prefix='gjj_sub_'):
    text_blob = (text_blob or '') + (
        ' 0123456789.,-/():（）%，。第页共年月日单位元'
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    )
    opts = ft_subset.Options()
    opts.layout_closure = False
    opts.layout_features = []
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
        return ''
    return '%.2f' % x


def norm_text(text):
    return '' if text is None else str(text)


def _font_obj(path):
    if path not in _FONT_CACHE:
        _FONT_CACHE[path] = fitz.Font(fontfile=path)
    return _FONT_CACHE[path]


def text_width(font_path, text, size):
    fo = _font_obj(font_path)
    return fo.text_length('' if text is None else str(text), fontsize=size)


def fit_fontsize(font_path, text, max_w, size, min_size=6.0):
    text = '' if text is None else str(text)
    if not text or max_w <= 1:
        return size
    s = float(size)
    while s > min_size and text_width(font_path, text, s) > max_w:
        s -= 0.3
    return s


def draw_hline(page, x0, x1, y, width=0.7):
    page.draw_line(fitz.Point(x0, y), fitz.Point(x1, y), color=(0, 0, 0), width=width)


def draw_vline(page, x, y0, y1, width=0.7):
    page.draw_line(fitz.Point(x, y0), fitz.Point(x, y1), color=(0, 0, 0), width=width)


def draw_rect(page, x0, y0, x1, y1, width=0.9):
    page.draw_rect(fitz.Rect(x0, y0, x1, y1), color=(0, 0, 0), width=width)


def make_qr_png(url, path):
    img = qrcode.make(url or 'https://geshui.vip/', border=1, box_size=6)
    img.save(path)


def register_fonts(page, body_path, title_path):
    page.insert_font(fontname='gjjbody', fontfile=body_path)
    if title_path == body_path:
        return 'gjjbody', 'gjjbody'
    page.insert_font(fontname='gjjtitle', fontfile=title_path)
    return 'gjjbody', 'gjjtitle'


def cell_box(page, font_path, fontname, text, x0, x1, y0, y1,
             size=10.0, color=(0, 0, 0), align='center', pad=3.0, min_size=6.0):
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
    page.insert_textbox(rect, text, fontname=fontname, fontsize=max(min_size, s - 0.5),
                        color=color, align=align_code)


def text_at(page, font_path, fontname, text, x, y, size=10.0, color=(0, 0, 0)):
    text = norm_text(text)
    if not text:
        return
    page.insert_text((x, y), text, fontname=fontname, fontsize=size, color=color)


def label_value(page, font_body, body_name, font_title, title_name,
                label, value, x, y, size=10.0):
    """标签用常规字，值紧随其后。返回值末端 x。"""
    text_at(page, font_body, body_name, label, x, y, size=size)
    lx = x + text_width(font_body, label, size)
    text_at(page, font_body, body_name, value, lx, y, size=size)
    return lx + text_width(font_body, value, size)


HEAD_LABELS = ['序号', '记账日期', '摘要', '增加', '减少', '余额']


def collect_blob(p, rows, auth_code):
    parts = [
        '杭州住房公积金管理中心一般住房公积金个人年度对账单（自助打印）',
        '对账日期：',
        '姓名：个人客户号：身份证号码：资金账号：第页共页单位：元',
        '当前缴存状态：当前缴存单位：打印日期：当前月缴存额：',
        '演示样例·非正式对账单授权码：',
        ''.join(HEAD_LABELS),
        str(p.get('name') or ''),
        str(p.get('id_number') or ''),
        str(p.get('customer_no') or ''),
        str(p.get('fund_account') or ''),
        str(p.get('statement_start') or ''),
        str(p.get('statement_end') or ''),
        str(p.get('deposit_status') or ''),
        str(p.get('deposit_unit') or ''),
        str(p.get('print_date') or ''),
        str(p.get('monthly_deposit') or ''),
        str(auth_code or ''),
    ]
    for r in rows or []:
        parts.extend([
            str(r.get('seq') or ''),
            str(r.get('date') or ''),
            str(r.get('summary') or ''),
            money(r.get('increase')),
            money(r.get('decrease')),
            money(r.get('balance')),
        ])
    return ''.join(norm_text(x) for x in parts)


def draw_table(page, font_body, body_name, font_title, title_name, rows, y0):
    head_h = 26.0
    row_h = 24.0
    n = len(rows)
    y_head = y0 + head_h
    y_end = y_head + row_h * n
    # 外框 + 表头分隔 + 行线
    draw_rect(page, X0, y0, X1, y_end, width=1.0)
    draw_hline(page, X0, X1, y_head, width=0.8)
    for i in range(1, n):
        draw_hline(page, X0, X1, y_head + row_h * i, width=0.6)
    for x in COL_X[1:-1]:
        draw_vline(page, x, y0, y_end, width=0.6)
    # 表头
    for ci, lab in enumerate(HEAD_LABELS):
        cell_box(page, font_title, title_name, lab, COL_X[ci], COL_X[ci + 1],
                 y0, y_head, size=11.0)
    # 数据行
    for ri, r in enumerate(rows):
        ry0 = y_head + row_h * ri
        ry1 = ry0 + row_h
        vals = [
            (str(r.get('seq') or ''), 'center'),
            (str(r.get('date') or ''), 'center'),
            (str(r.get('summary') or ''), 'center'),
            (money(r.get('increase')), 'center'),
            (money(r.get('decrease')), 'center'),
            (money(r.get('balance')), 'center'),
        ]
        for ci, (val, al) in enumerate(vals):
            cell_box(page, font_body, body_name, val, COL_X[ci], COL_X[ci + 1],
                     ry0, ry1, size=10.0, align=al, min_size=7.0)
    return y_end


def render(payload, auth_code, qr_url, out_path):
    p = payload or {}
    rows = list(p.get('rows') or [])

    blob = collect_blob(p, rows, auth_code)
    full_body = ensure_full_cjk_font()
    full_title = ensure_bold_cjk_font()
    subset_body = make_subset_font(full_body, blob, prefix='gjj_body_')
    title_blob = (
        '杭州住房公积金管理中心一般住房公积金个人年度对账单（自助打印）'
        + ''.join(HEAD_LABELS)
        + '序号记账日期摘要增加减少余额'
        + '0123456789（）()-.'
    )
    subset_title = (
        make_subset_font(full_title, title_blob, prefix='gjj_title_')
        if full_title != full_body
        else subset_body
    )
    font_body = subset_body
    font_title = subset_title
    qr_path = None
    doc = None

    try:
        doc = fitz.open()
        qr_path = os.path.join(tempfile.gettempdir(), 'gjj_qr_%s.png' % os.getpid())
        make_qr_png(qr_url, qr_path)

        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        body_name, title_name = register_fonts(page, font_body, font_title)

        # —— 顶部二维码 ——
        if qr_path and os.path.isfile(qr_path):
            page.insert_image(fitz.Rect(46.0, 26.0, 112.0, 92.0), filename=qr_path)

        # —— 标题 + 对账日期 ——
        title = '杭州住房公积金管理中心一般住房公积金个人年度对账单(自助打印)'
        tsize = fit_fontsize(font_title, title, X1 - X0 - 8, 15.6, min_size=11.0)
        tw = text_width(font_title, title, tsize)
        page.insert_text(((PAGE_W - tw) / 2.0, 96.0), title,
                         fontname=title_name, fontsize=tsize, color=(0, 0, 0))
        sub = '对账日期：%s-%s' % (
            str(p.get('statement_start') or ''), str(p.get('statement_end') or ''))
        ssize = 10.5
        sw = text_width(font_body, sub, ssize)
        page.insert_text(((PAGE_W - sw) / 2.0, 114.0), sub,
                         fontname=body_name, fontsize=ssize, color=(0, 0, 0))

        # —— 身份信息（双列）——
        info_size = 10.5
        lx = X0 + 6
        rx = 372.0
        page_y1, page_y2, page_y3 = 154.0, 175.0, 196.0
        label_value(page, font_body, body_name, font_title, title_name,
                    '姓名：', p.get('name') or '', lx, page_y1, size=info_size)
        label_value(page, font_body, body_name, font_title, title_name,
                    '个人客户号：', p.get('customer_no') or '', lx, page_y2, size=info_size)
        label_value(page, font_body, body_name, font_title, title_name,
                    '身份证号码：', p.get('id_number') or '', rx, page_y1, size=info_size)
        label_value(page, font_body, body_name, font_title, title_name,
                    '资金账号：', p.get('fund_account') or '', rx, page_y2, size=info_size)
        page_no = '第%s页/共%s页    单位：元' % (
            str(p.get('page_no') or '1'), str(p.get('page_total') or '1'))
        text_at(page, font_body, body_name, page_no, rx, page_y3, size=info_size)

        # —— 明细表 ——
        table_y0 = 216.0
        y_end = draw_table(page, font_body, body_name, font_title, title_name, rows, table_y0)

        # —— 底部缴存信息（双列）——
        foot_size = 10.5
        fy1 = y_end + 20.0
        fy2 = fy1 + 20.0
        label_value(page, font_body, body_name, font_title, title_name,
                    '当前缴存状态：', p.get('deposit_status') or '正常', lx, fy1, size=foot_size)
        label_value(page, font_body, body_name, font_title, title_name,
                    '当前缴存单位：', p.get('deposit_unit') or '', lx, fy2, size=foot_size)
        label_value(page, font_body, body_name, font_title, title_name,
                    '打印日期：', p.get('print_date') or '', rx, fy1, size=foot_size)
        label_value(page, font_body, body_name, font_title, title_name,
                    '当前月缴存额：', money(p.get('monthly_deposit')), rx, fy2, size=foot_size)

        # —— 电子章（右上，压标题右端"对账单(自助打印)"；对齐样张：直径约108，右侧留白）——
        if os.path.isfile(SEAL_PNG):
            page.insert_image(fitz.Rect(372.0, 66.0, 480.0, 174.0), filename=SEAL_PNG,
                              keep_proportion=True, overlay=True)

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
        print('usage: gjj_hz_render_pdf.py <payload.json> <out.pdf>', file=sys.stderr)
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
