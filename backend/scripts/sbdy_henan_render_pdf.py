#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""河南省社会保险个人权益记录单演示 PDF。

版式对齐官方样张：宋体正文 + 窄黑体数字（字宽 4.62、字距 1.8~2.27）、
1pt 格线、说明区整框（无竖分栏）+ 框外页脚 + 郑东新区业务查询章。
"""
from __future__ import print_function

import json
import os
import sys
import tempfile
from datetime import datetime

import fitz

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sbdy_render_pdf import (  # noqa: E402
    ensure_full_cjk_font,
    make_qr_png,
    make_subset_font,
    money,
    norm_text,
    text_width,
)

ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
SEAL_PNG = os.path.join(ASSETS, 'henan_seal.png')
LATIN_TTF = os.path.join(ASSETS, 'LiberationSansNarrow-Regular.ttf')

PAGE_W, PAGE_H = 595.0, 841.0
X0, X1 = 27.0, 553.0
LW = 1.0
FS = 10.0
FS_TITLE = 16.0
FS_YEAR = 12.0
CJK_FN = 'ha_cjk'
LAT_FN = 'ha_lat'
# 官方 STSong-Light 西文：数字宽 4.62pt@10，缴费格字距 2.27
DIG_W = 4.62
GAP = {
    'id': 1.80,
    'pay': 2.27,
    'acct': 1.83,
    'foot': 1.56,
    'print': 1.97,
    'year': 3.40,
}

INFO_Y = [114.0, 131.0, 151.0, 171.0, 191.0]
ACCT_X = [27.0, 133.0, 210.0, 256.0, 302.0, 383.0, 446.0, 553.0]
PAY_X = [27.0, 56.0, 133.0, 210.0, 302.0, 383.0, 476.0, 553.0]
PAY_MONTH0 = 363.0
PAY_ROW_H = 20.0

_CJK_PATH = None


def tw(text, size=FS):
    return text_width(_CJK_PATH, str(text or ''), size)


def _cw(ch, size=FS):
    if ch == '.':
        return 2.38 * size / 10.0
    if ch in ':-':
        return 2.50 * size / 10.0
    if ch in '()':
        return 3.20 * size / 10.0
    return DIG_W * size / 10.0


def num_width(text, kind='pay', size=FS):
    chars = [c for c in str(text or '') if c != ' ']
    if not chars:
        return 0.0
    g = GAP.get(kind, 1.8) * size / 10.0
    w = 0.0
    for i, c in enumerate(chars):
        w += _cw(c, size)
        if i < len(chars) - 1:
            w += g
    return w


def put_num(page, x, y, text, kind='pay', size=FS):
    chars = [c for c in str(text or '') if c != ' ']
    g = GAP.get(kind, 1.8) * size / 10.0
    for i, c in enumerate(chars):
        page.insert_text((float(x), float(y)), c, fontname=LAT_FN, fontsize=size, color=(0, 0, 0))
        x += _cw(c, size)
        if i < len(chars) - 1:
            x += g
    return x


def putc_num(page, x0, x1, y, text, kind='pay', size=FS):
    s = str(text or '')
    if not s:
        return
    w = num_width(s, kind, size)
    put_num(page, x0 + (x1 - x0 - w) / 2.0, y, s, kind, size)


def money2(n):
    try:
        x = float(n)
    except Exception:
        return ''
    return '%.2f' % x


def hline(page, y, x0=None, x1=None):
    page.draw_line(
        fitz.Point(X0 if x0 is None else x0, y),
        fitz.Point(X1 if x1 is None else x1, y),
        color=(0, 0, 0),
        width=LW,
    )


def vline(page, x, y0, y1):
    page.draw_line(fitz.Point(x, y0), fitz.Point(x, y1), color=(0, 0, 0), width=LW)


def put(page, x, y, text, size=FS):
    if text is None or text == '':
        return
    page.insert_text((float(x), float(y)), str(text), fontname=CJK_FN, fontsize=size, color=(0, 0, 0))


def putc(page, x0, x1, y, text, size=FS):
    s = '' if text is None else str(text)
    if not s:
        return
    put(page, x0 + (x1 - x0 - tw(s, size)) / 2.0, y, s, size)


def put_left(page, x, y, text, size=FS):
    put(page, x, y, text, size)


def ensure_months(p):
    rows = p.get('ha_months') or p.get('months') or []
    by_m = {}
    if isinstance(rows, list):
        for r in rows:
            if not r:
                continue
            m = str(r.get('month') or '').zfill(2)
            if m.isdigit():
                by_m[m] = r
    out = []
    for i in range(1, 13):
        m = '%02d' % i
        r = by_m.get(m) or {}
        paid = r.get('paid')
        if paid is None:
            paid = r.get('pension_base') not in (None, '', 0, '0')
        pb = r.get('pension_base')
        ub = r.get('unemp_base')
        ib = r.get('injury_base')
        if paid and pb in (None, ''):
            pb = r.get('base_amount') or p.get('base_amount') or ''
        if paid and ub in (None, ''):
            ub = pb
        if paid and ib in (None, ''):
            ib = pb
        flag_p = r.get('pension_flag')
        flag_u = r.get('unemp_flag')
        flag_i = r.get('injury_flag')
        if flag_p is None:
            flag_p = '●' if paid else '-'
        if flag_u is None:
            flag_u = '●' if paid else '-'
        if flag_i is None:
            flag_i = '-'
        out.append(
            {
                'month': m,
                'paid': bool(paid),
                'pension_base': money(pb) if paid and pb not in (None, '') else '',
                'unemp_base': money(ub) if paid and ub not in (None, '') else '',
                'injury_base': money(ib) if paid and ib not in (None, '') else '',
                'pension_flag': flag_p,
                'unemp_flag': flag_u,
                'injury_flag': flag_i,
            }
        )
    return out


def put_status(page, x0, x1, y0, y1, text):
    s = norm_text(text)
    if not s:
        return
    mid = (y0 + y1) / 2.0 + 4.0
    if tw(s) <= (x1 - x0 - 4.0):
        putc(page, x0, x1, mid, s)
        return
    # 官方 dual-line：暂停缴费（中断 / ）
    if s.endswith('）') and tw(s[:-1]) <= (x1 - x0 - 4.0):
        putc(page, x0, x1, y0 + 11.2, s[:-1])
        putc(page, x0, x1, y1 - 2.0, '）')
        return
    putc(page, x0, x1, y0 + 11.2, s[:8], 9.0)
    putc(page, x0, x1, y1 - 2.0, s[8:], 9.0)


def render_henan(payload, auth_code, qr_url, out_path):
    p = payload or {}
    months = ensure_months(p)
    name = norm_text(p.get('name') or '')
    id_no = norm_text(p.get('id_number') or p.get('idNumber') or '')
    social = norm_text(p.get('social_no') or p.get('social_security_no') or id_no)
    gender = norm_text(p.get('gender') or '')
    id_type = norm_text(p.get('id_type') or '居民身份证(户口簿)')
    address = norm_text(p.get('address') or '')
    postal = norm_text(p.get('postal_code') or '')
    company = norm_text(p.get('company_name') or p.get('company') or '')
    work_start = norm_text(p.get('work_start_date') or p.get('work_start') or '')
    year = str(p.get('record_year') or p.get('year') or datetime.now().year)

    enroll = p.get('enroll') or {}
    pen = enroll.get('pension') or {}
    une = enroll.get('unemp') or enroll.get('unemployment') or {}
    inj = enroll.get('injury') or {}
    pen_date = norm_text(pen.get('date') or p.get('pension_enroll_date') or '')
    pen_status = norm_text(pen.get('status') or p.get('status_pension') or '暂停缴费（中断）')
    une_date = norm_text(une.get('date') or p.get('unemp_enroll_date') or '')
    une_status = norm_text(une.get('status') or p.get('status_unemployment') or '暂停缴费（中断）')
    inj_date = norm_text(inj.get('date') or p.get('injury_enroll_date') or '')
    inj_status = norm_text(inj.get('status') or p.get('status_injury') or '暂停缴费（中断）')

    acct = p.get('account') or {}
    prev_bal = money2(acct.get('prev_balance') if acct.get('prev_balance') is not None else p.get('prev_balance'))
    year_prin = money2(
        acct.get('year_principal') if acct.get('year_principal') is not None else p.get('year_principal')
    )
    year_int = money2(
        acct.get('year_interest') if acct.get('year_interest') is not None else p.get('year_interest') or 0
    )
    acct_months = str(
        acct.get('account_months')
        if acct.get('account_months') is not None
        else p.get('account_months') or ''
    )
    year_out = money2(
        acct.get('year_out_interest')
        if acct.get('year_out_interest') is not None
        else p.get('year_out_interest')
        if p.get('year_out_interest') is not None
        else year_prin
    )
    total_bal = money2(
        acct.get('total_balance') if acct.get('total_balance') is not None else p.get('total_balance')
    )
    form_code = norm_text(p.get('form_verify_code') or auth_code or '')
    data_as_of = norm_text(p.get('data_as_of') or p.get('data_cutoff') or '')
    print_date = norm_text(p.get('print_date') or '')

    global _CJK_PATH
    blob = (
        name
        + id_no
        + social
        + gender
        + id_type
        + address
        + postal
        + company
        + work_start
        + year
        + pen_status
        + une_status
        + inj_status
        + '河南省社会保险个人权益记录单单位名称：元证件类型号码社会保障姓名性别联系地址邮政编码'
        '参加工作时间账户情况险种截止上年末累计存储额本年记入本金利息月数支出额账累计储存额'
        '参保缴费基本养老失业工伤月份时间状态基数情况说明仅供人员核对信息扫描二维码验证表单真伪'
        '表示已经实缴欠费外地转入未制定计划若参保对象存在多个单位所在为准个人不缴费如果显示正常'
        '数据统计截止至打印时间暂停缴费中断居民身份证户口簿电子签章预留经办机构●△○—、：。:_-() 0123456789'
        + '以本权益单仅供人员核对信息扫描二维码验证表单真伪'
        + '说明：  1、本权益单仅供参保人员核对信息。'
        + '  2、扫描二维码验证表单真伪。'
        + '  3、●表示已经实缴，△表示欠费，○表示外地转入，-表示未制定计划。'
        + '  4、若参保对象存在在多个单位参保时，以参加养老保险所在单位为准。'
        + '5、工伤保险个人不缴费，如果缴费基数显示正常，-表示正常参保。'
        + '数据统计截止至：打印时间：'
    )
    _CJK_PATH = make_subset_font(ensure_full_cjk_font(), blob, prefix='sbdy_ha_')
    doc = fitz.open()
    page = doc.new_page(width=PAGE_W, height=PAGE_H)
    page.insert_font(fontname=CJK_FN, fontfile=_CJK_PATH)
    page.insert_font(fontname=LAT_FN, fontfile=LATIN_TTF)

    # 表单验证号码 + 二维码（样张：字顶 y=3 size=8，图 30,15,90,75）
    put(page, 30.0, 11.0, '表单验证号码', 8.0)
    page.insert_text(
        (30.0 + tw('表单验证号码', 8.0), 11.0),
        form_code,
        fontname=LAT_FN,
        fontsize=8.0,
        color=(0, 0, 0),
    )
    qr_tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
    qr_tmp.close()
    try:
        make_qr_png(qr_url or ('https://geshui.vip/sbdy_verify.html?c=' + form_code), qr_tmp.name)
        page.insert_image(fitz.Rect(30.0, 15.0, 90.0, 75.0), filename=qr_tmp.name, keep_proportion=True)
    finally:
        try:
            os.unlink(qr_tmp.name)
        except Exception:
            pass

    # 标题相对表格水平居中
    title = '河南省社会保险个人权益记录单'
    putc(page, X0, X1, 76.9, title, FS_TITLE)
    yw = num_width(year, 'year', FS_YEAR)
    parw = _cw('(', FS_YEAR)
    gap = 8.0
    block = parw + gap + yw + gap + parw
    x_year = (X0 + X1 - block) / 2.0
    put_num(page, x_year, 92.4, '(', kind='year', size=FS_YEAR)
    put_num(page, x_year + parw + gap, 92.4, year, kind='year', size=FS_YEAR)
    put_num(page, x_year + parw + gap + yw + gap, 92.4, ')', kind='year', size=FS_YEAR)
    put(page, X1 - tw('单位：元'), 111.2, '单位：元')

    # —— 基本信息 ——
    hline(page, 114)
    hline(page, 131)
    hline(page, 151)
    hline(page, 171)
    hline(page, 191)
    for x in (27, 133, 256, 302, 553):
        vline(page, x, 114, 131)
    for x in (27, 133, 256, 302, 446, 476, 553):
        vline(page, x, 131, 151)
    for x in (27, 133, 383, 446, 553):
        vline(page, x, 151, 191)

    y = 127.2
    putc(page, 27, 133, y, '证件类型')
    putc(page, 133, 256, y, id_type)
    putc(page, 256, 302, y, '证件号码')
    putc_num(page, 302, 553, y, id_no, 'id')
    y = 145.2
    putc(page, 27, 133, y, '社会保障号码')
    putc_num(page, 133, 256, y, social, 'id')
    putc(page, 256, 302, y, '姓    名')
    putc(page, 302, 446, y, name)
    putc(page, 446, 476, y, '性别')
    putc(page, 476, 553, y, gender)
    y = 165.2
    putc(page, 27, 133, y, '联系地址')
    if address:
        put_left(page, 137.0, y, address)
    putc(page, 383, 446, y, '邮政编码')
    putc(page, 446, 553, y, postal)
    y = 185.2
    putc(page, 27, 133, y, '单位名称')
    putc(page, 133, 383, y, company)
    putc(page, 383, 446, y, '参加工作时间')
    putc_num(page, 446, 553, y, work_start, 'id')

    # —— 账户情况 ——
    hline(page, 211)
    hline(page, 237)
    hline(page, 257)
    vline(page, X0, 191, 257)
    vline(page, X1, 191, 257)
    putc(page, X0, X1, 205.2, '账户情况')
    for x in ACCT_X:
        vline(page, x, 211, 257)
    hline(page, 224, 133, 210)
    hline(page, 224, 210, 302)
    hline(page, 224, 383, 446)

    putc(page, ACCT_X[0], ACCT_X[1], 228.2, '险种')
    putc(page, ACCT_X[1], ACCT_X[2], 222.2, '截止上年末')
    putc(page, ACCT_X[1], ACCT_X[2], 235.2, '累计存储额')
    putc(page, ACCT_X[2], ACCT_X[3], 222.2, '本年账户')
    putc(page, ACCT_X[3], ACCT_X[4], 222.2, '本年账户')
    putc(page, ACCT_X[2], ACCT_X[3], 235.2, '记入本金')
    putc(page, ACCT_X[3], ACCT_X[4], 235.2, '记入利息')
    putc(page, ACCT_X[4], ACCT_X[5], 228.2, '账户月数')
    putc(page, ACCT_X[5], ACCT_X[6], 222.2, '本年账户支')
    putc(page, ACCT_X[5], ACCT_X[6], 235.2, '出额账利息')
    putc(page, ACCT_X[6], ACCT_X[7], 228.2, '累计储存额')

    y = 251.2
    putc(page, ACCT_X[0], ACCT_X[1], y, '基本养老保险')
    putc_num(page, ACCT_X[1], ACCT_X[2], y, prev_bal, 'acct')
    putc_num(page, ACCT_X[2], ACCT_X[3], y, year_prin, 'acct')
    putc_num(page, ACCT_X[3], ACCT_X[4], y, year_int, 'acct')
    if len(acct_months) >= 2:
        put_num(page, 336.0, y, acct_months[0], 'acct')
        put_num(page, 344.0, y, acct_months[1], 'acct')
    else:
        putc_num(page, ACCT_X[4], ACCT_X[5], y, acct_months, 'acct')
    putc_num(page, ACCT_X[5], ACCT_X[6], y, year_out, 'acct')
    putc_num(page, ACCT_X[6], ACCT_X[7], y, total_bal, 'acct')

    # —— 参保缴费情况 ——
    hline(page, 277)
    hline(page, 297)
    vline(page, X0, 257, 277)
    vline(page, X1, 257, 277)
    putc(page, X0, X1, 271.2, '参保缴费情况')

    for x in (27, 56, 210, 383, 553):
        vline(page, x, 277, 297)
    putc(page, 56, 210, 291.2, '基本养老保险')
    putc(page, 210, 383, 291.2, '失业保险')
    putc(page, 383, 553, 291.2, '工伤保险')

    # 月份跨 297-363；状态/日期行 297-343；基数表头 343-363
    month_bottom = PAY_MONTH0 + 12 * PAY_ROW_H
    vline(page, 27, 277, month_bottom)
    vline(page, 56, 277, month_bottom)
    vline(page, X1, 277, month_bottom)
    putc(page, 27, 56, 324.2, '月份')

    hline(page, 317, 56, X1)
    hline(page, 343, 56, X1)
    hline(page, 363)
    for x in PAY_X[2:]:
        vline(page, x, 297, month_bottom)

    labs = [(56, 133, 210), (210, 302, 383), (383, 476, 553)]
    for a, b, c in labs:
        putc(page, a, b, 311.2, '参保时间')
        putc(page, b, c, 311.2, '缴费状态')
        putc(page, a, b, 357.2, '缴费基数')
        putc(page, b, c, 357.2, '缴费情况')

    statuses = [
        (pen_date, pen_status, 56, 133, 210),
        (une_date, une_status, 210, 302, 383),
        (inj_date, inj_status, 383, 476, 553),
    ]
    for d, st, a, b, c in statuses:
        putc_num(page, a, b, 334.2, d, 'id')
        put_status(page, b, c, 317, 343, st)

    for i, m in enumerate(months):
        y0 = PAY_MONTH0 + i * PAY_ROW_H
        y1 = y0 + PAY_ROW_H
        hline(page, y1)
        yb = y0 + 14.2
        # 月份两数字：样张 x=35 / 43
        mm = m['month']
        put_num(page, 35.0, yb, mm[0], 'pay')
        put_num(page, 43.0, yb, mm[1], 'pay')
        vals = [
            (m['pension_base'], m['pension_flag'], 56, 133, 210),
            (m['unemp_base'], m['unemp_flag'], 210, 302, 383),
            (m['injury_base'], m['injury_flag'], 383, 476, 553),
        ]
        for base, flag, a, b, c in vals:
            if base:
                putc_num(page, a, b, yb, base, 'pay')
            if (flag or '-') == '●':
                putc(page, b, c, yb, '●')
            else:
                putc_num(page, b, c, yb, flag or '-', 'pay')

    # —— 说明区：官方为整框（无竖分栏、无说明条横线），页脚在框外 ——
    note_top = 603.0
    note_bottom = 719.0
    hline(page, note_top)
    hline(page, note_bottom)
    vline(page, X0, note_top, note_bottom)
    vline(page, X1, note_top, note_bottom)

    put_left(page, 33.0, 617.0, '说明：')
    put_left(page, 33.0, 635.0, '1、本权益单仅供参保人员核对信息。')
    put_left(page, 33.0, 653.0, '2、扫描二维码验证表单真伪。')
    put_left(page, 33.0, 671.0, '3、●表示已经实缴，△表示欠费，○表示外地转入，-表示未制定计划。')
    put_left(page, 33.0, 689.0, '4、若参保对象存在在多个单位参保时，以参加养老保险所在单位为准。')
    put_left(page, 33.0, 707.0, '5、工伤保险个人不缴费，如果缴费基数显示正常，-表示正常参保。')

    if os.path.isfile(SEAL_PNG):
        # 盖在说明框右侧，略压说明文字（官方叠印效果）
        page.insert_image(
            fitz.Rect(392.0, 588.0, 540.0, 736.0),
            filename=SEAL_PNG,
            keep_proportion=True,
            overlay=True,
        )

    # 页脚在说明框下方外侧；标签与时间留空，整行宋体
    foot_y = 736.0
    as_of = norm_text(data_as_of)
    if as_of:
        as_of = (
            as_of.replace('数据统计截止至：', '')
            .replace('数据统计截止至:', '')
            .strip()
        )
    left_label = '数据统计截止至：'
    if as_of:
        put_left(page, 27.0, foot_y, left_label)
        # 样张标签与时间之间有明显空档
        put_left(page, 27.0 + tw(left_label) + 18.0, foot_y, as_of)
    else:
        put_left(page, 27.0, foot_y, left_label)

    pd = norm_text(print_date)
    if pd:
        pd = pd.replace('打印时间：', '').replace('打印时间:', '').strip()
    if pd:
        right_text = '打印时间：' + pd
        put(page, X1 - tw(right_text), foot_y, right_text)

    doc.save(out_path, deflate=True, garbage=4)
    doc.close()
    return out_path


def main():
    if len(sys.argv) < 3:
        print('usage: sbdy_henan_render_pdf.py in.json out.pdf', file=sys.stderr)
        return 2
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)
    payload = data.get('payload') if isinstance(data, dict) else {}
    if not payload and isinstance(data, dict):
        payload = data
    auth = ''
    qr = ''
    if isinstance(data, dict):
        auth = data.get('auth_code') or ''
        qr = data.get('qr_url') or data.get('verify_url') or ''
    render_henan(payload or {}, auth, qr, sys.argv[2])
    return 0


if __name__ == '__main__':
    sys.exit(main() or 0)
