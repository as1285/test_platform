#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从运营提供的真实样张裁出湖北省参保证明章（透明底）。

章面文字：湖北省城镇企业职工社会保险 / 参保证明章（来自样张，非矢量重绘）。
优先使用 assets/sbdy/wh_seal_source.png（第二张参考图裁切源）；
若不存在则回退到仓库内已裁好的 wh_seal_ref.png。
输出：assets/sbdy/wh_seal.png
"""
from __future__ import print_function

import math
import os
import sys

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
SOURCE_CANDIDATES = [
    os.path.join(ASSETS, 'wh_seal_source.png'),
    os.path.join(ASSETS, 'wh_seal_ref.png'),
]


def _is_seal_ink(r, g, b):
    """只保留朱红印泥；灰白残字、扫描噪点一律去掉。"""
    if r < 118:
        return False
    if r <= g + 28 or r <= b + 28:
        return False
    # 排除接近灰白的“脏点”（非印泥）
    if min(g, b) > 170 and (r - min(g, b)) < 55:
        return False
    if abs(g - b) < 25 and g > 140 and (r - g) < 40:
        return False
    return True


def _ink_alpha(r, g, b):
    strength = (r - max(g, b)) + max(0, r - 150) * 0.35
    return max(0, min(255, int(strength * 3.2)))


def _extract_seal(im_rgb):
    im = im_rgb.convert('RGB')
    w, h = im.size
    px = im.load()
    red = []
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if _is_seal_ink(r, g, b):
                red.append((x, y))
    if len(red) < 80:
        raise RuntimeError('source image has no red seal pixels')
    xs = [p[0] for p in red]
    ys = [p[1] for p in red]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    cx0 = (minx + maxx) / 2.0
    cy0 = (miny + maxy) / 2.0
    half = max(maxx - minx, maxy - miny) / 2.0 + 2
    minx = int(max(0, cx0 - half))
    maxx = int(min(w - 1, cx0 + half))
    miny = int(max(0, cy0 - half))
    maxy = int(min(h - 1, cy0 + half))
    crop = im.crop((minx, miny, maxx + 1, maxy + 1)).convert('RGBA')
    cw, ch = crop.size
    cp = crop.load()
    for y in range(ch):
        for x in range(cw):
            r, g, b, _a = cp[x, y]
            if not _is_seal_ink(r, g, b):
                cp[x, y] = (0, 0, 0, 0)
                continue
            a = _ink_alpha(r, g, b)
            if a < 20:
                cp[x, y] = (0, 0, 0, 0)
            else:
                # 统一偏朱红，弱化扫描灰边
                rr = min(255, int(r * 0.92 + 40))
                gg = min(g, int(r * 0.22))
                bb = min(b, int(r * 0.18))
                cp[x, y] = (rr, gg, bb, a)

    cx, cy = cw / 2.0, ch / 2.0
    rs = [
        math.hypot(x - cx, y - cy)
        for y in range(ch)
        for x in range(cw)
        if cp[x, y][3] > 50
    ]
    R = (sorted(rs)[int(len(rs) * 0.992)] + 0.6) if rs else min(cw, ch) / 2.0
    for y in range(ch):
        for x in range(cw):
            d = math.hypot(x - cx, y - cy)
            r, g, b, a = cp[x, y]
            if d > R + 0.8:
                cp[x, y] = (0, 0, 0, 0)
            elif d > R:
                cp[x, y] = (r, g, b, int(a * 0.15))
    return crop


def _scrub_non_ink(im):
    """缩放锐化后再清一次，去掉插值灰晕与章外残点。"""
    px = im.load()
    w, h = im.size
    cx, cy = w / 2.0, h / 2.0
    # 用较实的像素估外径，砍掉外圈半透明脏边
    strong = [
        math.hypot(x - cx, y - cy)
        for y in range(h)
        for x in range(w)
        if px[x, y][3] >= 120 and _is_seal_ink(*px[x, y][:3])
    ]
    R = (sorted(strong)[int(len(strong) * 0.985)] if strong else min(w, h) / 2.0 - 4)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = math.hypot(x - cx, y - cy)
            if a < 48 or d > R:
                px[x, y] = (0, 0, 0, 0)
                continue
            if not _is_seal_ink(r, g, b):
                px[x, y] = (0, 0, 0, 0)
                continue
            # 外缘淡边直接丢，避免章上方“脏痕”
            if d > R - 2.0 and a < 110:
                px[x, y] = (0, 0, 0, 0)
    # 去掉孤立噪点（周围几乎没有实印泥）
    snap = im.copy()
    sp = snap.load()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if sp[x, y][3] < 40:
                continue
            n = 0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    if sp[x + dx, y + dy][3] >= 80:
                        n += 1
            if n < 2:
                px[x, y] = (0, 0, 0, 0)
    # 章顶外缘再硬切一层，消除 PDF 叠印时的浅灰脏边
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            d = math.hypot(x - cx, y - cy)
            # 顶部扇区（接近 12 点）外缘：低透明直接清掉
            if y < cy - R * 0.72 and d > R - 3.5 and a < 160:
                px[x, y] = (0, 0, 0, 0)
    # 整体外扩腐蚀 1px：去掉缩放/叠印产生的灰粉边
    eroded = im.copy()
    ep = eroded.load()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if px[x, y][3] == 0:
                continue
            if (
                px[x - 1, y][3] == 0
                or px[x + 1, y][3] == 0
                or px[x, y - 1][3] == 0
                or px[x, y + 1][3] == 0
            ):
                # 仅清掉很淡的边界像素；实印泥保留
                if px[x, y][3] < 200:
                    ep[x, y] = (0, 0, 0, 0)
    return eroded


def make_wh_seal(out_path, size=520):
    src_path = None
    for p in SOURCE_CANDIDATES:
        if os.path.isfile(p):
            src_path = p
            break
    if not src_path:
        raise SystemExit('missing seal source: put wh_seal_source.png under assets/sbdy/')

    crop = _extract_seal(Image.open(src_path))
    out = crop.resize((int(size), int(size)), Image.Resampling.LANCZOS)
    out = out.filter(ImageFilter.UnsharpMask(radius=1.0, percent=95, threshold=3))
    out = _scrub_non_ink(out)
    # 二值化 alpha，避免半透明红在白底上变成浅灰脏边
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 96 or not _is_seal_ink(r, g, b):
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (r, g, b, 255)
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    out.save(out_path, 'PNG')
    return out_path


def main():
    # 若传入样张路径，先存为 source
    if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
        src = Image.open(sys.argv[1]).convert('RGB')
        src.save(os.path.join(ASSETS, 'wh_seal_source.png'), 'PNG')
        print('stored source', os.path.join(ASSETS, 'wh_seal_source.png'))
    out = os.path.join(ASSETS, 'wh_seal.png')
    make_wh_seal(out)
    print('wrote', out)


if __name__ == '__main__':
    main()
