# -*- coding: utf-8 -*-
"""四川省社会保险个人参保证明（横向 A4，对齐官方样张）。"""
from __future__ import print_function

import os
import re
import tempfile

import fitz

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
SC_SEAL = os.path.join(ASSETS, 'sichuan_seal.png')

PAGE_W, PAGE_H = 841.0, 595.0
SC_X0, SC_X1 = 41.0, 800.0
SC_LINE_W = 0.75

# 明细表列：缴费月份|单位编号|类型|养基|养单|养个|失基|失单|失个|工基|工单|参保地
SC_COL = [41, 113, 210, 276, 329, 382, 435, 488, 542, 595, 650, 704, 800]
SC_SUM_COL = [41, 276, 542, 800]

SC_SUM_Y0 = 123.0
SC_SUM_ROW = 12.0
SC_SUM_ROWS = 4  # 表头 + 最多展示行由数据决定，外框按实际
SC_DETAIL_HEAD0 = 198.0
SC_DETAIL_HEAD1 = 210.0
SC_DETAIL_HEAD2 = 222.0
SC_DETAIL_ROW = 12.0
SC_DETAIL_MAX = 24

SIZE_TITLE = 14.0
SIZE_INFO = 9.0
SIZE_BODY = 8.0
SIZE_NOTE = 8.0


def money(n):
    try:
        x = float(n)
    except Exception:
        return ''
    if abs(x - round(x)) < 1e-9:
        return str(int(round(x)))
    s = '%.2f' % x
    return s.rstrip('0').rstrip('.') if '.' in s else s


def ensure_sc_months(p):
    rows = p.get('sc_months') or p.get('months')
    if not isinstance(rows, list):
        return []
    out = []
    for m in rows:
        if not m:
            continue
        if m.get('pay_month'):
            pm = str(m.get('pay_month'))
        else:
            y = str(m.get('year') or '')
            mon = str(m.get('month') or '').zfill(2)
            pm = y + mon if y else ''
        if not pm:
            continue
        base = m.get('pension_base')
        if base is None:
            base = m.get('base_amount')
        out.append(
            {
                'pay_month': pm,
                'unit_code': str(m.get('unit_code') or m.get('credit_code') or ''),
                'pension_type': str(m.get('pension_type') or '企业养老'),
                'pension_base': money(base) if base is not None and base != '' else '',
                'pension_unit': money(m.get('pension_unit'))
                if m.get('pension_unit') is not None
                else '',
                'pension_personal': money(
                    m.get('pension_personal')
                    if m.get('pension_personal') is not None
                    else m.get('pension_pay')
                )
                if (
                    m.get('pension_personal') is not None
                    or m.get('pension_pay') is not None
                )
                else '',
                'unemp_base': money(
                    m.get('unemp_base') if m.get('unemp_base') is not None else base
                )
                if (m.get('unemp_base') is not None or base is not None)
                else '',
                'unemp_unit': money(m.get('unemp_unit'))
                if m.get('unemp_unit') is not None
                else '',
                'unemp_personal': money(
                    m.get('unemp_personal')
                    if m.get('unemp_personal') is not None
                    else m.get('unemp_pay')
                )
                if (
                    m.get('unemp_personal') is not None or m.get('unemp_pay') is not None
                )
                else '',
                'injury_base': money(
                    m.get('injury_base') if m.get('injury_base') is not None else base
                )
                if (m.get('injury_base') is not None or base is not None)
                else '',
                'injury_unit': money(m.get('injury_unit'))
                if m.get('injury_unit') is not None
                else '',
                'area': str(m.get('area') or ''),
            }
        )
    return out


