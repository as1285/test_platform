#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""上海市参保人员城镇职工基本养老保险参保情况 · 演示 PDF。

版式对齐随申办 / 一网通办出具的近 60 个月参保情况样张：
- 居中标题；
- 姓名 / 社会保障号码 / 证件号码；
- 三栏 × 20 行（序号、年月、参保情况、补缴退账年月）；
- 近 60 个月缴费单位信息（左右两栏）+ 累计缴费月数；
- 备注 + 经办机构电子章 + 打印日期 + 电子印章验证码。
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
SEAL_PNG = os.path.join(ASSETS, 'sh_seal.png')

PAGE_W, PAGE_H = 595.0, 842.0
X0, X1 = 28.0, 567.0
LW = 0.55
TITLE = '参保人员城镇职工基本养老保险参保情况'
HEAD_GRAY = (0.945, 0.945, 0.945)
WATERMARK = (
    '本文件由全国社保卡服务平台提供，任何第三方机构不得对数据进行二次加工、'
    '处理、解析或以任何形式用于商业用途，否则将追究法律责任。'
)
NOTES = [
    '备注：',
    '1.本信息来源于上海市“一网通办”平台及“随申办”APP，仅供查询参考；如需核对真伪，请通过上述渠道核验。',
    '2.“已记账”指当期养老保险费已记入个人账户；“未缴费”指当期尚未缴费；“欠缴”指应缴未缴。',
    '3.“累计缴费月数”为截至查询止月本市城镇职工基本养老保险实际缴费月数合计（含转入）。',
]


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


def fill_header_row(page, x0, x1, y0, y1):
    page.draw_rect(fitz.Rect(x0, y0, x1, y1), color=None, fill=HEAD_GRAY, width=0)


def draw_watermark(page, fp, fn, stamp):
    text = WATERMARK
    if stamp:
        text = text + '(%s)' % stamp
    color = (0.86, 0.86, 0.86)
    mat = fitz.Matrix(1, 1).prerotate(28)
    y = 120.0
    x = 55.0
    while y < PAGE_H - 40:
        origin = fitz.Point(x, y)
        page.insert_text(
            origin,
            text,
            fontname=fn,
            fontsize=8.5,
            color=color,
            morph=(origin, mat),
        )
        y += 78.0
        x = 40.0 if x > 70 else 95.0


def month_cols():
    """三栏：每栏 序号|年月|参保情况|补缴退账年月。"""
    usable = X1 - X0
    col_w = usable / 3.0
    # 每栏内相对宽度
    inner = [0.14, 0.24, 0.28, 0.34]
    xs = [X0]
    for g in range(3):
        base = X0 + g * col_w
        acc = 0.0
        for i, r in enumerate(inner):
            acc += r
            if g == 2 and i == len(inner) - 1:
                xs.append(X1)
            else:
                xs.append(round(base + col_w * acc, 2))
    xs[-1] = X1
    return xs


MONTH_X = month_cols()


def emp_cols():
    mid = (X0 + X1) / 2.0
    # 左：单位名称 | 起止；右：单位名称 | 起止
    return [X0, X0 + 118, mid, mid + 118, X1]


EMP_X = emp_cols()


def ensure_months(p):
    rows = list(p.get('months') or [])
    out = []
    for i, r in enumerate(rows):
        if not isinstance(r, dict):
            continue
        ym = str(r.get('ym') or '')
        if not ym:
            y = str(r.get('year') or '')
            m = str(r.get('month') or '').zfill(2)[-2:]
            if y and m:
                ym = y + m
        out.append(
            {
                'seq': int(r.get('seq') or (i + 1)),
                'ym': ym,
                'status': str(r.get('status') or '未缴费'),
                'refund_ym': str(r.get('refund_ym') or r.get('refundYm') or ''),
            }
        )
    while len(out) < 60:
        out.append({'seq': len(out) + 1, 'ym': '', 'status': '', 'refund_ym': ''})
    return out[:60]


def collect_text(p):
    parts = [
        TITLE,
        NOTES[0],
        NOTES[1],
        NOTES[2],
        NOTES[3],
        '姓名',
        '社会保障号码',
        '证件号码',
        '序号',
        '年月',
        '参保情况',
        '补缴退账年月',
        '近60个月缴费单位信息',
        '缴费单位名称',
        '缴费起止时间',
        '经办机构',
        '打印日期',
        '电子印章验证码',
        '验证码',
        '截至',
        '累计缴费月数',
    ]
    for k in (
        'name',
        'ss_number',
        'id_number',
        'print_date',
        'print_date_label',
        'agency_name',
        'as_of_label',
        'total_months_label',
        'seal_sig',
        'seal_verify_tail',
        'watermark_id',
        'auth_note',
    ):
        parts.append(str(p.get(k) or ''))
    for r in ensure_months(p):
        parts.append(r.get('ym') or '')
        parts.append(r.get('status') or '')
        parts.append(r.get('refund_ym') or '')
        parts.append(str(r.get('seq') or ''))
    for e in p.get('employers') or []:
        if isinstance(e, dict):
            parts.append(str(e.get('company_name') or ''))
            parts.append(str(e.get('period_label') or ''))
    return ''.join(parts)


