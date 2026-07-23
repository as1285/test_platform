#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按参考 show.pdf（PD4ML A4）坐标生成浙江省社保参保证明演示 PDF。"""
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
ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
SEAL_PNG = os.path.join(ASSETS, 'seal.png')
NOTO_TTC = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc'
NOTO_SC_OTF = os.path.join(ASSETS, 'NotoSerifCJKsc-Regular.otf')
NOTO_SC_CACHE = os.path.join(tempfile.gettempdir(), 'sbdy_NotoSerifCJKsc-Regular.otf')

PAGE_W, PAGE_H = 595.0, 842.0
X0, X1 = 34.3, 560.2

# 明细表列宽（对齐参考 PDF 竖线）
COL_X = [34.5, 62.4, 79.5, 167.8, 234.6, 274.2, 318.1, 371.6, 416.5, 454.5, 511.2, 542.3, 560.5]

_FULL_FONT_PATH = None
_FONT_CACHE = {}


def ensure_full_cjk_font():
    """准备完整简体 Serif CJK（优先系统 TTC 抽面，避免仓库塞 24MB）。"""
    global _FULL_FONT_PATH
    if _FULL_FONT_PATH and os.path.isfile(_FULL_FONT_PATH):
        return _FULL_FONT_PATH
    for path in (NOTO_SC_OTF, NOTO_SC_CACHE):
        if os.path.isfile(path) and os.path.getsize(path) > 1_000_000:
            _FULL_FONT_PATH = path
            return path
    if os.path.isfile(NOTO_TTC):
        ttc = TTCollection(NOTO_TTC)
        # Noto Serif CJK: JP=0 KR=1 SC=2 TC=3 HK=4
        face = ttc.fonts[2]
        face.flavor = None
        face.save(NOTO_SC_CACHE)
        _FULL_FONT_PATH = NOTO_SC_CACHE
        return NOTO_SC_CACHE
    raise RuntimeError('missing CJK font: install fonts-noto-cjk or place NotoSerifCJKsc-Regular.otf')


def make_subset_font(text_blob):
    """按本文字集裁切字体，控制 PDF 体积。"""
    src = ensure_full_cjk_font()
    # 保底 ASCII + 常用标点，避免缺字
    text_blob = (text_blob or '') + '0123456789.-/():（）%，第页共年月 '
    opts = ft_subset.Options()
    opts.layout_closure = False
    opts.name_IDs = ['*']
    opts.name_languages = ['*']
    opts.notdef_outline = True
    opts.recalc_bounds = True
    font = TTFont(src)
    subsetter = ft_subset.Subsetter(options=opts)
    subsetter.populate(text=text_blob)
    subsetter.subset(font)
    fd, path = tempfile.mkstemp(suffix='.otf', prefix='sbdy_sub_')
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


def company_display(p):
    if p.get('company_display'):
        return str(p['company_display'])
    c = str(p.get('company_name') or '')
    code = str(p.get('credit_code') or '')
    if c and code:
        return '%s（%s）' % (c, code)
    return c or code or ''


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
    return out


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


def insert_cjk(page, point, text, font_path, fontsize=9, color=(0, 0, 0)):
    text = '' if text is None else str(text)
    if not text:
        return
    fo = _font_obj(font_path)
    tw = fitz.TextWriter(page.rect, color=color)
    tw.append(point, text, font=fo, fontsize=fontsize)
    tw.write_text(page)


def text_width(font_path, text, size):
    fo = _font_obj(font_path)
    if fo is None:
        return size * max(len(text), 1) * 0.5
    return fo.text_length(text, fontsize=size)


def cell_center(page, font, text, x0, x1, y0, y1, size=9, color=(0, 0, 0)):
    text = '' if text is None else str(text)
    if not text:
        return
    tw = text_width(font, text, size)
    x = x0 + max(0, (x1 - x0 - tw) / 2)
    y = y0 + (y1 - y0) * 0.72
    insert_cjk(page, fitz.Point(x, y), text, font, fontsize=size, color=color)