def ensure_summary_rows(p):
    rows = p.get('summary_rows')
    if isinstance(rows, list) and rows:
        out = []
        for r in rows:
            if not r:
                continue
            out.append(
                {
                    'insure_type': str(r.get('insure_type') or r.get('name') or ''),
                    'status': str(r.get('status') or ''),
                    'months': str(r.get('months') if r.get('months') is not None else ''),
                }
            )
        if out:
            return out
    # 兜底：用状态字段 + 明细月数
    n = len(ensure_sc_months(p))
    st_p = str(p.get('status_pension') or '参保缴费')
    st_u = str(p.get('status_unemployment') or st_p)
    st_i = str(p.get('status_injury') or p.get('status_medical') or st_p)
    return [
        {'insure_type': '企业职工基本养老保险', 'status': st_p, 'months': str(n or '')},
        {'insure_type': '失业保险', 'status': st_u, 'months': str(n or '')},
        {'insure_type': '工伤保险', 'status': st_i, 'months': str(n or '')},
    ]


def company_map_text(p, months):
    raw = p.get('unit_name_map') or p.get('company_map')
    parts = []
    if isinstance(raw, dict) and raw:
        for k in sorted(raw.keys(), key=str):
            parts.append('%s: %s' % (k, raw[k]))
    elif isinstance(raw, list):
        for it in raw:
            if not it:
                continue
            code = it.get('unit_code') or it.get('code') or ''
            name = it.get('company_name') or it.get('name') or ''
            if code or name:
                parts.append('%s: %s' % (code, name))
    if parts:
        return ', '.join(parts)
    # 从明细 + segments 推断
    seen = {}
    for m in months or []:
        code = str(m.get('unit_code') or '')
        if code and code not in seen:
            seen[code] = ''
    for seg in p.get('segments') or []:
        code = str(seg.get('credit_code') or seg.get('unit_code') or '')
        name = str(seg.get('company_name') or '')
        if code:
            seen[code] = name or seen.get(code) or ''
    return ', '.join('%s: %s' % (k, v) for k, v in seen.items() if k)


def period_cn_label(p, months):
    lab = str(p.get('detail_period_label') or '').strip()
    if lab:
        return lab
    if months:
        a = months[0].get('pay_month') or ''
        b = months[-1].get('pay_month') or a
        if len(a) == 6 and len(b) == 6:
            return '%s年%s月至%s年%s月' % (a[:4], a[4:], b[:4], b[4:])
    return str(p.get('period_label') or '')


def validity_cn(p):
    v = str(p.get('verify_valid_until') or '').strip()
    if v:
        return v
    # 从打印时间推 3 个月
    pd = str(p.get('print_date') or '')
    m = re.search(r'(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日', pd)
    if not m:
        return ''
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    mo += 3
    while mo > 12:
        mo -= 12
        y += 1
    return '%d 年 %02d 月 %02d 日' % (y, mo, d)


# 官方查询专用章：PDF 用户空间 Rect [693.5 443.5 806.5 556.5]（原点在左下）
# PyMuPDF 原点在左上，换算为 y = 595 - pdf_y
SC_SEAL_RECT = fitz.Rect(693.5, 38.5, 806.5, 151.5)


def insert_seal_multiply(page, filename, rect=None):
    """盖查询专用章：坐标对齐官方 Annot，叠底用 Multiply，避免白底挡住表格。"""
    if not filename or not os.path.isfile(filename):
        return
    box = rect or SC_SEAL_RECT
    page.insert_image(box, filename=filename, keep_proportion=True, overlay=True)
    doc = page.parent
    gs_xref = doc.get_new_xref()
    doc.update_object(gs_xref, '<< /Type /ExtGState /BM /Multiply >>')
    res = doc.xref_get_key(page.xref, 'Resources')
    res_xref = page.xref
    res_key_prefix = 'Resources/'
    if res and res[0] == 'xref':
        try:
            res_xref = int(str(res[1]).split()[0])
            res_key_prefix = ''
        except Exception:
            res_xref = page.xref
            res_key_prefix = 'Resources/'
    doc.xref_set_key(res_xref, res_key_prefix + 'ExtGState', '<< /GSmul %d 0 R >>' % gs_xref)
    contents = page.get_contents() or []
    if not contents:
        return
    target = contents[-1]
    data = doc.xref_stream(target) or b''
    if b'/GSmul gs' in data:
        return
    # 只包住最后一次 Do（刚插入的章），避免整页被 Multiply
    do = data.rfind(b'Do')
    q = data.rfind(b'q', 0, do if do >= 0 else len(data))
    if q >= 0:
        j = q + 1
        if j < len(data) and data[j:j + 1] in (b'\n', b'\r', b' '):
            j += 1
        data = data[:j] + b'/GSmul gs\n' + data[j:]
    else:
        data = b'q\n/GSmul gs\n' + data + b'\nQ\n'
    doc.update_stream(target, data)


