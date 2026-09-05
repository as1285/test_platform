#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""深圳社会保险参保证明（「深圳新」）演示 PDF。

版式对齐移动端「个人权益记录（参保证明）」：
标题、文号、信息行、（一）历年参保年限、（二）近两年缴费明细、备注、双章、页脚。
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
    ensure_full_cjk_font,
    make_subset_font,
    money,
    norm_text,
    register_fonts,
    text_width,
)

ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
SEAL_SI = os.path.join(ASSETS, 'sz_new_si_seal.png')
SEAL_MI = os.path.join(ASSETS, 'sz_new_mi_seal.png')
# 缺第二枚章时回退到既有深圳章，避免渲染失败
SEAL_FALLBACK = os.path.join(ASSETS, 'sz_seal.png')

PAGE_W, PAGE_H = 595.0, 842.0
X0, X1 = 28.0, 567.0
MAX_MONTHS = 24


def _s(v):
    return '' if v is None else str(v)


def parse_print_date(text):
    m = re.search(r'(\d{4})\D+(\d{1,2})\D+(\d{1,2})', _s(text))
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def doc_serial_of(p):
    raw = _s(p.get('doc_serial') or p.get('docSerial')).strip()
    if raw:
        return raw
    parsed = parse_print_date(p.get('print_date') or p.get('printDate'))
    if not parsed:
        return ''
    y, mo, d = parsed
    letter = _s(p.get('doc_serial_letter') or 'E').strip()[:1].upper() or 'E'
    return '%04d:%02d:%02d%s' % (y, mo, d, letter)


def seal_date_label(p):
    parsed = parse_print_date(p.get('print_date') or p.get('printDate'))
    if not parsed:
        return ''
    y, mo, d = parsed
    return '%d年%02d月%02d日' % (y, mo, d)


def years_months_of(p, n_rows):
    raw = p.get('years_months') or p.get('yearsMonths') or {}
    if not isinstance(raw, dict):
        raw = {}

    def pick(*keys):
        for k in keys:
            if raw.get(k) is not None and str(raw.get(k)).strip() != '':
                try:
                    return int(float(raw.get(k)))
                except Exception:
                    pass
            if p.get(k) is not None and str(p.get(k)).strip() != '':
                try:
                    return int(float(p.get(k)))
                except Exception:
                    pass
        return n_rows

    return {
        'pension': pick('pension', 'months_pension'),
        'medical': pick('medical', 'months_medical'),
        'maternity': pick('maternity', 'months_maternity'),
        'maternity_medical': pick('maternity_medical', 'months_maternity_medical'),
        'injury': pick('injury', 'months_injury'),
        'unemployment': pick('unemployment', 'months_unemployment'),
    }


def ensure_months(p):
    months = list(p.get('months') or [])
    out = []
    unit = _s(p.get('unit_code'))
    company = _s(p.get('company_name'))
    pb = p.get('pension_base', p.get('base_amount'))
    mb = p.get('medical_base', pb)
    ib = p.get('injury_base', pb)
    ub = p.get('unemp_base', pb)
    tier = _s(p.get('medical_tier') or '2') or '2'
    mat_type = _s(p.get('maternity_type') or '1') or '1'
    for r in months:
        if not isinstance(r, dict):
            continue
        year = _s(r.get('year') or '')
        month = _s(r.get('month') or '').zfill(2)[-2:]
        ym = _s(r.get('ym') or '')
        if not ym and year and month:
            ym = year + month
        if ym and (not year or not month) and len(ym) >= 6:
            year = ym[:4]
            month = ym[4:6]
        out.append(
            {
                'ym': ym,
                'year': year,
                'month': month,
                'unit_code': _s(r.get('unit_code') or unit),
                'unit_name': _s(r.get('unit_name') or company),
                'pension_base': r.get('pension_base', pb),
                'medical_base': r.get('medical_base', mb),
                'medical_tier': _s(r.get('medical_tier') or r.get('medical_type') or tier),
                'maternity_base': r.get('maternity_base', r.get('medical_base', mb)),
                'maternity_type': _s(r.get('maternity_type') or mat_type),
                'injury_base': r.get('injury_base', ib),
                'unemp_base': r.get('unemp_base', ub),
            }
        )
    if len(out) > MAX_MONTHS:
        out = out[-MAX_MONTHS:]
    return out


