#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""公司公章：对齐 GitHub DrawStampUtils（xxss0903/drawstamputils）圆章观感。

企业公章（离职/在职证明盖的那种）：
- 单圈朱红
- 上弧单位全称（宋体，不压扁）
- 中心五角星
- 下弧 13 位编号
- 外圈毛边 + 短防伪纹 + 轻微印泥不均

参考：
- https://github.com/xxss0903/drawstamputils （毛边 / 防伪纹 / 弧字分布）
- https://github.com/localhost02/SealUtil （圆章弧字角度）
"""
from __future__ import print_function

import hashlib
import math
import os
import random
import re
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets", "sbdy")
NOTO_SERIF_SC = os.path.join(ASSETS, "NotoSerifCJKsc-Regular.otf")
NOTO_SERIF_BOLD_TTC = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
NOTO_SERIF_REG_TTC = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc"
NOTO_SANS_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"

# 印泥朱红（盖到纸上略透，但不洗成粉红）
SEAL_RED = (210, 36, 40, 255)
SEAL_STAMP_ALPHA = 0.90
SEAL_PT = 176
SCALE = 2.0


def _first_existing(*paths):
    for p in paths:
        if p and os.path.isfile(p):
            return p
    return None


def _font_path_serif_reg():
    return _first_existing(NOTO_SERIF_SC, NOTO_SERIF_REG_TTC, NOTO_SERIF_BOLD_TTC)


def _font_path_serif_bold():
    return _first_existing(NOTO_SERIF_BOLD_TTC, NOTO_SERIF_SC, NOTO_SANS_BOLD)


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


def seal_body_font(px, bold=True):
    if bold:
        path = _font_path_serif_bold()
        if path and path.endswith(".otf"):
            return _load_pil_font(path, px, prefer_index=0)
        return _load_pil_font(path, px, prefer_index=2)
    path = _font_path_serif_reg()
    if path and path.endswith(".otf"):
        return _load_pil_font(path, px, prefer_index=0)
    return _load_pil_font(path, px, prefer_index=2)


def _seeded_rng(*parts):
    h = hashlib.sha256()
    for p in parts:
        h.update(str(p).encode("utf-8"))
        h.update(b"\0")
    return random.Random(int(h.hexdigest()[:16], 16))


def _draw_pentagram(draw, cx, cy, outer_r, fill):
    """标准五角星：内半径 = R·sin18°/cos36°。"""
    inner_r = outer_r * math.sin(math.radians(18.0)) / math.cos(math.radians(36.0))
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = outer_r if i % 2 == 0 else inner_r
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    draw.polygon(pts, fill=fill)


def _paste_seal_char(seal, ch, cx, cy, radius, ang_deg, font, fill, x_scale=1.0, invert=False):
    """单字贴到圆弧上。x_scale<1 才压窄；圆章公司名默认不压。"""
    size = getattr(font, "size", 64) or 64
    pad = max(80, int(size * 3.6))
    g = Image.new("RGBA", (pad, pad), (0, 0, 0, 0))
    gd = ImageDraw.Draw(g)
    bb = gd.textbbox((0, 0), ch, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    gx = (pad - tw) / 2.0 - bb[0]
    gy = (pad - th) / 2.0 - bb[1]
    # Regular 宋体偏细，轻微描边接近公章刻字的笔画重量
    stroke = max(1, int(round(size * 0.028)))
    gd.text((gx, gy), ch, font=font, fill=fill, stroke_width=stroke, stroke_fill=fill)
    if abs(x_scale - 1.0) > 0.01:
        nw = max(1, int(round(pad * x_scale)))
        squeezed = g.resize((nw, pad), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (pad, pad), (0, 0, 0, 0))
        canvas.paste(squeezed, ((pad - nw) // 2, 0), squeezed)
        g = canvas
    rot = (90.0 - ang_deg) if invert else (270.0 - ang_deg)
    g = g.rotate(rot, resample=Image.Resampling.BICUBIC, center=(pad / 2.0, pad / 2.0), expand=False)
    ang = math.radians(ang_deg)
    x = cx + radius * math.cos(ang)
    y = cy + radius * math.sin(ang)
    seal.alpha_composite(g, (int(round(x - pad / 2.0)), int(round(y - pad / 2.0))))


def _company_arc_span(n):
    """DrawStampUtils：totalAngle = π·(0.5 + n/(factor·4))，圆章用 factor≈3.2。"""
    if n <= 1:
        return 0.0
    factor = 3.2
    deg = 180.0 * (0.5 + n / (factor * 4.0))
    return max(168.0, min(258.0, deg))


def _arc_angles(n, is_top=True, span_deg=None):
    if n <= 0:
        return []
    if n == 1:
        return [270.0 if is_top else 90.0]
    if span_deg is None:
        if is_top:
            span_deg = min(_company_arc_span(n), 17.5 * n + 42.0)
        else:
            span_deg = min(108.0, 7.6 * n)
    mid = 270.0 if is_top else 90.0
    start = mid - span_deg / 2.0
    step = span_deg / n
    return [start + (i + 0.5) * step for i in range(n)]


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


def _apply_rough_edge(seal, cx, cy, R, ring_w, rng):
    """DrawStampUtils.addRoughEdge：沿外圈 destination-out 打不规则小圆，做出橡皮章毛边。"""
    r, g, b, a = seal.split()
    punch = Image.new("L", seal.size, 0)
    pd = ImageDraw.Draw(punch)
    points = 200
    # 只啃外沿，避免把单圈咬穿成两道线
    roughness = ring_w * 0.18
    for i in range(points):
        if rng.random() < 0.50:
            continue
        ang = (i / float(points)) * math.pi * 2.0
        size = rng.random() * roughness * rng.random() + ring_w * 0.06
        shift = ring_w * (0.15 + rng.random() * 0.25)
        x = cx + math.cos(ang) * (R + shift)
        y = cy + math.sin(ang) * (R + shift)
        pd.ellipse([x - size, y - size, x + size, y + size], fill=255)
    punch = punch.filter(ImageFilter.GaussianBlur(radius=0.6))
    a = ImageChops.subtract(a, punch)
    return Image.merge("RGBA", (r, g, b, a))


def _apply_ink_wear(seal, cx, cy, R, rng):
    """轻微印泥不均：章面随机减一点透明度，避免电脑矢量那种匀红。"""
    r, g, b, a = seal.split()
    wear = Image.new("L", seal.size, 0)
    wd = ImageDraw.Draw(wear)
    for _ in range(48):
        ang = rng.random() * math.pi * 2.0
        # 避开最外圈，防止单圈被磨出缺口缝
        rad = (rng.random() ** 0.7) * R * 0.88
        x = cx + math.cos(ang) * rad
        y = cy + math.sin(ang) * rad
        s = rng.randint(3, 14)
        wd.ellipse([x - s, y - s, x + s, y + s], fill=rng.randint(12, 42))
    wear = wear.filter(ImageFilter.GaussianBlur(radius=1.4))
    a = ImageChops.subtract(a, wear)
    return Image.merge("RGBA", (r, g, b, a))


def _draw_security_ticks(draw, cx, cy, R, ring_w, fill, rng):
    """DrawStampUtils 防伪纹：外圈内侧几根短径向线。"""
    n = 5
    length = max(6, ring_w * 0.9)
    width = max(2, int(max(2, ring_w * 0.2)))
    for _ in range(n):
        ang = rng.uniform(0.0, math.pi * 2.0)
        jitter = math.radians(rng.uniform(-12.0, 12.0))
        a0 = ang + jitter
        r0 = R - ring_w * 0.55
        r1 = r0 - length * rng.uniform(0.70, 1.05)
        x0 = cx + math.cos(a0) * r0
        y0 = cy + math.sin(a0) * r0
        x1 = cx + math.cos(a0) * r1
        y1 = cy + math.sin(a0) * r1
        draw.line([(x0, y0), (x1, y1)], fill=fill, width=width)


def _draw_single_ring(seal, cx, cy, R, ring_w, fill):
    """实心单圈：外圆填充再挖内圆，保证一圈实心红，不是内外两道边。"""
    ring = Image.new("RGBA", seal.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.ellipse([cx - R, cy - R, cx + R, cy + R], fill=fill)
    inner = max(1.0, R - ring_w)
    punch = Image.new("L", seal.size, 0)
    pd = ImageDraw.Draw(punch)
    pd.ellipse([cx - inner, cy - inner, cx + inner, cy + inner], fill=255)
    r, g, b, a = ring.split()
    a = ImageChops.subtract(a, punch)
    ring = Image.merge("RGBA", (r, g, b, a))
    seal.alpha_composite(ring)


def make_seal(company, seal_code=None, specialty="", draw_code=True, draw_ring=True):
    """圆形企业公章。specialty 默认空（正式公章不加「专用章」）。

    星/弧字在高分辨率绘制；外圈默认在导出尺寸上画实心单圈。
    place_seal 会关掉此处画圈，改在盖章像素尺寸上只画一次，避免双圈重影。
    """
    SS = 2000
    OUT = 820
    RED = SEAL_RED
    pad = 80
    canvas = SS + pad * 2
    seal = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    d = ImageDraw.Draw(seal)
    cx = cy = canvas / 2.0
    rng = _seeded_rng(company, seal_code, specialty)

    R = SS * 0.455
    # 高分辨率阶段预留圈宽（最终圈在 OUT / 盖章尺寸上画）
    ring_w_hi = max(22, int(R * 0.030))
    star_outer = R * 0.29

    _draw_security_ticks(d, cx, cy, R, ring_w_hi, RED, rng)
    _draw_pentagram(d, cx, cy, star_outer, RED)

    chars = list((company or "公章").strip()) or list("公章")
    if len(chars) > 22:
        chars = chars[:22]
    n = len(chars)
    font_size = int((52 - n * 1.6) * (R / 140.0))
    font_size = max(int(SS * 0.056), min(int(SS * 0.108), font_size))
    # 字与圈拉开，避免字顶连成假内圈
    text_r = R - ring_w_hi - font_size * 0.88
    font = seal_body_font(font_size, bold=True)
    for ch, ang_deg in zip(chars, _arc_angles(n, is_top=True)):
        _paste_seal_char(seal, ch, cx, cy, text_r, ang_deg, font, RED, x_scale=1.0, invert=False)

    label = str(specialty or "").strip()
    if label:
        label_px = max(int(SS * 0.040), int(font_size * 0.40))
        label_font = seal_body_font(label_px, bold=True)
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
        code_font_px = max(int(SS * 0.030), int(font_size * 0.32))
        code_r = text_r * 0.96
        code_font = seal_body_font(code_font_px, bold=True)
        for ch, ang_deg in zip(code_chars, _arc_angles(len(code_chars), is_top=False)):
            _paste_seal_char(
                seal, ch, cx, cy, code_r, ang_deg, code_font, RED, x_scale=0.94, invert=True
            )

    seal = _apply_ink_wear(seal, cx, cy, R, rng)

    box = [
        int(cx - R - ring_w_hi * 1.35),
        int(cy - R - ring_w_hi * 1.35),
        int(cx + R + ring_w_hi * 1.35),
        int(cy + R + ring_w_hi * 1.35),
    ]
    out = seal.crop(box).resize((OUT, OUT), Image.Resampling.LANCZOS)

    if draw_ring:
        ocx = ocy = OUT / 2.0
        # 与高分辨率几何对齐：圈在裁切后画布的 R 映射位置
        R_out = OUT * 0.5 * (R / (R + ring_w_hi * 1.35))
        ring_w_out = max(7, int(OUT * 0.011))
        _draw_single_ring(out, ocx, ocy, R_out, ring_w_out, RED)
        out = _apply_rough_edge(out, ocx, ocy, R_out, ring_w_out, rng)
    return out


def place_seal(
    img, company, seal_x, seal_y, seal_pt=None, seal_code=None, scale=None, draw_code=True
):
    """把朱红公章盖到证明页上，略透。draw_code=False 时不画底弧编号。"""
    if scale is None:
        scale = SCALE
    if seal_pt is None:
        seal_pt = int(SEAL_PT * scale)
    # 内容先缩放，圈只在最终像素上画一次（实心单圈）
    seal_r = make_seal(
        company, seal_code=seal_code, draw_ring=False, draw_code=draw_code
    ).resize((seal_pt, seal_pt), Image.Resampling.LANCZOS)
    pcx = pcy = seal_pt / 2.0
    # 与 make_seal 裁切几何一致，避免圈压到字顶形成假双圈
    R_hi = 2000 * 0.455
    ring_w_hi = max(22, int(R_hi * 0.030))
    R_p = seal_pt * 0.5 * (R_hi / (R_hi + ring_w_hi * 1.35))
    ring_w_p = max(5, int(round(seal_pt * 0.014)))
    rng = _seeded_rng(company, seal_code, "place")
    _draw_single_ring(seal_r, pcx, pcy, R_p, ring_w_p, SEAL_RED)
    seal_r = _apply_rough_edge(seal_r, pcx, pcy, R_p, ring_w_p, rng)
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
