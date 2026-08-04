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

# 基于 1024x725 模板标定
NAME_BOX = (368, 84, 455, 108)
INCOME_BOX = (788, 143, 895, 168)
ROW0_Y = 212
ROW_H = 34
N_ROWS = 12
COL_AMT = (278, 392)
COL_BAL = (402, 528)
COL_CO = (728, 978)

DEFAULT_COUNTERPARTY_ACCOUNT = "140500616296"


def find_font(size):
    candidates = [
        os.environ.get("CCB_FLOW_FONT") or "",
        "/app/assets/sbdy/NotoSerifCJKsc-Regular.otf",
        "/app/assets/sbdy/SimSun_21.ttf",
        "/app/assets/sbdy/PD4MLNSimSun_16.ttf",
        "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    ]
    for path in candidates:
        if not path or not os.path.isfile(path):
            continue
        try:
            if path.lower().endswith(".ttc"):
                return ImageFont.truetype(path, size=size, index=0)
            return ImageFont.truetype(path, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


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


def is_reddish(rgb):
    r, g, b = [int(x) for x in rgb[:3]]
    return r > 120 and r > g + 25 and r > b + 25 and (r - min(g, b)) > 30


def clear_text_keep_seal(arr, box, inset=2):
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
    red = (r > 110) & (r > g + 20) & (r > b + 20) & ((r - np.minimum(g, b)) > 25)
    region[~red] = np.array([255, 255, 255], dtype=np.uint8)
    arr[y0:y1, x0:x1] = region


def draw_text_in_box(draw, box, text, font, fill=(20, 20, 20), align="left", valign="center", max_lines=2):
    x0, y0, x1, y1 = box
    text = str(text or "")
    if not text:
        return
    max_w = max(8, x1 - x0 - 4)
    # wrap
    lines = []
    cur = ""
    for ch in text:
        trial = cur + ch
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = ch
            if len(lines) >= max_lines:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    if not lines:
        return
    # truncate last with …
    if len(text) > sum(len(l) for l in lines):
        last = lines[-1]
        while last and draw.textlength(last + "…", font=font) > max_w:
            last = last[:-1]
        lines[-1] = (last + "…") if last else "…"

    line_h = font.size + 2
    total_h = line_h * len(lines)
    if valign == "center":
        ty = y0 + max(0, (y1 - y0 - total_h) // 2)
    else:
        ty = y0 + 2
    for i, line in enumerate(lines):
        lw = draw.textlength(line, font=font)
        if align == "right":
            tx = x1 - 4 - lw
        elif align == "center":
            tx = x0 + (x1 - x0 - lw) / 2
        else:
            tx = x0 + 3
        draw.text((tx, ty + i * line_h), line, font=font, fill=fill)


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

    # clear regions
    if name:
        clear_text_keep_seal(arr, NAME_BOX)
    clear_text_keep_seal(arr, INCOME_BOX)
    for i in range(N_ROWS):
        y0 = ROW0_Y + i * ROW_H
        y1 = y0 + ROW_H
        clear_text_keep_seal(arr, (COL_AMT[0], y0 + 3, COL_AMT[1], y1 - 1))
        clear_text_keep_seal(arr, (COL_BAL[0], y0 + 3, COL_BAL[1], y1 - 1))
        if account_name or company:
            clear_text_keep_seal(arr, (COL_CO[0], y0 + 2, COL_CO[1], y1 - 1))

    out = Image.fromarray(arr)
    draw = ImageDraw.Draw(out)
    font_name = find_font(14)
    font_num = find_font(13)
    font_co = find_font(11)

    if name:
        draw_text_in_box(draw, NAME_BOX, name, font_name, align="left", max_lines=1)
    draw_text_in_box(draw, INCOME_BOX, fmt_money(total_income), font_num, align="left", max_lines=1)

    co_text = ""
    if account_name or company:
        co_text = "{}/{}".format(counterparty_account, account_name or company)

    for i in range(N_ROWS):
        y0 = ROW0_Y + i * ROW_H
        y1 = y0 + ROW_H
        draw_text_in_box(
            draw,
            (COL_AMT[0], y0 + 3, COL_AMT[1], y1 - 1),
            fmt_money(amounts[i]),
            font_num,
            align="right",
            max_lines=1,
        )
        draw_text_in_box(
            draw,
            (COL_BAL[0], y0 + 3, COL_BAL[1], y1 - 1),
            fmt_money(balances[i]),
            font_num,
            align="right",
            max_lines=1,
        )
        if co_text:
            draw_text_in_box(
                draw,
                (COL_CO[0], y0 + 1, COL_CO[1], y1 - 1),
                co_text,
                font_co,
                align="left",
                max_lines=2,
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