def unit_map(p, months):
    seen = {}
    order = []

    def add(code, name):
        code = _s(code).strip()
        if not code or code in seen:
            return
        seen[code] = True
        order.append({'unit_code': code, 'unit_name': _s(name).strip()})

    for item in p.get('unit_map') or []:
        if isinstance(item, dict):
            add(item.get('unit_code'), item.get('unit_name'))
    company = _s(p.get('company_name') or '')
    for r in months or []:
        if r:
            add(r.get('unit_code'), r.get('unit_name') or company)
    add(p.get('unit_code'), company)
    return order


def base_text(n):
    """官方清单缴费基数多为整数。"""
    try:
        x = float(n)
    except Exception:
        return '' if n in (None, '') else _s(n)
    if abs(x - round(x)) < 1e-9:
        return str(int(round(x)))
    return money(n)


def collect_blob(p, months, auth_code, years):
    parts = [
        '深圳市社会保险参保证明',
        '参保人姓名：有效证件号码：社保电脑号：',
        '（一）历年参保年限险种养老保险医疗保险生育保险生育医疗工伤保险失业保险累计月数',
        '（二）近两年参保缴费明细缴费时段单位编号缴费基数档次险种',
        '备注本证明可作为参保人参加社会保险的证明。',
        '网址：https://sipub.sz.gov.cn/vp/ 验真码有效期三个月。',
        '生育保险中的险种“1”为生育保险，“2”为生育医疗。',
        '医疗险种中的档次“1”为基本医疗保险一档，“2”为基本医疗保险二档。',
        '上述“缴费明细”表中带“*”标识为补缴，带“#”标识为补差，空行为断缴。',
        '居民养老保险、居民（含少儿/学生）医疗保险不在本清单。',
        '单位编号对应的单位名称：',
        '本服务由深圳市人力资源和社会保障局提供',
        '深圳市社会保险基金管理局深圳市医疗保障基金管理中心',
        '社保费缴纳清单证明专用章医疗与生育保险业务专用章',
        _s(p.get('name')),
        _s(p.get('id_number')),
        _s(p.get('computer_no')),
        _s(p.get('company_name')),
        _s(p.get('unit_code')),
        _s(auth_code),
        _s(p.get('print_date')),
        doc_serial_of(p),
        seal_date_label(p),
    ]
    for k, v in (years or {}).items():
        parts.append(str(v))
    for item in p.get('unit_map') or []:
        if isinstance(item, dict):
            parts.append(_s(item.get('unit_code')))
            parts.append(_s(item.get('unit_name')))
    for r in months:
        if r:
            parts.extend([_s(v) for v in r.values()])
    return ''.join(norm_text(x) for x in parts)


def draw_hline(page, y, x0=X0, x1=X1, width=0.5):
    page.draw_line(fitz.Point(x0, y), fitz.Point(x1, y), color=(0, 0, 0), width=width)


def draw_vline(page, x, y0, y1, width=0.5):
    page.draw_line(fitz.Point(x, y0), fitz.Point(x, y1), color=(0, 0, 0), width=width)


def draw_rect(page, x0, y0, x1, y1, width=0.6):
    page.draw_rect(fitz.Rect(x0, y0, x1, y1), color=(0, 0, 0), width=width)


def draw_seal_with_date(page, path, rect, date_text, font_path, fontname):
    if path and os.path.isfile(path):
        page.insert_image(rect, filename=path, keep_proportion=True)
    elif os.path.isfile(SEAL_FALLBACK):
        page.insert_image(rect, filename=SEAL_FALLBACK, keep_proportion=True)
    if not date_text:
        return
    # 叠印日期，落在五角星下方、专用章名上方
    cx = (rect.x0 + rect.x1) / 2.0
    size = 6.4
    tw = text_width(font_path, date_text, size)
    page.insert_text(
        (cx - tw / 2.0, rect.y0 + (rect.y1 - rect.y0) * 0.58),
        date_text,
        fontname=fontname,
        fontsize=size,
        color=(0.77, 0.19, 0.20),
    )


