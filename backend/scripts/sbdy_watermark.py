#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""给已渲染的社保参保证明演示 PDF 每页平铺「演示样例」水印。

用于未付费用户：生成的 PDF 带浅红斜向水印；付费（unlocked）用户不调用本脚本，
输出无水印版本。用法：python3 sbdy_watermark.py in.pdf out.pdf
水印文案可用环境变量 SBDY_WM_TEXT 覆盖（默认「演示样例」）。

字体：复用渲染脚本的 Noto Serif CJK SC，并按水印文案裁切子集，避免整套
字库嵌入把 PDF 撑到几十 MB。
"""
from __future__ import print_function

import os
import sys
import tempfile

import fitz
from fontTools.ttLib import TTCollection, TTFont
from fontTools import subset as ft_subset

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
NOTO_SC_OTF = os.path.join(ASSETS, 'NotoSerifCJKsc-Regular.otf')
NOTO_TTC = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc'
CACHE_OTF = os.path.join(tempfile.gettempdir(), 'sbdy_wm_NotoSerifCJKsc.otf')

WM_COLOR = (0.86, 0.16, 0.16)
WM_OPACITY = 0.13
WM_FONTSIZE = 34.0
WM_ANGLE = -28
STEP_X = 240.0
STEP_Y = 165.0


def resolve_cjk_font_path():
    """复用与渲染脚本一致的字体：优先预抽取的简体 Serif OTF。"""
    for path in (NOTO_SC_OTF, CACHE_OTF):
        if os.path.isfile(path) and os.path.getsize(path) > 1_000_000:
            return path
    if os.path.isfile(NOTO_TTC):
        ttc = TTCollection(NOTO_TTC)
        # Noto Serif CJK: JP=0 KR=1 SC=2 TC=3 HK=4
        face = ttc.fonts[2]
        face.flavor = None
        face.save(CACHE_OTF)
        return CACHE_OTF
    raise RuntimeError('missing CJK font for watermark')


def make_subset_font(src_path, text_blob):
    """按水印文案裁切 CJK 字库，仅保留所需字形，嵌入体积极小。"""
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
    fd, path = tempfile.mkstemp(suffix='.otf', prefix='sbdy_wm_sub_')
    os.close(fd)
    font.save(path)
    return path


def stamp_page(page, font, text):
    rect = page.rect
    tw = fitz.TextWriter(rect, color=WM_COLOR, opacity=WM_OPACITY)
    y = 40.0
    row = 0
    while y < rect.height + STEP_Y:
        x = -60.0 + (0.0 if row % 2 == 0 else STEP_X / 2.0)
        while x < rect.width + STEP_X:
            tw.append(fitz.Point(x, y), text, font=font, fontsize=WM_FONTSIZE)
            x += STEP_X
        y += STEP_Y
        row += 1
    pivot = fitz.Point(rect.width / 2.0, rect.height / 2.0)
    tw.write_text(page, morph=(pivot, fitz.Matrix(WM_ANGLE)), overlay=True)


def main():
    if len(sys.argv) < 3:
        print('usage: sbdy_watermark.py in.pdf out.pdf', file=sys.stderr)
        return 2
    in_pdf = sys.argv[1]
    out_pdf = sys.argv[2]
    text = os.environ.get('SBDY_WM_TEXT') or '演示样例'
    base_font = resolve_cjk_font_path()
    try:
        sub_font = make_subset_font(base_font, text)
    except Exception as e:  # 子集化失败则退回完整字体（体积大但功能可用）
        print('subset failed: %s' % e, file=sys.stderr)
        sub_font = base_font
    font = fitz.Font(fontfile=sub_font)
    doc = fitz.open(in_pdf)
    try:
        for page in doc:
            stamp_page(page, font, text)
        doc.save(out_pdf, deflate=True, garbage=4)
    finally:
        doc.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
