#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按参考 show.pdf（PD4ML A4）坐标生成浙江省社保参保证明演示 PDF。

字体：正文 Noto Serif CJK SC Regular（贴近官方 NSimSun，不加描边）；
仅主标题与表头标签用 Bold。分节标题（如「参加社会保险基本情况」）与官方一致用常规字重。
字库按本文裁切（retain_gids）后绘制。

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
# 明细表列宽：年/月/单位编号/备注 + 养老·失业对称各 4 子列（对齐官方等宽）
# 宽：年28 月18 单位88 | 参保地50 基数45 个人46 状况46 | ×2 | 备注18
COL_X = [
    34.5,
    62.4,
    79.5,
    181.1,
    234.6,
    274.2,
    318.1,
    362.0,
    415.5,
    454.5,
    493.6,
    536.9,
    560.5,
]

# 字号层级（对齐官方 NSimSun 9.63pt 等宽正文）
SIZE_DOC_TITLE = 21.4
SIZE_LABEL = 9.63
SIZE_SUBLABEL = 9.63
SIZE_BODY = 9.63
SIZE_FOOTER = 8.56
SIZE_PAGE_NO = 10.7
SIZE_SECTION = 9.63

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
    s = '%.2f' % x
    return s.rstrip('0').rstrip('.') if '.' in s else s


def norm_text(text):
    if text is None:
        return ''
    return str(text)


def _strip_trailing_credit(company):
    s = str(company or '').strip()
    if not s:
        return ''
    prev = None
    while prev != s:
        prev = s
        s = re.sub(r'[（(]\s*[0-9A-Za-z]{15,20}\s*[）)]?\s*$', '', s).strip()
        s = re.sub(r'^(.*?)[（(]\s*\1\s*$', r'\1', s).strip()
    return s


def _extract_unit_code(raw, exclude=''):
    s = str(raw or '').strip()
    if not s:
        return ''
    exclude = str(exclude or '').strip()
    candidates = []
    seen = set()

    def push(c):
        if not c or c in seen:
            return
        if exclude and c == exclude:
            return
        seen.add(c)
        candidates.append(c)

    paren = re.search(r'[（(]\s*([0-9A-Za-z]{15,20})\s*[）)]', s)
    if paren:
        push(paren.group(1))
    for m in re.finditer(r'[0-9A-Za-z]{15,20}', s):
        push(m.group(0))
    if not candidates:
        return ''

    def score(c):
        if re.search(r'[A-Za-z]', c):
            return 100
        if re.match(r'^30\d{13,16}$', c):
            return 90
        if re.match(r'^\d{15,17}$', c):
            return 80
        if re.match(r'^\d{18}$', c):
            return 10
        return 50

    candidates.sort(key=score, reverse=True)
    return candidates[0]


def _extract_credit(company, exclude=''):
    return _extract_unit_code(company, exclude=exclude)


def _format_company_display(company, credit, exclude=''):
    company_raw = str(company or '').strip()
    credit_raw = str(credit or '').strip()
    code = (
        _extract_unit_code(company_raw, exclude=exclude)
        or _extract_unit_code(credit_raw, exclude=exclude)
        or ''
    )
    name = _strip_trailing_credit(company_raw)
    if not name and credit_raw:
        name = _strip_trailing_credit(credit_raw)
    if code and name and code in name:
        name = _strip_trailing_credit(name)
    if name and code:
        return '%s（%s）' % (name, code)
    return name or code or ''


def _dedupe_company_display(text, exclude=''):
    s = str(text or '').strip()
    if not s:
        return ''
    m = re.match(
        r'^(.*?)[（(]\s*\1\s*[（(]\s*([0-9A-Za-z]{15,20})\s*[）)]?\s*[）)]\s*$',
        s,
    )
    if m:
        return '%s（%s）' % (m.group(1).strip(), m.group(2))
    m = re.match(
        r'^(.*?)[（(]\s*([0-9A-Za-z]{15,20})\s*[）)]\s*[（(]\s*\2\s*[）)]\s*$',
        s,
    )
    if m:
        return '%s（%s）' % (m.group(1).strip(), m.group(2))
    return _format_company_display(s, '', exclude=exclude) or s


def company_display(p):
    exclude = str(p.get('id_number') or '')
    if p.get('company_display'):
        deduped = _dedupe_company_display(p['company_display'], exclude=exclude)
        if exclude and exclude in deduped:
            return _format_company_display(
                p.get('company_name') or deduped, p.get('credit_code') or '', exclude=exclude
            )
        return _format_company_display(deduped, '', exclude=exclude) or deduped
    return _format_company_display(
        p.get('company_name') or '', p.get('credit_code') or '', exclude=exclude
    )


