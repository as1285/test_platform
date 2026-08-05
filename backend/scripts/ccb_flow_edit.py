#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""建设银行工资交易明细原图编辑：改姓名、对方账号/户名(公司)、交易金额、余额、总收入。"""
from __future__ import print_function

import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

TEMPLATE_W = 1024
TEMPLATE_H = 725

# 基于 1024x725 模板标定（竖线约在 191/270/397/536/721/945）
NAME_BOX = (362, 84, 470, 110)
INCOME_BOX = (786, 142, 900, 170)
ROW0_Y = 212
ROW_H = 34
N_ROWS = 12
# 单元格内容区：贴着表格竖线内侧，避免残留原字笔画
COL_AMT = (271, 396)
COL_BAL = (398, 535)
COL_CO = (722, 944)

DEFAULT_COUNTERPARTY_ACCOUNT = "140500616296"


_FONT_CACHE = {}


def _font_can_render(font):
    """跳过空壳/缺字体会画出 □ 的字体。"""
    try:
        # 数字与汉字掩码都需有实际像素，且宽度不同（排除统一豆腐块）
        m_digit = font.getmask("8")
        m_cjk = font.getmask("工")
        if not m_digit or not m_cjk:
            return False
        w1, h1 = m_digit.size
        w2, h2 = m_cjk.size
        if w1 < 3 or h1 < 3 or w2 < 3 or h2 < 3:
            return False
        im = Image.new("RGB", (480, 52), (255, 255, 255))
        d = ImageDraw.Draw(im)
        d.text((2, 4), "唐冬15,002.70", font=font, fill=(0, 0, 0))
        arr = np.array(im)
        dark = int((arr.mean(axis=2) < 200).sum())
        return dark >= 40
    except Exception:
        return False


def find_font(size):
    size = int(size) if size else 14
    cached = _FONT_CACHE.get(size)
    if cached is not None:
        return cached
    candidates = [
        os.environ.get("CCB_FLOW_FONT") or "",
        # 完整 CJK 字体优先；PD4ML/SimSun_21 易缺字变 □
        "/app/assets/sbdy/NotoSerifCJKsc-Regular.otf",
        "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/app/assets/sbdy/PD4MLNSimSun_16.ttf",
    ]
    for path in candidates:
        if not path or not os.path.isfile(path):
            continue
        try:
            if path.lower().endswith(".ttc"):
                font = ImageFont.truetype(path, size=size, index=0)
            else:
                font = ImageFont.truetype(path, size=size)
            if not _font_can_render(font):
                continue
            _FONT_CACHE[size] = font
            return font
        except Exception:
            continue
    font = ImageFont.load_default()
    _FONT_CACHE[size] = font
    return font


def parse_money(raw, default=None):
    if raw is None:
        return default
    s = str(raw).strip()
    if not s:
        return default
    s = s.replace(",", "").replace("，", "").replace(" ", "")
    s = re.sub(r"[^\d.\-]", "", s)
    if not s or s in (".", "-", "-."):
        return default
    try:
        return float(s)
    except Exception:
        return default


def fmt_money(v):
    """与原图风格接近：千分位 + 两位小数。"""
    n = float(v)
    neg = n < 0
    n = abs(n)
    whole = int(round(n * 100))
    yuan = whole // 100
    fen = whole % 100
    s = "{:,}".format(yuan) + ".{:02d}".format(fen)
    return ("-" + s) if neg else s


def parse_amount_list(raw, n=N_ROWS):
    if raw is None:
        return None
    if isinstance(raw, (list, tuple)):
        vals = [parse_money(x) for x in raw]
    else:
        s = str(raw).strip()
        if not s:
            return None
        parts = re.split(r"[\n,;，；]+", s)
        vals = [parse_money(p) for p in parts if str(p).strip() != ""]
    vals = [v for v in vals if v is not None]
    if not vals:
        return None
    if len(vals) == 1:
        return [vals[0]] * n
    if len(vals) < n:
        vals = vals + [vals[-1]] * (n - len(vals))
    return vals[:n]


def parse_balance_list(raw, amounts, opening):
    explicit = parse_amount_list(raw, N_ROWS) if raw not in (None, "") else None
    if explicit:
        return explicit
    open_bal = parse_money(opening, 7415.60)
    out = []
    run = open_bal
    for a in amounts:
        run = round(run + float(a), 2)
        out.append(run)
    return out


