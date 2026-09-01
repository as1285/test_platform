#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""公司公章（SealUtil / 网上常见圆章）：细双圈 + 弧形单位名 + 五角星 + 星下「专用章」。

参考常见 Canvas 实现（博客园 createSeal / HTML5 画印章）：
- 外圈粗、内圈细
- 上弧公司全称（字号随字数收缩）
- 中心实心五角星
- 星下方横排「专用章」
- 可选底弧编号（统一社会信用代码推算或 hash 兜底）
"""
from __future__ import print_function

import math
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets", "sbdy")
NOTO_SERIF_SC = os.path.join(ASSETS, "NotoSerifCJKsc-Regular.otf")
NOTO_SERIF_BOLD_TTC = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
NOTO_SERIF_REG_TTC = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc"
NOTO_SANS_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"

# 印泥朱红
SEAL_RED = (210, 36, 40, 255)
SEAL_STAMP_ALPHA = 0.82
SEAL_PT = 176
# A4 @ 2x（与 lizhi/zaizhi 渲染一致，供 place_seal 默认尺寸）
SCALE = 2.0


def _first_existing(*paths):
    for p in paths:
        if p and os.path.isfile(p):
            return p
    return None


def _font_path_serif_reg():
    return _first_existing(NOTO_SERIF_SC, NOTO_SERIF_REG_TTC, NOTO_SERIF_BOLD_TTC)


def _load_pil_font(path, px, prefer_index=2):
    if not path:
        return ImageFont.load_default()
    for idx in (prefer_index, 0, 1, 3, 4):
        try:
            return ImageFont.truetype(path, size=px, index=idx)
        except Exception:
            continue
    try:
        return ImageFont.truetype(path, size=px)
    except Exception:
        return ImageFont.load_default()


def seal_body_font(px):
    path = _font_path_serif_reg()
    if path and path.endswith(".otf"):
        return _load_pil_font(path, px, prefer_index=0)
    return _load_pil_font(path, px, prefer_index=2)


def _draw_pentagram(draw, cx, cy, outer_r, fill):
    """标准五角星：内半径 = R·sin18°/cos36°。"""
    inner_r = outer_r * math.sin(math.radians(18.0)) / math.cos(math.radians(36.0))
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = outer_r if i % 2 == 0 else inner_r
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    draw.polygon(pts, fill=fill)


def _paste_seal_char(seal, ch, cx, cy, radius, ang_deg, font, fill, x_scale=0.68, invert=False):
    """SealUtil 风格：单字先压窄再旋转。"""
    size = getattr(font, "size", 64) or 64
    pad = max(64, int(size * 4))
    g = Image.new("RGBA", (pad, pad), (0, 0, 0, 0))
    gd = ImageDraw.Draw(g)
    bb = gd.textbbox((0, 0), ch, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    gx = (pad - tw) / 2.0 - bb[0]
    gy = (pad - th) / 2.0 - bb[1]
    gd.text((gx, gy), ch, font=font, fill=fill)
    nw = max(1, int(round(pad * x_scale)))
    g = g.resize((nw, pad), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (pad, pad), (0, 0, 0, 0))
    canvas.paste(g, ((pad - nw) // 2, 0), g)
    rot = (90.0 - ang_deg) if invert else (270.0 - ang_deg)
    canvas = canvas.rotate(
        rot, resample=Image.Resampling.BICUBIC, center=(pad / 2.0, pad / 2.0), expand=False
    )
    ang = math.radians(ang_deg)
    x = cx + radius * math.cos(ang)
    y = cy + radius * math.sin(ang)
    seal.alpha_composite(canvas, (int(round(x - pad / 2.0)), int(round(y - pad / 2.0))))


def _arc_angles(n, radius, font_size, x_scale, is_top=True):
    """按字宽算弧间距（SealUtil fontSpace），短名称不拉满半圈。"""
    if n <= 0:
        return []
    if n == 1:
        return [270.0 if is_top else 90.0]
    chord = font_size * (0.88 if is_top else 0.62) * x_scale
    deg_per = math.degrees(2.0 * math.asin(min(0.92, chord / max(1.0, 2.0 * radius))))
    # 网上常见上弧约 4π/3 跨度上限
    max_span = 240.0 if is_top else 150.0
    span = min(max_span, deg_per * (n - 1))
    deg_per = span / (n - 1) if n > 1 else 0
    mid = 270.0 if is_top else 90.0
    start = mid - span / 2.0
    return [start + i * deg_per for i in range(n)]


def default_seal_code(company, raw=None):
    """公章底弧编号：优先入参；否则从统一社会信用代码推 13 位数字。"""
    s = re.sub(r"\D", "", str(raw or ""))
    if len(s) >= 17:
        return (s[2:8] + s[8:15])[:13]
    if len(s) >= 13:
        return s[:13]
    if len(s) >= 9:
        return (s + "0000000000000")[:13]
    seed = str(company or "seal")
    h = 0
    for ch in seed:
        h = (h * 131 + ord(ch)) & 0xFFFFFFFF
    return ("%013d" % (1000000000000 + (h % 9000000000000)))[:13]


def make_seal(company, seal_code=None, specialty="专用章", draw_code=True):
    """圆形公章：细双圈 + 上弧单位名 + 中心五角星 + 星下横排 specialty + 可选底弧编号。"""
    SS = 2000
    RED = SEAL_RED
    seal = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(seal)
    cx = cy = SS / 2.0

    # SealUtil 默认：外圈 line=3 / r=140，内圈 line=1 / r=135
    R = SS * 0.468
    ring_w = max(18, int(R * 3.0 / 140.0))
    inner_w = max(6, int(R * 1.0 / 140.0))
    ring_gap = max(10, int(R * 5.0 / 140.0))
    inner_r = R - ring_w / 2.0 - ring_gap - inner_w / 2.0
    star_outer = R * 0.28

    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=RED, width=ring_w)
    d.ellipse(
        [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
        outline=RED,
        width=inner_w,
    )
    _draw_pentagram(d, cx, cy, star_outer, RED)

    chars = list((company or "专用章").strip()) or list("专用章")
    if len(chars) > 22:
        chars = chars[:22]
    n = len(chars)
    # SealUtil：fontSize ≈ 55 - len*2，再按半径放大
    font_size = int((55 - n * 2) * (R / 140.0))
    font_size = max(int(SS * 0.052), min(int(SS * 0.112), font_size))
    x_scale = 0.68
    text_r = inner_r - inner_w - font_size * 0.42
    font = seal_body_font(font_size)
    for ch, ang_deg in zip(chars, _arc_angles(n, text_r, font_size, x_scale, is_top=True)):
        _paste_seal_char(seal, ch, cx, cy, text_r, ang_deg, font, RED, x_scale=x_scale, invert=False)

    # 星下方横排「专用章」（网上 createSeal 常见布局）
    label = str(specialty or "专用章").strip() or "专用章"
    label_px = max(int(SS * 0.038), int(font_size * 0.42))
    label_font = seal_body_font(label_px)
    bb = d.textbbox((0, 0), label, font=label_font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    label_y = cy + star_outer * 0.95
    d.text(
        (cx - tw / 2.0 - bb[0], label_y - th / 2.0 - bb[1]),
        label,
        font=label_font,
        fill=RED,
    )

    if draw_code:
        code = default_seal_code(company, seal_code)
        code_chars = list(code)
        code_font_px = max(int(SS * 0.026), int(font_size * 0.30))
        code_r = text_r * 0.92
        code_font = seal_body_font(code_font_px)
        for ch, ang_deg in zip(
            code_chars, _arc_angles(len(code_chars), code_r, code_font_px, 0.92, is_top=False)
        ):
            _paste_seal_char(
                seal, ch, cx, cy, code_r, ang_deg, code_font, RED, x_scale=0.92, invert=True
            )

    pad_px = int(ring_w * 0.45)
    box = [
        int(cx - R - pad_px),
        int(cy - R - pad_px),
        int(cx + R + pad_px),
        int(cy + R + pad_px),
    ]
    cropped = seal.crop(box)
    side = cropped.size[0]
    mask = Image.new("L", (side, side), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([0, 0, side - 1, side - 1], fill=255)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(cropped, (0, 0), mask)
    return out.resize((820, 820), Image.Resampling.LANCZOS)


def place_seal(img, company, seal_x, seal_y, seal_pt=None, seal_code=None, scale=None):
    """把朱红公章盖到证明页上，略透。"""
    if scale is None:
        scale = SCALE
    if seal_pt is None:
        seal_pt = int(SEAL_PT * scale)
    seal_r = make_seal(company, seal_code=seal_code).resize((seal_pt, seal_pt), Image.Resampling.LANCZOS)
    sa = seal_r.split()[-1].point(lambda v: int(v * SEAL_STAMP_ALPHA))
    seal_r.putalpha(sa)
    img.alpha_composite(seal_r, (int(seal_x), int(seal_y)))
    return seal_pt


def main():
    """冒烟：python3 company_seal.py [company] [out.png]"""
    company = sys.argv[1] if len(sys.argv) > 1 else "杭州云启信息技术有限公司"
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "company_seal_preview.png")
    img = make_seal(company)
    img.save(out, format="PNG")
    print("ok", out, img.size)


if __name__ == "__main__":
    main()