def make_qr_png(url, path):
    img = qrcode.make(url or 'https://geshui.vip/', border=1, box_size=6)
    img.save(path)


def collect_text_blob(p, months, auth_code):
    parts = [
        '浙江省社会保险参保证明（个人专用）',
        '共1页，第1页',
        '姓名',
        '社会保障号',
        '证件类型',
        '证件号码',
        '性别',
        '参加社会保险基本情况',
        '险　　种',
        '养老保险',
        '工伤保险',
        '失业保险',
        '参保状态',
        '参保单位',
        '出具证明前12个月缴费情况',
        '年',
        '月',
        '单位编号',
        '参保地',
        '缴费基数(元)',
        '个人缴费(元)',
        '缴费状况',
        '备注',
        '（盖章）',
        '打印时间：',
        '备注：1.本证明已签署经国家电子政务外网浙江省电子认证注册的机构认证的电子印章，社保经办机构不再另行签章。',
        '2.本证明出具后3个月内可在“浙江政务服务网”进行网上验证，授权码：',
        '验证平台：',
        '3.本证明为打印时48个月内的参保情况，如需打印48个月以上的，请至人工窗口办理。',
        '4.本证明妥善保管，最终解释权由参保地社保经办机构所有。',
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
    return ''.join(str(x) for x in parts)


def render(payload, auth_code, verify_url, out_path):
    p = payload or {}
    months = ensure_months(p)
    if len(months) > 12:
        months = months[-12:]
    while len(months) < 12:
        months.append(None)

    subset_path = make_subset_font(collect_text_blob(p, months, auth_code))
    font_body = subset_path
    font_title = subset_path
    qr_path = None

    try:
        doc = fitz.open()
        page = doc.new_page(width=PAGE_W, height=PAGE_H)

        title = '浙江省社会保险参保证明（个人专用）'
        tsize = 21.4
        tw = text_width(font_title, title, tsize)
        insert_cjk(page, fitz.Point((PAGE_W - tw) / 2.0, 68.5), title, font_title, fontsize=tsize)

        qr_path = os.path.join(tempfile.gettempdir(), 'sbdy_qr_%s.png' % os.getpid())
        make_qr_png(verify_url, qr_path)
        page.insert_image(fitz.Rect(497.8, 10.4, 582.9, 101.1), filename=qr_path)

        insert_cjk(page, fitz.Point(496.5, 112.0), '共1页，第1页', font_body, fontsize=9.0)

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
            cell_center(page, font_body, info_labels[i], info_xs[i * 2], info_xs[i * 2 + 1], y_t1_0, y_t1_1, 9.0)
            cell_center(page, font_body, info_vals[i], info_xs[i * 2 + 1], info_xs[i * 2 + 2], y_t1_0, y_t1_1, 9.0)
        cell_center(page, font_body, '参加社会保险基本情况', X0, X1, y_t1_1, y_t1_2, 10.0)

        y2 = [149.7, 164.4, 178.8, 193.3, 207.5]
        draw_rect(page, y2[0], y2[-1])
        for y in y2[1:-1]:
            draw_hline(page, y)
        bx = [34.3, 112.1, 259.8, 415.5, 560.2]
        for x in bx:
            draw_vline(page, x, y2[0], y2[3])
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
                cell_center(page, font_body, val, bx[ci], bx[ci + 1], y2[ri], y2[ri + 1], 9.0)
        cell_center(page, font_body, '参保单位', bx[0], bx[1], y2[2], y2[3], 9.0)
        cell_center(page, font_body, company_display(p), bx[1], bx[4], y2[2], y2[3], 9.0)
        period = p.get('period_label') or ''
        cell_center(
            page,
            font_body,
            '出具证明前12个月缴费情况（%s）' % period,
            X0,
            X1,
            y2[3],
            y2[4],
            10.0,
        )

        y3_0 = 207.5
        y3_h1 = 222.2
        y3_h2 = 248.4
        row_h = 14.45
        n_body = 24
        y3_end = y3_h2 + row_h * n_body
        draw_rect(page, y3_0, y3_end)
        draw_hline(page, y3_h1)
        draw_hline(page, y3_h2)
        for i in range(1, n_body):
            draw_hline(page, y3_h2 + row_h * i)
        for x in COL_X:
            draw_vline(page, x, y3_0, y3_end)

        cell_center(page, font_body, '年', COL_X[0], COL_X[1], y3_0, y3_h2, 9.0)
        cell_center(page, font_body, '月', COL_X[1], COL_X[2], y3_0, y3_h2, 9.0)
        cell_center(page, font_body, '单位编号', COL_X[2], COL_X[3], y3_0, y3_h2, 9.0)
        cell_center(page, font_body, '养老保险', COL_X[3], COL_X[7], y3_0, y3_h1, 9.0)
        cell_center(page, font_body, '失业保险', COL_X[7], COL_X[11], y3_0, y3_h1, 9.0)
        cell_center(page, font_body, '备注', COL_X[11], COL_X[12], y3_0, y3_h2, 9.0)

        sub = ['参保地', '缴费基数(元)', '个人缴费(元)', '缴费状况']
        for i, lab in enumerate(sub):
            cell_center(page, font_body, lab, COL_X[3 + i], COL_X[4 + i], y3_h1, y3_h2, 8.0)
            cell_center(page, font_body, lab, COL_X[7 + i], COL_X[8 + i], y3_h1, y3_h2, 8.0)

        for i in range(12):
            y0 = y3_h2 + row_h * i
            y1 = y0 + row_h
            r = months[i]
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
                cell_center(page, font_body, val, COL_X[ci], COL_X[ci + 1], y0, y1, 8.6)

        auth = str(auth_code or '')
        validate = 'https://mapi.zjzwfw.gov.cn/web/mgop/gov-open/zj/2002199511/reserved/index.html#/validate'
        notes = [
            '备注：1.本证明已签署经国家电子政务外网浙江省电子认证注册的机构认证的电子印章，社保经办机构不再另行签章。',
            '2.本证明出具后3个月内可在“浙江政务服务网”进行网上验证，授权码：%s，' % auth,
            '验证平台：%s。' % validate,
            '3.本证明为打印时48个月内的参保情况，如需打印48个月以上的，请至人工窗口办理。',
            '4.本证明妥善保管，最终解释权由参保地社保经办机构所有。',
        ]
        ny = 605.0
        for i, line in enumerate(notes):
            x = 34.3 if i == 0 else 60.0
            if i == 2:
                prefix = '验证平台：'
                insert_cjk(page, fitz.Point(x, ny + i * 13.5), prefix, font_body, fontsize=9.0)
                px = x + text_width(font_body, prefix, 9.0)
                insert_cjk(page, fitz.Point(px, ny + i * 13.5), validate, font_body, fontsize=9.0, color=(0, 0, 1))
                uw = text_width(font_body, validate, 9.0)
                page.insert_link(
                    {
                        'kind': fitz.LINK_URI,
                        'from': fitz.Rect(px, ny + i * 13.5 - 10, px + uw, ny + i * 13.5 + 2),
                        'uri': verify_url or validate,
                    }
                )
            else:
                insert_cjk(page, fitz.Point(x, ny + i * 13.5), line, font_body, fontsize=9.0)

        insert_cjk(page, fitz.Point(492.2, 683.0), '（盖章）', font_body, fontsize=10.0)
        print_date = str(p.get('print_date') or '')
        pd = '打印时间：' + print_date
        pdw = text_width(font_body, pd, 10.0)
        insert_cjk(page, fitz.Point((PAGE_W - pdw) / 2.0, 698.0), pd, font_body, fontsize=10.0)
        if os.path.isfile(SEAL_PNG):
            page.insert_image(fitz.Rect(430, 620, 575, 765), filename=SEAL_PNG, keep_proportion=True, overlay=True)

        doc.save(out_path, deflate=True, garbage=4)
        doc.close()
    finally:
        _FONT_CACHE.pop(subset_path, None)
        for path in (subset_path, qr_path):
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
        data.get('verify_url') or '',
        sys.argv[2],
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())