def clear_text_keep_seal(arr, box, inset=1):
    """清空单元格内容区为白底，保留红章像素；inset 避开表格线。"""
    x0, y0, x1, y1 = box
    H, W = arr.shape[:2]
    x0 = max(0, x0 + inset)
    y0 = max(0, y0 + inset)
    x1 = min(W, x1 - inset)
    y1 = min(H, y1 - inset)
    if x1 <= x0 or y1 <= y0:
        return
    region = arr[y0:y1, x0:x1]
    rgb = region.astype(np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    # 红章：偏红；其余（含抗锯齿灰边）一律刷白，避免残留笔画
    red = (r > 110) & (r > g + 20) & (r > b + 20) & ((r - np.minimum(g, b)) > 25)
    region[~red] = np.array([255, 255, 255], dtype=np.uint8)
    arr[y0:y1, x0:x1] = region


def text_width(draw, text, font):
    try:
        return float(draw.textlength(text, font=font))
    except Exception:
        bbox = draw.textbbox((0, 0), text, font=font)
        return float(bbox[2] - bbox[0])


def fit_font(draw, text, box, max_size, min_size=9):
    """单行缩放到单元格宽度内。"""
    x0, y0, x1, y1 = box
    max_w = max(8, x1 - x0 - 6)
    size = max_size
    font = find_font(size)
    while size > min_size and text_width(draw, text, font) > max_w:
        size -= 1
        font = find_font(size)
    return font


def draw_text_in_box(draw, box, text, font, fill=(20, 20, 20), align="left", valign="center"):
    """单行绘制，超出以省略号截断（避免两行叠字）。"""
    x0, y0, x1, y1 = box
    text = str(text or "")
    if not text:
        return
    max_w = max(8, x1 - x0 - 6)
    if text_width(draw, text, font) > max_w:
        ell = "…"
        while text and text_width(draw, text + ell, font) > max_w:
            text = text[:-1]
        text = (text + ell) if text else ell

    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        top_bear = bbox[1]
    except Exception:
        tw = text_width(draw, text, font)
        th = getattr(font, "size", 14)
        top_bear = 0

    if align == "right":
        tx = x1 - 4 - tw
    elif align == "center":
        tx = x0 + (x1 - x0 - tw) / 2
    else:
        tx = x0 + 3

    if valign == "center":
        ty = y0 + max(0, (y1 - y0 - th) // 2) - top_bear
    else:
        ty = y0 + 2 - top_bear
    draw.text((tx, ty), text, font=font, fill=fill)


def process(cfg):
    image_path = cfg.get("image_path") or cfg.get("template_path")
    out_path = cfg["out_path"]
    if not image_path or not os.path.isfile(image_path):
        raise SystemExit("image_path missing")

    im = Image.open(image_path).convert("RGB")
    if im.size != (TEMPLATE_W, TEMPLATE_H):
        im = im.resize((TEMPLATE_W, TEMPLATE_H), Image.Resampling.LANCZOS)
    arr = np.array(im)

    name = str(cfg.get("name") or "").strip()
    company = str(cfg.get("company_name") or "").strip()
    account_name = str(cfg.get("account_name") or "").strip() or company
    counterparty_account = str(cfg.get("counterparty_account") or DEFAULT_COUNTERPARTY_ACCOUNT).strip()
    counterparty_account = re.sub(r"\s+", "", counterparty_account) or DEFAULT_COUNTERPARTY_ACCOUNT

    amounts = parse_amount_list(cfg.get("amounts") if cfg.get("amounts") is not None else cfg.get("amount"))
    if not amounts:
        # 默认沿用原图量级
        amounts = [15002.70] * N_ROWS
    balances = parse_balance_list(cfg.get("balances"), amounts, cfg.get("opening_balance"))
    total_income = parse_money(cfg.get("total_income"), None)
    if total_income is None:
        total_income = round(sum(amounts), 2)

    # clear regions（金额/余额用 inset=0，避免原数字抗锯齿残留黑点）
    if name:
        clear_text_keep_seal(arr, NAME_BOX, inset=1)
    clear_text_keep_seal(arr, INCOME_BOX, inset=1)
    for i in range(N_ROWS):
        y0 = ROW0_Y + i * ROW_H
        y1 = y0 + ROW_H
        clear_text_keep_seal(arr, (COL_AMT[0] + 1, y0 + 1, COL_AMT[1], y1), inset=0)
        clear_text_keep_seal(arr, (COL_BAL[0] + 1, y0 + 1, COL_BAL[1], y1), inset=0)
        if account_name or company:
            clear_text_keep_seal(arr, (COL_CO[0] + 1, y0 + 1, COL_CO[1], y1), inset=0)

    out = Image.fromarray(arr)
    draw = ImageDraw.Draw(out)
    font_name = find_font(14)
    font_num = find_font(13)

    if name:
        draw_text_in_box(draw, NAME_BOX, name, font_name, align="left")
    draw_text_in_box(draw, INCOME_BOX, fmt_money(total_income), font_num, align="left")

    co_text = ""
    if account_name or company:
        co_text = "{}/{}".format(counterparty_account, account_name or company)

    for i in range(N_ROWS):
        y0 = ROW0_Y + i * ROW_H
        y1 = y0 + ROW_H
        amt_box = (COL_AMT[0], y0 + 2, COL_AMT[1], y1 - 1)
        bal_box = (COL_BAL[0], y0 + 2, COL_BAL[1], y1 - 1)
        co_box = (COL_CO[0], y0 + 1, COL_CO[1], y1 - 1)
        amt_s = fmt_money(amounts[i])
        bal_s = fmt_money(balances[i])
        draw_text_in_box(draw, amt_box, amt_s, fit_font(draw, amt_s, amt_box, 13), align="right")
        draw_text_in_box(draw, bal_box, bal_s, fit_font(draw, bal_s, bal_box, 13), align="right")
        if co_text:
            draw_text_in_box(
                draw,
                co_box,
                co_text,
                fit_font(draw, co_text, co_box, 12, min_size=8),
                align="left",
            )

    out.save(out_path, format="PNG")
    meta = {
        "ok": True,
        "name": name,
        "company_name": company,
        "account_name": account_name,
        "counterparty_account": counterparty_account,
        "amounts": amounts,
        "balances": balances,
        "total_income": total_income,
        "rows": N_ROWS,
    }
    print(json.dumps(meta, ensure_ascii=False))


def main():
    if len(sys.argv) < 2:
        print("usage: ccb_flow_edit.py config.json", file=sys.stderr)
        sys.exit(2)
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        cfg = json.load(f)
    process(cfg)


if __name__ == "__main__":
    main()