ROWS_PER_PAGE = 24
MAX_MONTHS = 48


def resolve_window_months(p):
    """个人专用标题只允许 12 或 48，与实际缴费行数无关。"""
    raw = p.get('window_months')
    if raw is None:
        raw = p.get('windowMonths')
    try:
        n = int(raw)
    except (TypeError, ValueError):
        n = 0
    if n in (12, 1):
        return 12
    return 48


def ensure_months(p):
    months = list(p.get('months') or [])
    area = str(p.get('area') or '')
    exclude = str(p.get('id_number') or '')
    code = (
        _extract_unit_code(p.get('credit_code') or '', exclude=exclude)
        or _extract_unit_code(p.get('company_name') or '', exclude=exclude)
        or ''
    )
    base = p.get('base_amount')
    pension = p.get('pension_pay')
    unemp = p.get('unemployment_pay')
    out = []
    for r in months:
        if not isinstance(r, dict):
            continue
        unit = (
            _extract_unit_code(r.get('unit_code'), exclude=exclude)
            or _extract_unit_code(r.get('credit_code'), exclude=exclude)
            or _extract_unit_code(r.get('unit_name'), exclude=exclude)
            or code
        )
        out.append(
            {
                'year': str(r.get('year') or ''),
                'month': str(r.get('month') or '').zfill(2)[-2:],
                'unit_code': unit,
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
    img = qrcode.make(url or 'https://geshui.vip/', border=1, box_size=10)
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
    size=None,
    color=(0, 0, 0),
    align='center',
    pad=1.8,
    min_size=5.5,
    emph=False,
):
    """溢出框：缩字号使文本落入单元格；极端超宽则 textbox 限制在格内。
    emph=True：分节标题用极轻横向叠字微加粗（不用描边，避免糊成一团）。"""
    if size is None:
        size = SIZE_BODY
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
        # 0.15pt 微偏移叠字，比描边更自然
        if emph:
            page.insert_text(
                (x + 0.15, y), text, fontname=fontname, fontsize=s, color=color
            )
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
    if emph:
        # textbox 路径再叠一层极轻偏移
        page.insert_textbox(
            fitz.Rect(rect.x0 + 0.15, rect.y0, rect.x1 + 0.15, rect.y1),
            text,
            fontname=fontname,
            fontsize=max(min_size, s - 0.5),
            color=color,
            align=align_code,
        )


def cell_center(
    page, font_path, fontname, text, x0, x1, y0, y1, size=None, color=(0, 0, 0), emph=False
):
    if size is None:
        size = SIZE_BODY
    cell_box(
        page,
        font_path,
        fontname,
        text,
        x0,
        x1,
        y0,
        y1,
        size=size,
        color=color,
        align='center',
        emph=emph,
    )


def cell_twoline(page, font_path, fontname, line1, line2, x0, x1, y0, y1, size=None):
    """表头两行（缴费基数 / 数(元)），均在框内。"""
    if size is None:
        size = SIZE_SUBLABEL
    mid = (y0 + y1) / 2.0
    cell_box(page, font_path, fontname, line1, x0, x1, y0, mid + 0.5, size=size, align='center', min_size=6.0)
    cell_box(page, font_path, fontname, line2, x0, x1, mid - 0.5, y1, size=size, align='center', min_size=6.0)


# 表头/标签加粗用字
BOLD_LABEL_CHARS = (
    '姓名社会保障号证件类型证件号码性别'
    '险　　种参保状态参保单位养老保险工伤保险失业保险'
    # 分节标题「参加社会保险基本情况 / 缴费情况」官方为常规字重，不进 Bold 子集
    '年月单位编号备注参保地缴费基数(元)个人缴费状况'
    '共页第'
    '（盖章）'
)


def collect_text_blob(p, months, auth_code):
    n = len([m for m in (months or []) if m])
    page_n = max(1, (n + ROWS_PER_PAGE - 1) // ROWS_PER_PAGE) if n else 1
    parts = [
        '浙江省社会保险参保证明（个人专用）',
        '共%d页，第1页' % page_n,
        '出具证明前%d个月缴费情况' % resolve_window_months(p),
        # 续页标题「…（续）」依赖此字；漏进子集时第 2 页会显示方框/乱码
        '（续）',
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
    tsize = SIZE_DOC_TITLE
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
        fontsize=SIZE_PAGE_NO,
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
    """画缴费明细表（固定 ROWS_PER_PAGE 行），返回表底 y。

    表头合并规则（对齐官方样张）：
    - 年 / 月 / 单位编号 / 备注：纵向跨两行表头（无中间横线）
    - 养老保险 / 失业保险：横向各合并 4 列（顶行无内部竖线）
    - 子列竖线仅从表头第二行起向下画
    - 数据区不做任何纵向合并：年 / 月 / 单位编号 / 参保地逐行重复
    """
    y3_h1 = y3_0 + 14.7
    y3_h2 = y3_0 + 40.9
    row_h = 14.45
    n_body = ROWS_PER_PAGE
    y3_end = y3_h2 + row_h * n_body
    draw_rect(page, y3_0, y3_end)

    # 表头中间横线：只画在「养老保险 / 失业保险」子列区，不切断年/月/单位编号/备注
    page.draw_line(
        fitz.Point(COL_X[3], y3_h1),
        fitz.Point(COL_X[11], y3_h1),
        color=(0, 0, 0),
        width=0.6,
    )
    # 表头底线
    draw_hline(page, y3_h2)

    # 贯通全表高的竖线（合并表头的外框与年/月/单位编号/备注分隔）
    full_v = (0, 1, 2, 3, 7, 11, 12)
    for i in full_v:
        draw_vline(page, COL_X[i], y3_0, y3_end)
    # 养老/失业内部子列竖线：仅从第二行表头起，避免切断合并标题
    inner_v = (4, 5, 6, 8, 9, 10)
    for i in inner_v:
        draw_vline(page, COL_X[i], y3_h1, y3_end)

    cell_center(page, font_title, title_name, '年', COL_X[0], COL_X[1], y3_0, y3_h2, SIZE_LABEL)
    cell_center(page, font_title, title_name, '月', COL_X[1], COL_X[2], y3_0, y3_h2, SIZE_LABEL)
    cell_center(page, font_title, title_name, '单位编号', COL_X[2], COL_X[3], y3_0, y3_h2, SIZE_LABEL)
    cell_center(page, font_title, title_name, '养老保险', COL_X[3], COL_X[7], y3_0, y3_h1, SIZE_LABEL)
    cell_center(page, font_title, title_name, '失业保险', COL_X[7], COL_X[11], y3_0, y3_h1, SIZE_LABEL)
    cell_center(page, font_title, title_name, '备注', COL_X[11], COL_X[12], y3_0, y3_h2, SIZE_LABEL)
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
            cell_twoline(
                page, font_title, title_name, a, b, COL_X[ci], COL_X[ci + 1], y3_h1, y3_h2, SIZE_SUBLABEL
            )
        else:
            cell_center(
                page, font_title, title_name, a, COL_X[ci], COL_X[ci + 1], y3_h1, y3_h2, SIZE_SUBLABEL
            )

    # 数据区横线：每行边界贯通全部 12 列（官方样张无纵向合并）
    for i in range(1, n_body):
        y = y3_h2 + row_h * i
        for ci in range(12):
            page.draw_line(
                fitz.Point(COL_X[ci], y),
                fitz.Point(COL_X[ci + 1], y),
                color=(0, 0, 0),
                width=0.6,
            )

    for i in range(n_body):
        y0 = y3_h2 + row_h * i
        y1 = y0 + row_h
        r = month_chunk[i] if i < len(month_chunk) else None
        if not r:
            continue
        vals = [
            (0, r['year']),
            (1, r['month']),
            (2, r.get('unit_code') or ''),
            (3, r['area']),
            (4, money(r['pension_base'])),
            (5, money(r['pension_pay'])),
            (6, r['pension_status']),
            (7, r.get('unemp_area') or r.get('area') or ''),
            (8, money(r['unemp_base'])),
            (9, money(r['unemp_pay'])),
            (10, r['unemp_status']),
            (11, r.get('remark') or ''),
        ]
        for ci, val in vals:
            cell_box(
                page,
                font_body,
                body_name,
                val,
                COL_X[ci],
                COL_X[ci + 1],
                y0,
                y1,
                size=SIZE_BODY,
                align='center',
                min_size=5.5,
            )
    return y3_end


def draw_cert_footer(
    page, font_body, body_name, font_title, title_name, auth_code, verify_url, print_date, y_top
):
    auth = str(auth_code or '')
    validate = 'https://mapi.zjzwfw.gov.cn/web/mgop/gov-open/zj/2002199511/reserved/index.html#/validate'
    notes = [
        '备注：1.本证明已签署经国家电子政务外网浙江省电子认证注册的机构认证的电子印章，社保经办机构不再另行签章。',
        '2.本证明出具后3个月内可在“浙江政务服务网”进行网上验证，授权码：%s，' % auth,
        None,
        '3.本证明为打印时48个月内的参保情况，如需打印48个月以上的，请至人工窗口办理。',
        '4.本证明妥善保管，最终解释权由参保地社保经办机构所有。',
    ]
    ny = y_top + 18.8
    line_h = 13.375
    fs = SIZE_FOOTER
    for i, line in enumerate(notes):
        x = 34.3 if i == 0 else 60.0
        y = ny + i * line_h
        if i == 2:
            prefix = '验证平台：'
            page.insert_text((x, y), prefix, fontname=body_name, fontsize=fs, color=(0, 0, 0))
            px = x + text_width(font_body, prefix, fs)
            url_max = max(40.0, X1 - 8 - px - text_width(font_body, '。', fs))
            us = fit_fontsize(font_body, validate, url_max, fs, min_size=5.0)
            page.insert_text((px, y), validate, fontname=body_name, fontsize=us, color=(0, 0, 1))
            uw = min(text_width(font_body, validate, us), url_max)
            page.draw_line(
                fitz.Point(px, y + 1.2),
                fitz.Point(px + uw, y + 1.2),
                color=(0, 0, 1),
                width=0.5,
            )
            page.insert_link(
                {
                    'kind': fitz.LINK_URI,
                    'from': fitz.Rect(px, y - 10, px + uw, y + 2),
                    'uri': verify_url or validate,
                }
            )
            page.insert_text((px + uw, y), '。', fontname=body_name, fontsize=fs, color=(0, 0, 0))
        elif i == 0:
            lab = '备注：'
            page.insert_text((x, y), lab, fontname=title_name, fontsize=fs, color=(0, 0, 0))
            page.insert_text(
                (x + text_width(font_title, lab, fs), y),
                line[len(lab) :],
                fontname=body_name,
                fontsize=fs,
                color=(0, 0, 0),
            )
        else:
            page.insert_text((x, y), line, fontname=body_name, fontsize=fs, color=(0, 0, 0))

    stamp_y = ny + 5 * line_h + 8
    page.insert_text((492.2, stamp_y), '（盖章）', fontname=title_name, fontsize=fs, color=(0, 0, 0))
    pd = '打印时间：' + str(print_date or '')
    pdw = text_width(font_body, pd, fs)
    page.insert_text(
        ((PAGE_W - pdw) / 2.0, stamp_y + 10), pd, fontname=body_name, fontsize=fs, color=(0, 0, 0)
    )
    if os.path.isfile(SEAL_PNG):
        page.insert_image(
            fitz.Rect(432.5, stamp_y - 55, 555.5, stamp_y + 68),
            filename=SEAL_PNG,
            keep_proportion=True,
            overlay=True,
        )


LINIAN_TITLE = '浙江省职工基本养老保险历年参保证明'
LINIAN_COL_X = [34.5, 112.7, 165.1, 244.3, 319.7, 487.7, 560.5]
LINIAN_INFO_X1 = [34.5, 99.8, 164.0, 230.4, 371.6, 436.9, 501.6, 531.0, 560.5]
LINIAN_INFO_X2 = [34.5, 99.8, 164.0, 230.4, 371.6, 436.9, 560.5]
LINIAN_ROWS = 29
LINIAN_ROW_H = 14.45
LINIAN_TABLE_Y0 = 164.1
LINIAN_HEADER_Y1 = 190.6
LINIAN_TABLE_Y1 = 609.2
LINIAN_X0, LINIAN_X1 = 34.5, 560.5
# 官方 PD4ML 网格线宽约 0.535；外框/内线统一，避免叠线变粗
LINIAN_LINE_W = 0.535
LINIAN_VALIDATE = (
    'https://mapi.zjzwfw.gov.cn/web/mgop/gov-open/zj/2002199511/reserved/index.html#/validate'
)


def draw_linian_fill(page, y0, y1):
    page.draw_rect(
        fitz.Rect(34.3, y0, 560.2, y1), color=None, fill=(1, 1, 1), width=0
    )


def draw_linian_hline(page, y, x0=None, x1=None):
    page.draw_line(
        fitz.Point(LINIAN_X0 if x0 is None else x0, y),
        fitz.Point(LINIAN_X1 if x1 is None else x1, y),
        color=(0, 0, 0),
        width=LINIAN_LINE_W,
    )


def draw_linian_vline(page, x, y0, y1):
    page.draw_line(
        fitz.Point(x, y0),
        fitz.Point(x, y1),
        color=(0, 0, 0),
        width=LINIAN_LINE_W,
    )


def draw_linian_grid(page, page_idx):
    """整表一次填充 + 统一线宽描边，交界线只画一遍（对齐官方）。"""
    y_head0 = LINIAN_TABLE_Y0
    y_head1 = LINIAN_HEADER_Y1
    y_end = LINIAN_TABLE_Y1
    if page_idx == 1:
        y0, y1, y2, y3 = 120.8, 135.5, 149.9, 164.1
        draw_linian_fill(page, y0, y_end)
        # 外框
        draw_linian_hline(page, y0)
        draw_linian_hline(page, y_end)
        draw_linian_vline(page, LINIAN_X0, y0, y_end)
        draw_linian_vline(page, LINIAN_X1, y0, y_end)
        # 信息区横线
        draw_linian_hline(page, y1)
        draw_linian_hline(page, y2)
        draw_linian_hline(page, y3)
        # 信息区竖线（跳过左右外框）
        for x in LINIAN_INFO_X1[1:-1]:
            draw_linian_vline(page, x, y0, y1)
        for x in LINIAN_INFO_X2[1:-1]:
            draw_linian_vline(page, x, y1, y2)
    else:
        y_sec0, y_sec1 = 149.9, 164.1
        draw_linian_fill(page, y_sec0, y_end)
        draw_linian_hline(page, y_sec0)
        draw_linian_hline(page, y_end)
        draw_linian_vline(page, LINIAN_X0, y_sec0, y_end)
        draw_linian_vline(page, LINIAN_X1, y_sec0, y_end)
        draw_linian_hline(page, y_sec1)

    # 清单表头底线 + 数据行 + 列线
    draw_linian_hline(page, y_head1)
    for ri in range(1, LINIAN_ROWS):
        draw_linian_hline(page, y_head1 + ri * LINIAN_ROW_H)
    for x in LINIAN_COL_X[1:-1]:
        draw_linian_vline(page, x, y_head0, y_end)
    return y_head0, y_head1, y_end



def ensure_year_rows(p):
    rows = p.get('year_rows')
    if isinstance(rows, list) and rows:
        return rows
    # 兜底：从 months 按 年+单位+基数 聚合
    months = ensure_months(p)
    if not months:
        return []
    out = []
    cur = None
    for m in months:
        if not m:
            continue
        y = str(m.get('year') or '')
        mon = str(m.get('month') or '').zfill(2)
        area = str(m.get('area') or '')
        company = str(m.get('company_name') or '')
        base = money(m.get('pension_base') if m.get('pension_base') is not None else m.get('base_amount'))
        key = (area, y, company, base)
        ym = y + mon
        if cur and cur['_key'] == key:
            cur['range_end'] = ym
        else:
            if cur:
                out.append(cur)
            cur = {
                '_key': key,
                'area': area,
                'year': y,
                'range_start': ym,
                'range_end': ym,
                'base': base,
                'company_name': company,
                'remark': '',
            }
    if cur:
        out.append(cur)
    for r in out:
        r['period_range'] = '%s-%s' % (r['range_start'], r['range_end'])
        del r['_key']
    return out


def collect_linian_blob(p, year_rows, auth_code):
    parts = [
        LINIAN_TITLE,
        '共1页，第1页',
        '姓名社会保障号参保状态性别证件类型证件号码累计缴费',
        '历年缴费清单参保地年度缴费起止时间月缴费基数（元）参保单位名称备注',
        # 续页标题「历年缴费清单（续）」；漏字会导致第 2 页表头旁出现方框
        '（续）',
        '（盖章）打印时间：',
        '本证明已签署经国家电子政务外网浙江省电子认证注册的机构认证的电子印章，社保经办机构不再另行签章。',
        '本证明出具后3个月内可在“浙江政务服务网”进行网上验证，授权码：',
        '验证平台：',
        LINIAN_VALIDATE,
        '本证明妥善保管，最终解释权由参保地社保经办机构所有。',
        '本证明如有重复缴费，需在办理退休前做重复缴费清退，重新计算累计缴费年月。',
        '本证明未包含特殊情形补缴的记录，如需相关补缴记录证明请前往补缴地社保经办机构经办窗口开具。',
        str(p.get('name') or ''),
        str(p.get('id_number') or ''),
        str(p.get('id_type') or '居民身份证'),
        str(p.get('gender') or ''),
        str(p.get('status_pension') or p.get('insure_status') or ''),
        str(p.get('cumulative_text') or ''),
        str(p.get('print_date') or ''),
        str(auth_code or ''),
    ]
    for r in year_rows or []:
        parts.extend(
            [
                r.get('area') or '',
                r.get('year') or '',
                r.get('period_range') or '',
                str(r.get('base') if r.get('base') is not None else ''),
                r.get('company_name') or '',
                r.get('remark') or '',
            ]
        )
    return ''.join(norm_text(x) for x in parts)


def draw_linian_footer(page, font_body, body_name, font_title, title_name, auth_code, print_date):
    auth = str(auth_code or '')
    notes = [
        '备注：1.本证明已签署经国家电子政务外网浙江省电子认证注册的机构认证的电子印章，社保经办机构不再另行签章。',
        '2.本证明出具后3个月内可在“浙江政务服务网”进行网上验证，授权码：%s，' % auth,
        None,
        '3.本证明妥善保管，最终解释权由参保地社保经办机构所有。',
        '4.本证明如有重复缴费，需在办理退休前做重复缴费清退，重新计算累计缴费年月。',
        '5.本证明未包含特殊情形补缴的记录，如需相关补缴记录证明请前往补缴地社保经办机构经办窗口开具。',
    ]
    ny = 619.5 + 8.6
    line_h = 13.375
    fs = SIZE_FOOTER
    for i, line in enumerate(notes):
        x = 34.3 if i == 0 else 60.0
        y = ny + i * line_h
        if i == 2:
            prefix = '验证平台：'
            page.insert_text((x, y), prefix, fontname=body_name, fontsize=fs, color=(0, 0, 0))
            px = x + text_width(font_body, prefix, fs)
            url_max = max(40.0, X1 - 8 - px - text_width(font_body, '。', fs))
            us = fit_fontsize(font_body, LINIAN_VALIDATE, url_max, fs, min_size=5.0)
            page.insert_text((px, y), LINIAN_VALIDATE, fontname=body_name, fontsize=us, color=(0, 0, 1))
            uw = min(text_width(font_body, LINIAN_VALIDATE, us), url_max)
            page.draw_line(
                fitz.Point(px, y + 1.2),
                fitz.Point(px + uw, y + 1.2),
                color=(0, 0, 1),
                width=0.5,
            )
            page.insert_link(
                {
                    'kind': fitz.LINK_URI,
                    'from': fitz.Rect(px, y - 10, px + uw, y + 2),
                    'uri': LINIAN_VALIDATE,
                }
            )
            page.insert_text((px + uw, y), '。', fontname=body_name, fontsize=fs, color=(0, 0, 0))
        elif i == 0:
            lab = '备注：'
            page.insert_text((x, y), lab, fontname=title_name, fontsize=fs, color=(0, 0, 0))
            page.insert_text(
                (x + text_width(font_title, lab, fs), y),
                line[len(lab) :],
                fontname=body_name,
                fontsize=fs,
                color=(0, 0, 0),
            )
        else:
            page.insert_text((x, y), line, fontname=body_name, fontsize=fs, color=(0, 0, 0))

    stamp_y = 702.5
    page.insert_text((492.2, stamp_y), '（盖章）', fontname=title_name, fontsize=fs, color=(0, 0, 0))
    pd = '打印时间：' + str(print_date or '')
    pdw = text_width(font_body, pd, fs)
    page.insert_text(
        ((PAGE_W - pdw) / 2.0, 712.6), pd, fontname=body_name, fontsize=fs, color=(0, 0, 0)
    )
    if os.path.isfile(SEAL_PNG):
        page.insert_image(
            fitz.Rect(432.5, stamp_y - 55, 555.5, stamp_y + 68),
            filename=SEAL_PNG,
            keep_proportion=True,
            overlay=True,
        )


def render_linian(payload, auth_code, qr_url, out_path):
    """浙江省职工基本养老保险历年参保证明（对齐官方样张坐标）。"""
    p = payload or {}
    year_rows = ensure_year_rows(p)
    chunks = []
    i = 0
    while i < max(1, len(year_rows)):
        chunks.append(year_rows[i : i + LINIAN_ROWS])
        i += LINIAN_ROWS
    if not chunks:
        chunks = [[]]
    total_pages = len(chunks)

    blob = collect_linian_blob(p, year_rows, auth_code)
    full_body = ensure_full_cjk_font()
    full_title = ensure_bold_cjk_font()
    subset_body = make_subset_font(full_body, blob, prefix='sbdy_linian_body_')
    bold_blob = (
        LINIAN_TITLE
        + '姓名社会保障号参保状态性别证件类型证件号码累计缴费历年缴费清单（续）'
        + '参保地年度缴费起止时间月缴费基数（元）参保单位名称备注（盖章）'
        + '0123456789（）()-—'
        + ''.join('共%d页，第%d页' % (total_pages, n + 1) for n in range(total_pages))
    )
    subset_title = (
        make_subset_font(full_title, bold_blob, prefix='sbdy_linian_title_')
        if full_title != full_body
        else subset_body
    )
    font_body = subset_body
    font_title = subset_title
    qr_path = None
    doc = None

    try:
        doc = fitz.open()
        qr_path = os.path.join(tempfile.gettempdir(), 'sbdy_linian_qr_%s.png' % os.getpid())
        make_qr_png(qr_url, qr_path)

        for page_idx, chunk in enumerate(chunks, start=1):
            page = doc.new_page(width=PAGE_W, height=PAGE_H)
            body_name, title_name = register_fonts(page, font_body, font_title)

            tsize = SIZE_DOC_TITLE
            tw = text_width(font_title, LINIAN_TITLE, tsize)
            page.insert_text(
                ((PAGE_W - tw) / 2.0, 72.0),
                LINIAN_TITLE,
                fontname=title_name,
                fontsize=tsize,
                color=(0, 0, 0),
            )
            if qr_path and os.path.isfile(qr_path):
                page.insert_image(fitz.Rect(500.0, 17.0, 580.0, 97.0), filename=qr_path)
            page.insert_text(
                (496.5, 112.0),
                '共%d页，第%d页' % (total_pages, page_idx),
                fontname=body_name,
                fontsize=SIZE_PAGE_NO,
                color=(0, 0, 0),
            )

            if page_idx == 1:
                y0, y1, y2, y3 = 120.8, 135.5, 149.9, 164.1
                y_head0, y_head1, y_end = draw_linian_grid(page, page_idx)

                r1 = [
                    ('姓名', p.get('name') or ''),
                    ('社会保障号', p.get('id_number') or ''),
                    ('参保状态', p.get('status_pension') or p.get('insure_status') or ''),
                    ('性别', p.get('gender') or ''),
                ]
                for i, (lab, val) in enumerate(r1):
                    cell_center(
                        page, font_title, title_name, lab,
                        LINIAN_INFO_X1[i * 2], LINIAN_INFO_X1[i * 2 + 1], y0, y1, SIZE_LABEL
                    )
                    cell_center(
                        page, font_body, body_name, val,
                        LINIAN_INFO_X1[i * 2 + 1], LINIAN_INFO_X1[i * 2 + 2], y0, y1, SIZE_BODY
                    )
                r2 = [
                    ('证件类型', p.get('id_type') or '居民身份证'),
                    ('证件号码', p.get('id_number') or ''),
                    ('累计缴费', p.get('cumulative_text') or ''),
                ]
                for i, (lab, val) in enumerate(r2):
                    cell_center(
                        page, font_title, title_name, lab,
                        LINIAN_INFO_X2[i * 2], LINIAN_INFO_X2[i * 2 + 1], y1, y2, SIZE_LABEL
                    )
                    cell_center(
                        page, font_body, body_name, val,
                        LINIAN_INFO_X2[i * 2 + 1], LINIAN_INFO_X2[i * 2 + 2], y1, y2, SIZE_BODY
                    )
                cell_center(
                    page, font_body, body_name, '历年缴费清单', LINIAN_X0, LINIAN_X1, y2, y3, SIZE_SECTION
                )
            else:
                y_head0, y_head1, y_end = draw_linian_grid(page, page_idx)
                cell_center(
                    page,
                    font_body,
                    body_name,
                    '历年缴费清单（续）',
                    LINIAN_X0,
                    LINIAN_X1,
                    149.9,
                    164.1,
                    SIZE_SECTION,
                )

            cell_center(page, font_title, title_name, '参保地', LINIAN_COL_X[0], LINIAN_COL_X[1], y_head0, y_head1, SIZE_LABEL)
            cell_center(page, font_title, title_name, '年度', LINIAN_COL_X[1], LINIAN_COL_X[2], y_head0, y_head1, SIZE_LABEL)
            cell_center(page, font_title, title_name, '缴费起止时间', LINIAN_COL_X[2], LINIAN_COL_X[3], y_head0, y_head1, SIZE_LABEL)
            cell_twoline(page, font_title, title_name, '月缴费基数', '（元）', LINIAN_COL_X[3], LINIAN_COL_X[4], y_head0, y_head1)
            cell_center(page, font_title, title_name, '参保单位名称', LINIAN_COL_X[4], LINIAN_COL_X[5], y_head0, y_head1, SIZE_LABEL)
            cell_center(page, font_title, title_name, '备注', LINIAN_COL_X[5], LINIAN_COL_X[6], y_head0, y_head1, SIZE_LABEL)

            for ri in range(LINIAN_ROWS):
                y_a = y_head1 + ri * LINIAN_ROW_H
                y_b = y_a + LINIAN_ROW_H
                row = chunk[ri] if ri < len(chunk) else None
                if not row:
                    continue
                vals = [
                    row.get('area') or '',
                    str(row.get('year') or ''),
                    row.get('period_range') or '',
                    str(row.get('base') if row.get('base') is not None else ''),
                    row.get('company_name') or '',
                    row.get('remark') or '',
                ]
                for ci, val in enumerate(vals):
                    cell_box(
                        page,
                        font_body,
                        body_name,
                        val,
                        LINIAN_COL_X[ci],
                        LINIAN_COL_X[ci + 1],
                        y_a,
                        y_b,
                        size=SIZE_BODY,
                        align='center',
                        min_size=5.5,
                    )

            draw_linian_footer(
                page,
                font_body,
                body_name,
                font_title,
                title_name,
                auth_code,
                p.get('print_date') or '',
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


def render(payload, auth_code, qr_url, out_path):
    p = payload or {}
    cert_type = str(p.get('cert_type') or '').strip().lower()
    layout = str(p.get('layout') or '').strip().lower()
    if cert_type in ('linian', '历年') or layout in ('zj_linian_v1', 'linian'):
        return render_linian(p, auth_code, qr_url, out_path)
    if cert_type in ('sichuan', 'sc', '四川', '四川社保') or layout in (
        'sc_official_v1',
        'sichuan',
    ):
        from sbdy_render_sichuan import render_sichuan

        return render_sichuan(
            p,
            auth_code,
            qr_url,
            out_path,
            {
                'make_subset_font': make_subset_font,
                'ensure_full_cjk_font': ensure_full_cjk_font,
                'ensure_bold_cjk_font': ensure_bold_cjk_font,
                'make_qr_png': make_qr_png,
                'register_fonts': register_fonts,
                'text_width': text_width,
                'cell_box': cell_box,
                '_FONT_CACHE': _FONT_CACHE,
            },
        )

    months = ensure_months(p)
    month_chunks = chunk_months(months, ROWS_PER_PAGE)
    total_pages = len(month_chunks)
    period = p.get('period_label') or ''
    section_title = '出具证明前%d个月缴费情况（%s）' % (resolve_window_months(p), period)

    blob = collect_text_blob(p, months, auth_code)
    full_body = ensure_full_cjk_font()
    full_title = ensure_bold_cjk_font()
    subset_body = make_subset_font(full_body, blob, prefix='sbdy_body_')
    bold_blob = (
        '浙江省社会保险参保证明（个人专用）'
        + BOLD_LABEL_CHARS
        + section_title
        + '（续）'
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
                info_xs = [34.5, 66.1, 112.1, 164.6, 259.8, 305.3, 371.6, 416.5, 511.2, 542.3, 560.5]
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
                        SIZE_LABEL,
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
                        SIZE_BODY,
                    )
                # 官方样例：分节标题为常规字重（非 Bold），与正文同族
                cell_center(
                    page,
                    font_body,
                    body_name,
                    '参加社会保险基本情况',
                    X0,
                    X1,
                    y_t1_1,
                    y_t1_2,
                    SIZE_SECTION,
                )

                # —— 参保基本情况 ——
                y2 = [149.7, 164.4, 178.8, 193.3, 207.5]
                draw_rect(page, y2[0], y2[-1])
                for y in y2[1:-1]:
                    draw_hline(page, y)
                bx = [34.5, 167.8, 298.8, 429.9, 560.5]
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
                        # 第一行标签与险种名加粗；第二行仅左侧「参保状态」加粗
                        use_bold = ri == 0 or ci == 0
                        cell_center(
                            page,
                            font_title if use_bold else font_body,
                            title_name if use_bold else body_name,
                            val,
                            bx[ci],
                            bx[ci + 1],
                            y2[ri],
                            y2[ri + 1],
                            SIZE_LABEL if use_bold else SIZE_BODY,
                        )
                cell_center(
                    page, font_title, title_name, '参保单位', bx[0], bx[1], y2[2], y2[3], SIZE_LABEL
                )
                cell_box(
                    page,
                    font_body,
                    body_name,
                    company_display(p),
                    bx[1],
                    bx[4],
                    y2[2],
                    y2[3],
                    size=SIZE_BODY,
                    align='center',
                    pad=3.0,
                    min_size=6.0,
                )
                cell_center(
                    page,
                    font_body,
                    body_name,
                    section_title,
                    X0,
                    X1,
                    y2[3],
                    y2[4],
                    SIZE_SECTION,
                )
                y_table = 207.5
            else:
                # 续页：标题带与首页缴费段起始位置对齐
                draw_rect(page, 193.3, 207.5)
                cell_center(
                    page,
                    font_body,
                    body_name,
                    section_title + '（续）',
                    X0,
                    X1,
                    193.3,
                    207.5,
                    SIZE_SECTION,
                )
                y_table = 207.5

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
                font_title,
                title_name,
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