def draw_info_table(page, fp, fn, fb, fbn, p, y0):
    row_h = 18.0
    y1 = y0 + row_h
    # 姓名 | 值 | 社会保障号码 | 值 | 证件号码 | 值
    xs = [X0, X0 + 42, X0 + 118, X0 + 188, X0 + 318, X0 + 378, X1]
    grid(page, xs, [y0, y1])
    labs = ['姓名', '社会保障号码', '证件号码']
    vals = [
        p.get('name') or '',
        p.get('ss_number') or p.get('id_number') or '',
        p.get('id_number') or '',
    ]
    for i, lab in enumerate(labs):
        cell_box(page, fb, fbn, lab, xs[i * 2], xs[i * 2 + 1], y0, y1, size=9.0, min_size=7.0)
        cell_box(
            page,
            fp,
            fn,
            vals[i],
            xs[i * 2 + 1],
            xs[i * 2 + 2],
            y0,
            y1,
            size=8.5,
            min_size=6.5,
        )
    return y1


def draw_month_table(page, fp, fn, fb, fbn, months, y0):
    heads = ['序号', '年月', '参保情况', '补缴退账年月']
    row_h = 11.6
    head_h = 14.0
    # 三栏各 20 行数据 + 1 行表头
    ys = [y0, y0 + head_h]
    for i in range(20):
        ys.append(ys[-1] + row_h)
    # 表头底色（三栏）
    for g in range(3):
        fill_header_row(page, MONTH_X[g * 4], MONTH_X[g * 4 + 4], ys[0], ys[1])
    grid(page, MONTH_X, ys)
    for g in range(3):
        for j, h in enumerate(heads):
            cell_box(
                page,
                fb,
                fbn,
                h,
                MONTH_X[g * 4 + j],
                MONTH_X[g * 4 + j + 1],
                ys[0],
                ys[1],
                size=7.2,
                min_size=5.8,
            )
        chunk = months[g * 20 : (g + 1) * 20]
        for i in range(20):
            r = chunk[i] if i < len(chunk) else None
            vals = [
                str(r.get('seq') or '') if r else '',
                r.get('ym') or '' if r else '',
                r.get('status') or '' if r else '',
                r.get('refund_ym') or '' if r else '',
            ]
            for j, val in enumerate(vals):
                cell_box(
                    page,
                    fp,
                    fn,
                    val,
                    MONTH_X[g * 4 + j],
                    MONTH_X[g * 4 + j + 1],
                    ys[i + 1],
                    ys[i + 2],
                    size=7.0,
                    min_size=5.5,
                )
    return ys[-1]