def render(payload, auth_code, qr_url, out_path):
    p = payload or {}
    months = ensure_months(p)
    mapping = unit_map(p, months)
    years = years_months_of(p, len(months))
    blob = collect_blob(p, months, auth_code, years) + '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:/-*.#（）'
    full_body = ensure_full_cjk_font()
    # 正文/表头/小节标题一律 Regular 宋体（Noto Serif CJK），与旧深圳及其它 sbdy 正式件一致；
    # 不用 Bold，避免看起来像黑体/系统无衬线。
    subset_body = make_subset_font(full_body, blob, prefix='sbdy_sz_new_b_')
    doc = None
    try:
        doc = fitz.open()
        # 行数多时略加长，避免备注被裁
        extra = max(0, (len(months) - 18) * 11.0) + max(0, (len(mapping) - 2) * 11.0)
        ph = max(PAGE_H, 842.0 + extra)
        page = doc.new_page(width=PAGE_W, height=ph)
        body_name, _title_name = register_fonts(page, subset_body, subset_body)

        title = '深圳市社会保险参保证明'
        tsize = 16.0
        tw = text_width(subset_body, title, tsize)
        page.insert_text(((PAGE_W - tw) / 2.0, 36.0), title, fontname=body_name, fontsize=tsize)

        serial = doc_serial_of(p)
        if serial:
            sw = text_width(subset_body, serial, 8.0)
            page.insert_text((X1 - sw, 22.0), serial, fontname=body_name, fontsize=8.0)

        info = '参保人姓名：%s　　有效证件号码：%s　　社保电脑号：%s' % (
            _s(p.get('name')),
            _s(p.get('id_number')),
            _s(p.get('computer_no')),
        )
        page.insert_text((X0, 54.0), info, fontname=body_name, fontsize=9.0)

        y = 68.0
        page.insert_text((X0, y), '（一）历年参保年限', fontname=body_name, fontsize=10.5)
        y += 6.0
        y1_h = 16.0
        y2_h = 16.0
        cols1 = [X0]
        widths1 = [62, 72, 72, 72, 72, 72, 117]
        # last col fills to X1
        acc = X0
        for i, w in enumerate(widths1):
            if i == len(widths1) - 1:
                acc = X1
            else:
                acc += w
            cols1.append(acc)
        draw_rect(page, X0, y, X1, y + y1_h + y2_h)
        draw_hline(page, y + y1_h)
        for x in cols1:
            draw_vline(page, x, y, y + y1_h + y2_h)
        labels1 = ['险种', '养老保险', '医疗保险', '生育保险', '生育医疗', '工伤保险', '失业保险']
        vals1 = [
            '累计月数',
            years.get('pension', 0),
            years.get('medical', 0),
            years.get('maternity', 0),
            years.get('maternity_medical', 0),
            years.get('injury', 0),
            years.get('unemployment', 0),
        ]
        for i, lab in enumerate(labels1):
            cell_box(page, subset_body, body_name, lab, cols1[i], cols1[i + 1], y, y + y1_h, size=8.0)
        for i, val in enumerate(vals1):
            cell_box(
                page, subset_body, body_name, _s(val), cols1[i], cols1[i + 1], y + y1_h, y + y1_h + y2_h, size=8.5
            )
        y = y + y1_h + y2_h + 16.0

        page.insert_text((X0, y), '（二）近两年参保缴费明细', fontname=body_name, fontsize=10.5)
        y += 6.0
        head1 = 16.0
        head2 = 16.0
        row_h = 11.2
        # 9 columns: 时段, 单位, 养老基数, 医疗基数, 档次, 生育基数, 险种, 工伤, 失业
        col_w = [56, 70, 62, 56, 32, 56, 32, 56]
        cols2 = [X0]
        acc = X0
        for w in col_w:
            acc += w
            cols2.append(acc)
        cols2.append(X1)
        n = max(1, len(months))
        table_h = head1 + head2 + row_h * n
        draw_rect(page, X0, y, X1, y + table_h)
        y_mid = y + head1
        y_data = y + head1 + head2
        draw_hline(page, y_mid, x0=cols2[2], x1=X1)
        draw_hline(page, y_data)
        for i in range(1, n):
            draw_hline(page, y_data + row_h * i)
        # group verticals from top; inner verticals from mid
        group_idx = (0, 1, 2, 3, 5, 7, 8, 9)
        inner_idx = (4, 6)
        for i in group_idx:
            draw_vline(page, cols2[i], y, y + table_h)
        for i in inner_idx:
            draw_vline(page, cols2[i], y_mid, y + table_h)

        cell_box(page, subset_body, body_name, '缴费时段', cols2[0], cols2[1], y, y_data, size=8.0)
        cell_box(page, subset_body, body_name, '单位编号', cols2[1], cols2[2], y, y_data, size=8.0)
        cell_box(page, subset_body, body_name, '养老保险', cols2[2], cols2[3], y, y_mid, size=8.0)
        cell_box(page, subset_body, body_name, '医疗保险', cols2[3], cols2[5], y, y_mid, size=8.0)
        cell_box(page, subset_body, body_name, '生育保险/生育医疗', cols2[5], cols2[7], y, y_mid, size=7.2)
        cell_box(page, subset_body, body_name, '工伤保险', cols2[7], cols2[8], y, y_mid, size=8.0)
        cell_box(page, subset_body, body_name, '失业保险', cols2[8], cols2[9], y, y_mid, size=8.0)
        subs = [
            (2, 3, '缴费基数'),
            (3, 4, '缴费基数'),
            (4, 5, '档次'),
            (5, 6, '缴费基数'),
            (6, 7, '险种'),
            (7, 8, '缴费基数'),
            (8, 9, '缴费基数'),
        ]
        for a, b, lab in subs:
            cell_box(page, subset_body, body_name, lab, cols2[a], cols2[b], y_mid, y_data, size=7.2)

        if not months:
            cell_box(page, subset_body, body_name, '', cols2[0], cols2[1], y_data, y_data + row_h, size=8.0)
        for i, r in enumerate(months):
            yy0 = y_data + row_h * i
            yy1 = yy0 + row_h
            vals = [
                r.get('ym') or '',
                r.get('unit_code') or '',
                base_text(r.get('pension_base')),
                base_text(r.get('medical_base')),
                r.get('medical_tier') or '',
                base_text(r.get('maternity_base')),
                r.get('maternity_type') or '',
                base_text(r.get('injury_base')),
                base_text(r.get('unemp_base')),
            ]
            for ci, val in enumerate(vals):
                cell_box(
                    page,
                    subset_body,
                    body_name,
                    val,
                    cols2[ci],
                    cols2[ci + 1],
                    yy0,
                    yy1,
                    size=7.2 if ci != 1 else 6.6,
                    min_size=5.2,
                )

        y = y + table_h + 16.0
        page.insert_text((X0, y), '备注：', fontname=body_name, fontsize=9.5)
        notes = [
            '1.本证明可作为参保人参加社会保险的证明。向相关部门提供，查验部门可通过登录网址：https://sipub.sz.gov.cn/vp/，输入下列验真码（%s）核查，验真码有效期三个月。'
            % (_s(auth_code)),
            '2.生育保险中的险种“1”为生育保险，“2”为生育医疗。',
            '3.医疗保险档次“1”为基本医疗保险一档，“2”为基本医疗保险二档，“4”为基本医疗保险三档，“5”为居民医疗保险，“6”为统筹医疗保险。',
            '4.上述“缴费明细”表中带“*”标识为补缴，带“#”标识为补差，空行为断缴。',
            '5.居民养老保险、居民（含少儿/学生）医疗保险不在本清单。',
            '6.单位编号对应的单位名称：',
        ]
        y += 4.0
        for line in notes:
            # 长行自动换行
            size = 7.4
            max_w = X1 - X0
            words = line
            # 按约 48 字切（中文）
            chunks = []
            buf = ''
            for ch in words:
                buf += ch
                if text_width(subset_body, buf, size) > max_w:
                    chunks.append(buf[:-1])
                    buf = ch
            if buf:
                chunks.append(buf)
            for chunk in chunks:
                y += 11.0
                page.insert_text((X0, y), chunk, fontname=body_name, fontsize=size)
        for item in mapping:
            y += 11.0
            line = '%s / %s' % (item.get('unit_code') or '', item.get('unit_name') or '')
            page.insert_text((X0 + 12, y), line, fontname=body_name, fontsize=7.4)

        # 双章靠右、略压在备注下方，对齐官方参保证明（不再页心居中）
        seal_size = 80.0
        seal_y = min(ph - 108.0, y + 8.0)
        date_lab = seal_date_label(p)
        gap = 22.0
        right_x = X1 - seal_size
        left_x = right_x - gap - seal_size
        draw_seal_with_date(
            page,
            SEAL_SI,
            fitz.Rect(left_x, seal_y, left_x + seal_size, seal_y + seal_size),
            date_lab,
            subset_body,
            body_name,
        )
        draw_seal_with_date(
            page,
            SEAL_MI,
            fitz.Rect(right_x, seal_y, right_x + seal_size, seal_y + seal_size),
            date_lab,
            subset_body,
            body_name,
        )

        foot = '本服务由深圳市人力资源和社会保障局提供'
        fw = text_width(subset_body, foot, 8.0)
        page.insert_text(
            ((PAGE_W - fw) / 2.0, ph - 22.0),
            foot,
            fontname=body_name,
            fontsize=8.0,
            color=(0.45, 0.45, 0.45),
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
        if subset_body:
            try:
                os.remove(subset_body)
            except Exception:
                pass


def selftest():
    """Check section titles sit on the table left edge and both seals are embedded."""
    payload = {
        'name': '林晓薇',
        'id_number': '440305199208156018',
        'computer_no': '089216473',
        'company_name': '深圳市易满星科技有限公司',
        'unit_code': '31327084',
        'print_date': '2026年09月01日',
        'doc_serial': '2026:09:01E',
        'years_months': {
            'pension': 113,
            'medical': 115,
            'maternity': 115,
            'maternity_medical': 0,
            'injury': 115,
            'unemployment': 115,
        },
        'months': [
            {
                'ym': '202409',
                'year': '2024',
                'month': '09',
                'unit_code': '31327084',
                'pension_base': 4492,
                'medical_base': 4492,
                'medical_tier': '2',
                'maternity_base': 4492,
                'maternity_type': '1',
                'injury_base': 4492,
                'unemp_base': 4492,
            }
        ],
    }
    fd, out_path = tempfile.mkstemp(suffix='.pdf', prefix='sbdy_sz_new_st_')
    os.close(fd)
    try:
        render(payload, '3359a909b3600273', '', out_path)
        doc = fitz.open(out_path)
        page = doc[0]
        hits = []
        for block in page.get_text('dict').get('blocks') or []:
            for line in block.get('lines') or []:
                text = ''.join(span.get('text') or '' for span in line.get('spans') or [])
                if '历年参保年限' in text or '近两年参保缴费明细' in text:
                    hits.append((text, line['bbox'][0]))
        doc.close()
        if len(hits) < 2:
            print('selftest missing section titles', hits, file=sys.stderr)
            return 1
        for text, x0 in hits:
            if abs(x0 - X0) > 2.5:
                print('selftest title not left-aligned', text, x0, file=sys.stderr)
                return 1
        doc = fitz.open(out_path)
        n_img = len(doc[0].get_images())
        doc.close()
        if n_img < 2:
            print('selftest expected 2 seals, got', n_img, file=sys.stderr)
            return 1
        print('selftest ok titles=%s seals=%s' % (len(hits), n_img))
        return 0
    finally:
        try:
            os.remove(out_path)
        except Exception:
            pass


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == '--selftest':
        return selftest()
    if len(sys.argv) < 3:
        print('usage: sbdy_sz_new_render_pdf.py <payload.json> <out.pdf>', file=sys.stderr)
        return 2
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)
    payload = data.get('payload') if isinstance(data, dict) and 'payload' in data else data
    render(
        payload or {},
        data.get('auth_code') or '',
        data.get('qr_url') or data.get('verify_url') or '',
        sys.argv[2],
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())
