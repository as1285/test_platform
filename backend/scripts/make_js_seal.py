#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成江苏省养老保险权益记录单红色电子印章（透明底），供 PDF / HTML 预览使用。

圆形红章：顶部弧「江苏省社会保险局」，中心五角星，底部「电子专用章」。
打印日期为动态文案（黑色），由渲染层叠加在印章中部，不写入本 PNG。
"""
from __future__ import print_function

import math
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
FRONTEND_IMG = os.path.join(HERE, '..', '..', 'frontend', 'public', 'img')
TEXT_REFERENCE_PNG = os.path.join(ASSETS, 'js_seal_text_reference.png')
ZJ_STYLE_SEAL_PNG = os.path.join(ASSETS, 'seal.png')
FONT_CANDIDATES = [
    os.path.join(ASSETS, 'NotoSerifCJKsc-Regular.otf'),
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSerifCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',
]


def _load_font(size):
    for path in FONT_CANDIDATES:
        if not os.path.isfile(path):
            continue
        try:
            return ImageFont.truetype(path, size=size, index=2 if path.endswith('.ttc') else 0)
        except Exception:
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def _star_pts(cx, cy, r, rot=-math.pi / 2):
    pts = []
    for i in range(10):
        ang = rot + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.38
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    return pts


def _make_zj_style_seal(out_path, size):
    """复用浙江章的外圈、五角星、底字与颜色，只替换顶部省份弧字。"""
    zj = Image.open(ZJ_STYLE_SEAL_PNG).convert('RGBA')
    w, h = zj.size
    cx = w / 2.0
    cy = h / 2.0
    src = zj.load()
    styled = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    dst = styled.load()

    # 浙江章是已栅格化的原章：保留外圈、中心星和「电子专用章」原始像素。
    for y in range(h):
        for x in range(w):
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            keep_ring = dist > min(w, h) * 0.447
            keep_star = w * 0.329 < x < w * 0.659 and h * 0.337 < y < h * 0.652
            keep_bottom = w * 0.16 < x < w * 0.84 and h * 0.71 < y < h * 0.93
            if keep_ring or keep_star or keep_bottom:
                dst[x, y] = src[x, y]

    if os.path.isfile(TEXT_REFERENCE_PNG):
        ref = Image.open(TEXT_REFERENCE_PNG).convert('RGBA')
        ring_box = zj.getchannel('A').getbbox() or (0, 0, w, h)
        rw = ring_box[2] - ring_box[0]
        rh = ring_box[3] - ring_box[1]
        alpha = ref.getchannel('A').resize((rw, rh), Image.LANCZOS)
        # 浙江 PDF 章使用纯朱红色。
        text_layer = Image.new('RGBA', (rw, rh), (255, 0, 0, 255))
        text_layer.putalpha(alpha)
        styled.alpha_composite(text_layer, (ring_box[0], ring_box[1]))

    target_size = max(64, int(size or w))
    if styled.size != (target_size, target_size):
        styled = styled.resize((target_size, target_size), Image.LANCZOS)
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    styled.save(out_path, 'PNG')
    return out_path


def make_js_seal(out_path, size=1024):
    if os.path.isfile(ZJ_STYLE_SEAL_PNG):
        return _make_zj_style_seal(out_path, size)

    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # 左侧原版样张为较亮的朱红色；避免使用偏暗的酒红色。
    red = (217, 81, 79, 255)
    cx = cy = size / 2.0
    r = size * 0.462
    ring_w = max(10, int(size * 0.026))
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=red, width=ring_w)

    # 原章五角星接近圆心；打印日期由 PDF 层横向压过章面。
    star_r = size * 0.154
    draw.polygon(_star_pts(cx, cy - size * 0.004, star_r), fill=red)

    # 原章中的弧字并非系统字体实时排版，而是印章图形的一部分。优先使用从
    # 用户提供原图中提取的透明文字蒙版，以保持字形、弧度和字距一致。
    used_reference = False
    if os.path.isfile(TEXT_REFERENCE_PNG):
        try:
            ref = Image.open(TEXT_REFERENCE_PNG).convert('RGBA')
            diameter = int(round(r * 2.0)) + 1
            # 参考蒙版本身就是目标显示尺寸附近的栅格字形；最近邻放大后再由
            # PDF 缩放一次，可避免两次 Lanczos 导致笔画发虚。
            alpha = ref.getchannel('A').resize((diameter, diameter), Image.NEAREST)
            text_layer = Image.new('RGBA', (diameter, diameter), red)
            text_layer.putalpha(alpha)
            img.alpha_composite(
                text_layer,
                (int(round(cx - r)), int(round(cy - r))),
            )
            used_reference = True
        except Exception:
            used_reference = False

    if not used_reference:
        # 无参考蒙版时的可重建兜底。
        ring = '江苏省社会保险局'
        font_ring = _load_font(int(size * 0.115))
        n = len(ring)
        start = math.radians(-160.0)
        end = math.radians(-20.0)
        radius_text = size * 0.365
        for i, ch in enumerate(ring):
            t = i / float(max(1, n - 1))
            theta = start + (end - start) * t
            rx = cx + radius_text * math.cos(theta)
            ry = cy + radius_text * math.sin(theta)
            side = int(size * 0.24)
            ch_img = Image.new('RGBA', (side, side), (0, 0, 0, 0))
            cd = ImageDraw.Draw(ch_img)
            cb = cd.textbbox((0, 0), ch, font=font_ring)
            tw = cb[2] - cb[0]
            th = cb[3] - cb[1]
            cd.text(
                ((side - tw) / 2.0 - cb[0], (side - th) / 2.0 - cb[1]),
                ch,
                font=font_ring,
                fill=red,
                stroke_width=4,
                stroke_fill=red,
            )
            rot = -(math.degrees(theta) + 90.0)
            ch_rot = ch_img.rotate(rot, expand=True, resample=Image.BICUBIC)
            img.alpha_composite(
                ch_rot,
                (int(rx - ch_rot.width / 2.0), int(ry - ch_rot.height / 2.0)),
            )

        bot = '电子专用章'
        font_bot = _load_font(int(size * 0.135))
        spacing = size * 0.015
        widths = []
        total_w = 0.0
        for ch in bot:
            b = draw.textbbox((0, 0), ch, font=font_bot)
            w = b[2] - b[0]
            widths.append((ch, w, b))
            total_w += w + spacing
        total_w -= spacing
        x = cx - total_w / 2.0
        y_bot = cy + size * 0.226
        for ch, w, b in widths:
            h = b[3] - b[1]
            draw.text(
                (x - b[0], y_bot - h / 2.0 - b[1]),
                ch,
                font=font_bot,
                fill=red,
                stroke_width=3,
                stroke_fill=red,
            )
            x += w + spacing

    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    img.save(out_path, 'PNG')
    return out_path


def main():
    out = os.path.join(ASSETS, 'js_seal.png')
    make_js_seal(out)
    print('wrote', out)
    try:
        os.makedirs(FRONTEND_IMG, exist_ok=True)
        import shutil

        dst = os.path.join(FRONTEND_IMG, 'sbdy_js_seal.png')
        shutil.copyfile(out, dst)
        print('wrote', dst)
    except Exception as e:
        print('copy to frontend failed:', e)


if __name__ == '__main__':
    main()