def draw_employer_section(page, fp, fn, fb, fbn, p, y0):
    # 标题行
    y1 = y0 + 16.0
    fill_header_row(page, X0, X1, y0, y1)
    hline(page, y0)
    hline(page, y1)
    vline(page, X0, y0, y1)
    vline(page, X1, y0, y1)
    cell_box(
        page,
        fb,
        fbn,
        '近60个月缴费单位信息',
        X0,
        X1,
        y0,
        y1,
        size=9.5,
        min_size=8.0,
    )
    # 表头
    y2 = y1 + 14.0
    fill_header_row(page, X0, X1, y1, y2)
    xs = EMP_X
    grid(page, xs, [y1, y2])
    for g in range(2):
        cell_box(page, fb, fbn, '缴费单位名称', xs[g * 2], xs[g * 2 + 1], y1, y2, size=8.0, min_size=6.5)
        cell_box(page, fb, fbn, '缴费起止时间', xs[g * 2 + 1], xs[g * 2 + 2], y1, y2, size=8.0, min_size=6.5)

    employers = list(p.get('employers') or [])
    # 左右各最多 4 行
    n_rows = max(1, (len(employers) + 1) // 2, 1)
    n_rows = min(4, max(n_rows, 1 if employers else 1))
    row_h = 15.0
    ys = [y2]
    for _ in range(n_rows):
        ys.append(ys[-1] + row_h)
    grid(page, xs, ys)
    left = employers[0::2]
    right = employers[1::2]
    for i in range(n_rows):
        for side, bucket in ((0, left), (1, right)):
            e = bucket[i] if i < len(bucket) else None
            name = (e.get('company_name') or '') if e else ''
            period = (e.get('period_label') or '') if e else ''
            cell_box(
                page,
                fp,
                fn,
                name,
                xs[side * 2],
                xs[side * 2 + 1],
                ys[i],
                ys[i + 1],
                size=7.2,
                min_size=5.5,
                align='left',
                pad=1.5,
            )
            cell_box(
                page,
                fp,
                fn,
                period,
                xs[side * 2 + 1],
                xs[side * 2 + 2],
                ys[i],
                ys[i + 1],
                size=7.0,
                min_size=5.5,
            )
    # 累计行
    y_sum0 = ys[-1]
    y_sum1 = y_sum0 + 16.0
    hline(page, y_sum0)
    hline(page, y_sum1)
    vline(page, X0, y_sum0, y_sum1)
    vline(page, X1, y_sum0, y_sum1)
    summary = p.get('total_months_label') or ''
    if not summary:
        as_of = p.get('as_of_label') or ''
        total = p.get('total_months')
        if as_of and total is not None:
            summary = '截至%s，累计缴费月数 %s' % (as_of, total)
        elif total is not None:
            summary = '累计缴费月数 %s' % total
    cell_box(page, fp, fn, summary, X0, X1, y_sum0, y_sum1, size=9.0, min_size=7.0, align='left', pad=4)
    return y_sum1


def draw_notes(page, fp, fn, fb, fbn, y0):
    y = y0 + 10
    for i, line in enumerate(NOTES):
        fontp, fontn = (fb, fbn) if i == 0 else (fp, fn)
        cell_box(
            page,
            fontp,
            fontn,
            line,
            X0,
            X1,
            y,
            y + 12,
            size=8.0 if i == 0 else 7.4,
            min_size=6.0,
            align='left',
            pad=0,
        )
        y += 12 if i == 0 else 11
    return y


def draw_footer(page, fp, fn, fb, fbn, p):
    note = p.get('auth_note') or (
        '◆上海市社会保险事业管理中心业务专用章已经上海市数字证书认证中心认证，'
        '是对外经办业务指定电子印章，与社保经办机构印章具有同等效力，不再另行盖章。'
    )
    # 左侧认证说明
    cell_box(
        page,
        fp,
        fn,
        note,
        X0,
        X0 + 320,
        700,
        748,
        size=7.2,
        min_size=5.8,
        align='left',
        pad=0,
    )
    agency = p.get('agency_name') or '上海市社会保险事业管理中心'
    print_label = p.get('print_date_label') or p.get('print_date') or ''
    if print_label and not str(print_label).startswith('打印'):
        print_label = '打印日期：' + str(print_label)
    cell_box(
        page,
        fp,
        fn,
        '经办机构：' + agency,
        X0 + 300,
        X1 - 10,
        710,
        726,
        size=8.5,
        min_size=7.0,
        align='right',
        pad=0,
    )
    cell_box(
        page,
        fp,
        fn,
        print_label,
        X0 + 300,
        X1 - 10,
        726,
        742,
        size=8.5,
        min_size=7.0,
        align='right',
        pad=0,
    )
    if os.path.isfile(SEAL_PNG):
        size = 88.0
        page.insert_image(
            fitz.Rect(PAGE_W - 36 - size, 688, PAGE_W - 36, 688 + size),
            filename=SEAL_PNG,
        )
    sig = str(p.get('seal_sig') or '')
    tail = str(p.get('seal_verify_tail') or '')
    cell_box(
        page,
        fp,
        fn,
        '电子印章验证码',
        X0,
        X0 + 78,
        760,
        774,
        size=7.5,
        min_size=6.0,
        align='left',
        pad=0,
    )
    # 签名可能很长：拆两行
    if len(sig) > 72:
        line1, line2 = sig[:72], sig[72:]
        if tail:
            line2 = (line2 + '  验证码：' + tail) if line2 else ('验证码：' + tail)
        cell_box(page, fp, fn, line1, X0 + 78, X1, 758, 770, size=6.2, min_size=5.0, align='left', pad=0)
        cell_box(page, fp, fn, line2, X0 + 78, X1, 770, 782, size=6.2, min_size=5.0, align='left', pad=0)
    else:
        full = sig + (('  验证码：' + tail) if tail else '')
        cell_box(page, fp, fn, full, X0 + 78, X1, 760, 776, size=6.4, min_size=5.0, align='left', pad=0)


def render(payload, out_pdf, auth_code=''):
    p = payload if isinstance(payload, dict) else {}
    months = ensure_months(p)
    blob = collect_text(p) + str(auth_code or '')
    body_full = ensure_full_cjk_font()
    bold_full = ensure_bold_cjk_font()
    body_path = make_subset_font(body_full, blob + WATERMARK, prefix='sbdy_sh_')
    title_path = make_subset_font(bold_full, blob + TITLE, prefix='sbdy_sh_b_')
    doc = fitz.open()
    try:
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        fn, fbn = register_fonts(page, body_path, title_path)
        draw_watermark(page, body_path, fn, p.get('watermark_id') or '')
        cell_box(page, title_path, fbn, TITLE, X0, X1, 28, 52, size=15.0, min_size=12.0)
        y = draw_info_table(page, body_path, fn, title_path, fbn, p, 56)
        y = draw_month_table(page, body_path, fn, title_path, fbn, months, y + 6)
        y = draw_employer_section(page, body_path, fn, title_path, fbn, p, y + 8)
        draw_notes(page, body_path, fn, title_path, fbn, y)
        draw_footer(page, body_path, fn, title_path, fbn, p)
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
        print('usage: sbdy_sh_render_pdf.py in.json out.pdf', file=sys.stderr)
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
