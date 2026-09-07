#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从运营提供的真实样张抠出河南「郑东新区业务查询专用章」（透明底）。

源图：assets/sbdy/henan_seal_user_src.png（白底红章照片/截图）
输出：assets/sbdy/henan_seal.png

用法：
  python3 make_ha_seal.py [可选:源图路径]
"""
from __future__ import print_function

import math
import os
import sys

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'sbdy')
SOURCE_CANDIDATES = [
    os.path.join(ASSETS, 'henan_seal_user_src.png'),
    os.path.join(ASSETS, 'henan_seal_source.png'),
]
OUT_ASSET = os.path.join(ASSETS, 'henan_seal.png')


def _is_seal_ink(r, g, b):
    """保留朱红印泥；白底、灰边去掉。"""
    if r < 100:
        return False
    if r <= g + 18 or r <= b + 18:
        return False
    if min(g, b) > 185 and (r - min(g, b)) < 45:
        return False
    # 接近粉白的扫描晕
    if r > 230 and g > 180 and b > 170 and (r - min(g, b)) < 60:
        return False
    return True


def _ink_alpha(r, g, b):
    strength = (r - max(g, b)) + max(0, r - 140) * 0.45
    return max(0, min(255, int(strength * 3.0)))


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
    half = max(maxx - minx, maxy - miny) / 2.0 + 3
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
            if a < 24:
                cp[x, y] = (0, 0, 0, 0)
            else:
                # 保留源图朱红质感，略抬饱和避免发灰
                rr = min(255, int(r * 0.95 + 28))
                gg = min(g, int(r * 0.28 + 8))
                bb = min(b, int(r * 0.22 + 4))
                cp[x, y] = (rr, gg, bb, a)

    cx, cy = cw / 2.0, ch / 2.0
    rs = [
        math.hypot(x - cx, y - cy)
        for y in range(ch)
        for x in range(cw)
        if cp[x, y][3] > 50
    ]
    R = (sorted(rs)[int(len(rs) * 0.995)] + 0.8) if rs else min(cw, ch) / 2.0
    for y in range(ch):
        for x in range(cw):
            d = math.hypot(x - cx, y - cy)
            r, g, b, a = cp[x, y]
            if d > R + 0.6:
                cp[x, y] = (0, 0, 0, 0)
            elif d > R:
                cp[x, y] = (r, g, b, int(a * 0.2))
    return crop


def _scrub_non_ink(im):
    px = im.load()
    w, h = im.size
    cx, cy = w / 2.0, h / 2.0
    strong = [
        math.hypot(x - cx, y - cy)
        for y in range(h)
        for x in range(w)
        if px[x, y][3] >= 100 and _is_seal_ink(*px[x, y][:3])
    ]
    R = sorted(strong)[int(len(strong) * 0.99)] if strong else min(w, h) / 2.0 - 4
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = math.hypot(x - cx, y - cy)
            if a < 40 or d > R + 0.5:
                px[x, y] = (0, 0, 0, 0)
                continue
            if not _is_seal_ink(r, g, b):
                px[x, y] = (0, 0, 0, 0)
                continue
            if d > R - 1.5 and a < 120:
                px[x, y] = (0, 0, 0, 0)

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
                if px[x, y][3] < 210:
                    ep[x, y] = (0, 0, 0, 0)
    return eroded


def make_ha_seal(out_path=OUT_ASSET, size=820):
    src_path = None
    for p in SOURCE_CANDIDATES:
        if os.path.isfile(p):
            src_path = p
            break
    if not src_path:
        raise SystemExit('missing seal source: put henan_seal_user_src.png under assets/sbdy/')

    crop = _extract_seal(Image.open(src_path))
    out = crop.resize((int(size), int(size)), Image.Resampling.LANCZOS)
    out = out.filter(ImageFilter.UnsharpMask(radius=1.05, percent=110, threshold=2))
    out = _scrub_non_ink(out)
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 88 or not _is_seal_ink(r, g, b):
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (r, g, b, 255)
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)
    out.save(out_path, 'PNG')
    return out_path


def main():
    if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
        src = Image.open(sys.argv[1]).convert('RGB')
        dest = os.path.join(ASSETS, 'henan_seal_user_src.png')
        src.save(dest, 'PNG')
        print('stored source', dest)
    path = make_ha_seal()
    print('wrote', path)


if __name__ == '__main__':
    main()