def draw_h(page, y, x0=SC_X0, x1=SC_X1, w=SC_LINE_W):
    page.draw_line(fitz.Point(x0, y), fitz.Point(x1, y), color=(0, 0, 0), width=w)


def draw_v(page, x, y0, y1, w=SC_LINE_W):
    page.draw_line(fitz.Point(x, y0), fitz.Point(x, y1), color=(0, 0, 0), width=w)


def cell(page, font_path, fontname, text, x0, x1, y0, y1, size, helpers, align='center'):
    helpers['cell_box'](
        page,
        font_path,
        fontname,
        text,
        x0,
        x1,
        y0,
        y1,
        size=size,
        align=align,
        min_size=5.5,
        pad=1.2,
    )


def render_sichuan(payload, auth_code, qr_url, out_path, helpers):
    """helpers: dict with make_subset_font, ensure_full_cjk_font, ensure_bold_cjk_font,
    make_qr_png, register_fonts, text_width, cell_box, _FONT_CACHE"""
    p = payload or {}
    months = ensure_sc_months(p)
    summary = ensure_summary_rows(p)
    period_lab = period_cn_label(p, months)
    cmap = company_map_text(p, months)
    verify_code = str(p.get('verify_code') or auth_code or '')
    valid_until = validity_cn(p)
    print_date = str(p.get('print_date') or '')

    blob_parts = [
        '四川省社会保险个人参保证明',
        '参保人姓名：性别：社会保障号码：',
        '（一）历年参保基本情况险种当前缴费状态累计月数(个)',
        '（二）的参保缴费明细单位: 元',
        '缴费月份参保单位编号养老保险失业保险工伤保险参保地',
        '类型缴费基数单位缴纳个人缴纳',
        '打印时间：说明：',
        '本证明采用电子验证方式，不再加盖红色公章。如需验证，请通过以下两种方式办理：',
        '①电脑端：进入“四川人社在线公共服务平台“主页，点击“参保证明验证“，登录后输入验证码',
        '进行验证。验证码的有效期至',
        '②手机端：登录“四川人社“APP，扫描首页左上角的二维码进行验证。二维码的有效期至',
        '3. 该表(一)历年参保基本情况中的“累计月数”不含视同缴费月数；若存在视同缴费月数或重复缴费月数情形的，以办理退休手续时核定的月数为准。',
        '4. 该表(二)的参保缴费明细，显示的是所选择时段的实缴到账明细，不含异地转入的基本养老保险缴费信息，未实缴到账的显示为空。',
        '5. 2024年1月1日起，由税务部门征收社会保险费，缴费记录可能存在滞后。',
        '表中“单位编号”对应的单位名称为：',
        str(p.get('name') or ''),
        str(p.get('gender') or ''),
        str(p.get('id_number') or ''),
        period_lab,
        cmap,
        verify_code,
        valid_until,
        print_date,
        '企业养老成都市高新区双流区',
    ]
    for r in summary:
        blob_parts.extend([r['insure_type'], r['status'], r['months']])
    for m in months:
        blob_parts.extend(
            [
                m['pay_month'],
                m['unit_code'],
                m['pension_type'],
                m['pension_base'],
                m['pension_unit'],
                m['pension_personal'],
                m['unemp_base'],
                m['unemp_unit'],
                m['unemp_personal'],
                m['injury_base'],
                m['injury_unit'],
                m['area'],
            ]
        )
    blob = ''.join(blob_parts)

    full_body = helpers['ensure_full_cjk_font']()
    # 官方全文 STSong-Light（常规字重），表头也不用 Bold
    subset_body = helpers['make_subset_font'](full_body, blob, prefix='sbdy_sc_body_')
    font_body = subset_body
    font_title = subset_body
    qr_path = None
    doc = None

    try:
        doc = fitz.open()
        qr_path = os.path.join(tempfile.gettempdir(), 'sbdy_sc_qr_%s.png' % os.getpid())
        helpers['make_qr_png'](qr_url, qr_path)

        # ---- page 1 ----
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        body_name, title_name = helpers['register_fonts'](page, font_body, font_title)

        if qr_path and os.path.isfile(qr_path):
            page.insert_image(fitz.Rect(76.0, 14.0, 136.0, 74.0), filename=qr_path)

        title = '四川省社会保险个人参保证明'
        tw = helpers['text_width'](font_body, title, SIZE_TITLE)
        page.insert_text(
            ((PAGE_W - tw) / 2.0, 82.0),
            title,
            fontname=body_name,
            fontsize=SIZE_TITLE,
            color=(0, 0, 0),
        )

        info = '参保人姓名：%s' % (p.get('name') or '')
        page.insert_text((171.0, 99.0), info, fontname=body_name, fontsize=SIZE_INFO, color=(0, 0, 0))
        page.insert_text(
            (444.0, 99.0),
            '性别：%s' % (p.get('gender') or ''),
            fontname=body_name,
            fontsize=SIZE_INFO,
            color=(0, 0, 0),
        )
        page.insert_text(
            (594.0, 99.0),
            '社会保障号码：%s' % (p.get('id_number') or ''),
            fontname=body_name,
            fontsize=SIZE_INFO,
            color=(0, 0, 0),
        )

        sec1 = '（一）历年参保基本情况'
        s1w = helpers['text_width'](font_body, sec1, SIZE_INFO)
        page.insert_text(
            ((PAGE_W - s1w) / 2.0, 116.0),
            sec1,
            fontname=body_name,
            fontsize=SIZE_INFO,
            color=(0, 0, 0),
        )

        # summary table
        n_sum = max(1, len(summary))
        sum_y0 = SC_SUM_Y0
        sum_y1 = sum_y0 + SC_SUM_ROW
        sum_end = sum_y1 + n_sum * SC_SUM_ROW
        page.draw_rect(
            fitz.Rect(SC_X0, sum_y0, SC_X1, sum_end),
            color=None,
            fill=(1, 1, 1),
            width=0,
        )
        draw_h(page, sum_y0)
        draw_h(page, sum_end)
        draw_v(page, SC_X0, sum_y0, sum_end)
        draw_v(page, SC_X1, sum_y0, sum_end)
        draw_h(page, sum_y1)
        for i in range(1, n_sum):
            draw_h(page, sum_y1 + i * SC_SUM_ROW)
        for x in SC_SUM_COL[1:-1]:
            draw_v(page, x, sum_y0, sum_end)

        cell(
            page, font_body, body_name, '险种',
            SC_SUM_COL[0], SC_SUM_COL[1], sum_y0, sum_y1, SIZE_INFO, helpers
        )
        cell(
            page, font_body, body_name, '当前缴费状态',
            SC_SUM_COL[1], SC_SUM_COL[2], sum_y0, sum_y1, SIZE_INFO, helpers
        )
        cell(
            page, font_body, body_name, '累计月数(个)',
            SC_SUM_COL[2], SC_SUM_COL[3], sum_y0, sum_y1, SIZE_INFO, helpers
        )
        for i, r in enumerate(summary):
            ya = sum_y1 + i * SC_SUM_ROW
            yb = ya + SC_SUM_ROW
            cell(page, font_body, body_name, r['insure_type'], SC_SUM_COL[0], SC_SUM_COL[1], ya, yb, SIZE_INFO, helpers)
            cell(page, font_body, body_name, r['status'], SC_SUM_COL[1], SC_SUM_COL[2], ya, yb, SIZE_INFO, helpers)
            cell(page, font_body, body_name, r['months'], SC_SUM_COL[2], SC_SUM_COL[3], ya, yb, SIZE_INFO, helpers)

        # 明细表顶边必须在第二节标题之下，避免表顶线/白底遮挡标题与「单位: 元」
        # 官方样张：汇总表底≈186，标题夹在约 186–198，明细表顶=198
        sec2_gap = 14.0
        y0 = max(SC_DETAIL_HEAD0, sum_end + sec2_gap)
        y1 = y0 + (SC_DETAIL_HEAD1 - SC_DETAIL_HEAD0)
        y2 = y0 + (SC_DETAIL_HEAD2 - SC_DETAIL_HEAD0)
        sec2_baseline = y0 - 4.0
        sec2 = '（二）%s的参保缴费明细' % period_lab
        s2w = helpers['text_width'](font_body, sec2, SIZE_INFO)

        n_rows = max(len(months), 1)
        if n_rows > SC_DETAIL_MAX:
            n_rows = SC_DETAIL_MAX
            months = months[:SC_DETAIL_MAX]
        y_end = y2 + n_rows * SC_DETAIL_ROW

        page.draw_rect(fitz.Rect(SC_X0, y0, SC_X1, y_end), color=None, fill=(1, 1, 1), width=0)
        # 标题在白底之后绘制，确保不被遮挡
        page.insert_text(
            ((PAGE_W - s2w) / 2.0, sec2_baseline),
            sec2,
            fontname=body_name,
            fontsize=SIZE_INFO,
            color=(0, 0, 0),
        )
        page.insert_text(
            (709.0, sec2_baseline),
            '单位: 元',
            fontname=body_name,
            fontsize=SIZE_INFO,
            color=(0, 0, 0),
        )
        draw_h(page, y0)
        # 中间横线只穿越三大险种子列，不切开「缴费月份 / 单位编号 / 参保地」合并格
        draw_h(page, y1, x0=SC_COL[2], x1=SC_COL[11])
        draw_h(page, y2)
        draw_h(page, y_end)
        draw_v(page, SC_X0, y0, y_end)
        draw_v(page, SC_X1, y0, y_end)
        for ri in range(1, n_rows):
            draw_h(page, y2 + ri * SC_DETAIL_ROW)

        # 顶栏大组竖线：月|编号|养老|失业|工伤|参保地；子列竖线从中间横线起
        major_x = [SC_COL[1], SC_COL[2], SC_COL[6], SC_COL[9], SC_COL[11]]
        for x in major_x:
            draw_v(page, x, y0, y_end)
        sub_x = [SC_COL[3], SC_COL[4], SC_COL[5], SC_COL[7], SC_COL[8], SC_COL[10]]
        for x in sub_x:
            draw_v(page, x, y1, y_end)

        # 合并表头：缴费月份 / 单位编号 / 参保地 跨两行；三大险种跨子列
        cell(page, font_body, body_name, '缴费月份', SC_COL[0], SC_COL[1], y0, y2, SIZE_BODY, helpers)
        cell(page, font_body, body_name, '参保单位编号', SC_COL[1], SC_COL[2], y0, y2, SIZE_BODY, helpers)
        cell(page, font_body, body_name, '养老保险', SC_COL[2], SC_COL[6], y0, y1, SIZE_BODY, helpers)
        cell(page, font_body, body_name, '失业保险', SC_COL[6], SC_COL[9], y0, y1, SIZE_BODY, helpers)
        cell(page, font_body, body_name, '工伤保险', SC_COL[9], SC_COL[11], y0, y1, SIZE_BODY, helpers)
        cell(page, font_body, body_name, '参保地', SC_COL[11], SC_COL[12], y0, y2, SIZE_BODY, helpers)

        sub = [
            (2, '类型'),
            (3, '缴费基数'),
            (4, '单位缴纳'),
            (5, '个人缴纳'),
            (6, '缴费基数'),
            (7, '单位缴纳'),
            (8, '个人缴纳'),
            (9, '缴费基数'),
            (10, '单位缴纳'),
        ]
        for ci, lab in sub:
            cell(page, font_body, body_name, lab, SC_COL[ci], SC_COL[ci + 1], y1, y2, SIZE_BODY, helpers)

        for ri, m in enumerate(months):
            ya = y2 + ri * SC_DETAIL_ROW
            yb = ya + SC_DETAIL_ROW
            vals = [
                m['pay_month'],
                m['unit_code'],
                m['pension_type'],
                m['pension_base'],
                m['pension_unit'],
                m['pension_personal'],
                m['unemp_base'],
                m['unemp_unit'],
                m['unemp_personal'],
                m['injury_base'],
                m['injury_unit'],
                m['area'],
            ]
            for ci, val in enumerate(vals):
                cell(
                    page, font_body, body_name, val,
                    SC_COL[ci], SC_COL[ci + 1], ya, yb, SIZE_BODY, helpers
                )

        # 打印时间 + 说明1
        page.insert_text(
            (650.0, y_end + 14.0),
            '打印时间：' + print_date,
            fontname=body_name,
            fontsize=SIZE_NOTE,
            color=(0, 0, 0),
        )
        note1 = '说明：1. 表中“单位编号”对应的单位名称为：%s。' % (cmap or '—')
        page.insert_text(
            (89.0, min(y_end + 26.0, 560.0)),
            note1[:120],
            fontname=body_name,
            fontsize=SIZE_NOTE,
            color=(0, 0, 0),
        )
        if len(note1) > 120:
            page.insert_text(
                (113.0, min(y_end + 38.0, 575.0)),
                note1[120:240],
                fontname=body_name,
                fontsize=SIZE_NOTE,
                color=(0, 0, 0),
            )

        # 表格画完后再盖章，避免白底/表线切掉下半枚章
        insert_seal_multiply(page, SC_SEAL)

        # ---- page 2 notes + 查询专用章 ----
        page2 = doc.new_page(width=PAGE_W, height=PAGE_H)
        body_name2, _title2 = helpers['register_fonts'](page2, font_body, font_title)
        notes = [
            '2. 本证明采用电子验证方式，不再加盖红色公章。如需验证，请通过以下两种方式办理：',
            '①电脑端：进入“四川人社在线公共服务平台“主页，点击“参保证明验证“，登录后输入验证码%s进行验证。验证码的有效期至%s。'
            % (verify_code, valid_until or '—'),
            '②手机端：登录“四川人社“APP，扫描首页左上角的二维码进行验证。二维码的有效期至%s。'
            % (valid_until or '—'),
            '3. 该表(一)历年参保基本情况中的“累计月数”不含视同缴费月数；若存在视同缴费月数或重复缴费月数情形的，以办理退休手续时核定的月数为准。',
            '4. 该表(二)%s的参保缴费明细，显示的是所选择时段的实缴到账明细，不含异地转入的基本养老保险缴费信息，未实缴到账的显示为空。'
            % period_lab,
            '5. 2024年1月1日起，由税务部门征收社会保险费，缴费记录可能存在滞后。',
        ]
        y = 28.0
        for line in notes:
            # 左侧留白给右下角章，正文不超过约 560
            max_w = 560.0
            while line:
                if helpers['text_width'](font_body, line, SIZE_NOTE) <= max_w:
                    page2.insert_text((113.0, y), line, fontname=body_name2, fontsize=SIZE_NOTE, color=(0, 0, 0))
                    y += 14.0
                    break
                cut = len(line)
                while cut > 8 and helpers['text_width'](font_body, line[:cut], SIZE_NOTE) > max_w:
                    cut -= 1
                page2.insert_text(
                    (113.0, y), line[:cut], fontname=body_name2, fontsize=SIZE_NOTE, color=(0, 0, 0)
                )
                line = line[cut:]
                y += 14.0
            y += 2.0

        # 说明页查询专用章：与第 1 页同一官方坐标
        insert_seal_multiply(page2, SC_SEAL)

        doc.save(out_path, deflate=True, garbage=4)
        doc.close()
        doc = None
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass
        helpers['_FONT_CACHE'].clear()
        for path in (qr_path, subset_body):
            if path:
                try:
                    os.remove(path)
                except Exception:
                    pass
