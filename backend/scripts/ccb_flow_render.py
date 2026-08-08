#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""建设银行工资交易明细：按数据完整绘制 PNG（非原图 PS）。"""
from __future__ import print_function

import json
import math
import os
import re
import sys
from datetime import datetime, timedelta

from PIL import Image, ImageDraw, ImageFont

# 接近 A4 截图比例的清晰画布
W = 1240
H = 1754
N_ROWS = 12
DEFAULT_COUNTERPARTY_ACCOUNT = "140500616296"
DEFAULT_CARD_NO = "6217002740035379323"

_FONT_CACHE = {}
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_ASSETS = os.path.normpath(os.path.join(_SCRIPT_DIR, "..", "assets"))


def find_font(size, bold=False):
    size = int(size) if size else 16
    key = (size, bool(bold))
    if key in _FONT_CACHE:
        return _FONT_CACHE[key]
    candidates = [
        os.environ.get("CCB_FLOW_FONT") or "",
        os.path.join(_ASSETS, "sbdy", "NotoSerifCJKsc-Regular.otf"),
        "/app/assets/sbdy/NotoSerifCJKsc-Regular.otf",
        "/usr/share/fonts/opentype/noto/NotoSerifCJK-{}.ttc".format("Bold" if bold else "Regular"),
        "/usr/share/fonts/opentype/noto/NotoSansCJK-{}.ttc".format("Bold" if bold else "Regular"),
        os.path.join(_ASSETS, "sbdy", "PD4MLNSimSun_27.ttf"),
        os.path.join(_ASSETS, "sbdy", "PD4MLNSimSun_16.ttf"),
        "/app/assets/sbdy/PD4MLNSimSun_27.ttf",
    ]
    for path in candidates:
        if not path or not os.path.isfile(path):
            continue
        try:
            if path.lower().endswith(".ttc"):
                font = ImageFont.truetype(path, size=size, index=0)
            else:
                font = ImageFont.truetype(path, size=size)
            _FONT_CACHE[key] = font
            return font
        except Exception:
            continue
    font = ImageFont.load_default()
    _FONT_CACHE[key] = font
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


def parse_ym(raw):
    s = str(raw or "").strip()
    m = re.match(r"^(\d{4})[-/]?(\d{1,2})$", s)
    if not m:
        return None
    y = int(m.group(1))
    mo = int(m.group(2))
    if mo < 1 or mo > 12:
        return None
    return y, mo


def parse_months(raw, n=N_ROWS):
    """月份列表：['2025-09', ...] 或逗号分隔；对齐 n 行。"""
    if raw is None or raw == "":
        return None
    if isinstance(raw, (list, tuple)):
        items = list(raw)
    else:
        items = re.split(r"[\n,;，；]+", str(raw))
    out = []
    for it in items:
        ym = parse_ym(it)
        if ym:
            out.append(ym)
    if not out:
        return None
    if len(out) < n:
        y, m = out[-1]
        while len(out) < n:
            m += 1
            if m > 12:
                m = 1
                y += 1
            out.append((y, m))
    return out[:n]


def default_months(n=N_ROWS, end_ym=None):
    """默认结束月往前共 n 个月（含结束月）。"""
    if end_ym:
        y, m = end_ym
    else:
        now = datetime.now()
        y, m = now.year, now.month
    items = []
    cy, cm = y, m
    for _ in range(n):
        items.append((cy, cm))
        cm -= 1
        if cm < 1:
            cm = 12
            cy -= 1
    items.reverse()
    return items


def ym_to_trade_date(y, m, day=15):
    # 工资入账日：每月 15 日；若当月无 15 则用月末
    try:
        dt = datetime(y, m, day)
    except ValueError:
        if m == 12:
            dt = datetime(y + 1, 1, 1) - timedelta(days=1)
        else:
            dt = datetime(y, m + 1, 1) - timedelta(days=1)
    return dt.strftime("%Y%m%d")


def text_size(draw, text, font):
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        return bbox[2] - bbox[0], bbox[3] - bbox[1], bbox[1]
    except Exception:
        return int(getattr(font, "size", 14) * max(1, len(text)) * 0.6), getattr(font, "size", 14), 0


def draw_text(draw, xy, text, font, fill=(20, 20, 20), anchor="lt"):
    """简易 anchor：lt/lm/lb/ct/cm/rt/rm。"""
    x, y = xy
    text = str(text or "")
    if not text:
        return
    tw, th, bear = text_size(draw, text, font)
    ax, ay = anchor[0], anchor[1] if len(anchor) > 1 else "t"
    if ax == "c":
        x -= tw / 2
    elif ax == "r":
        x -= tw
    if ay == "m":
        y -= th / 2 + bear
    elif ay == "b":
        y -= th + bear
    else:
        y -= bear
    draw.text((x, y), text, font=font, fill=fill)


def fit_text(draw, text, font_size, max_w, min_size=10, bold=False):
    size = font_size
    font = find_font(size, bold=bold)
    while size > min_size:
        tw, _, _ = text_size(draw, text, font)
        if tw <= max_w:
            return font
        size -= 1
        font = find_font(size, bold=bold)
    return font


def draw_seal(base, cx, cy, radius=118):
    """绘制「中国建设银行股份有限公司 / 业务查询专用章」红圆章。"""
    seal = Image.new("RGBA", (radius * 2 + 8, radius * 2 + 8), (0, 0, 0, 0))
    sd = ImageDraw.Draw(seal)
    ox = oy = radius + 4
    red = (200, 16, 16, 230)
    red_soft = (210, 40, 40, 200)
    sd.ellipse((ox - radius, oy - radius, ox + radius, oy + radius), outline=red, width=5)
    sd.ellipse((ox - radius + 10, oy - radius + 10, ox + radius - 10, oy + radius - 10), outline=red_soft, width=2)

    # 五角星
    def star(cxy, r, rot=-math.pi / 2):
        pts = []
        for i in range(10):
            ang = rot + i * math.pi / 5
            rr = r if i % 2 == 0 else r * 0.4
            pts.append((cxy[0] + rr * math.cos(ang), cxy[1] + rr * math.sin(ang)))
        sd.polygon(pts, fill=red)

    star((ox, oy - 8), 22)

    # 环绕字
    ring = "中国建设银行股份有限公司"
    font_ring = find_font(20, bold=True)
    n = len(ring)
    # 上半环约 200°
    start = -math.pi * 0.92
    end = math.pi * 0.92
    for i, ch in enumerate(ring):
        t = i / max(1, n - 1)
        ang = start + (end - start) * t
        # 文字朝外
        rx = ox + (radius - 28) * math.sin(ang)
        ry = oy - (radius - 28) * math.cos(ang)
        # 单字旋转绘制
        ch_img = Image.new("RGBA", (36, 36), (0, 0, 0, 0))
        cd = ImageDraw.Draw(ch_img)
        cd.text((4, 2), ch, font=font_ring, fill=red)
        rot = -math.degrees(ang)
        ch_rot = ch_img.rotate(rot, expand=True, resample=Image.BICUBIC)
        seal.alpha_composite(ch_rot, (int(rx - ch_rot.width / 2), int(ry - ch_rot.height / 2)))

    font_c = find_font(18, bold=True)
    draw_text(sd, (ox, oy + 28), "业务查询专用章", font_c, fill=red, anchor="ct")
    font_code = find_font(12)
    draw_text(sd, (ox, oy + 52), "036836 JEZKJD", font_code, fill=red, anchor="ct")

    # 轻微透明
    seal.putalpha(seal.split()[-1].point(lambda a: int(a * 0.92) if a else 0))
    base.paste(seal, (int(cx - seal.width / 2), int(cy - seal.height / 2)), seal)


def process(cfg):
    out_path = cfg["out_path"]
    name = str(cfg.get("name") or "").strip() or "客户"
    company = str(cfg.get("company_name") or "").strip()
    account_name = str(cfg.get("account_name") or "").strip() or company or "公司"
    counterparty_account = str(cfg.get("counterparty_account") or DEFAULT_COUNTERPARTY_ACCOUNT).strip()
    counterparty_account = re.sub(r"\s+", "", counterparty_account) or DEFAULT_COUNTERPARTY_ACCOUNT
    card_no = str(cfg.get("card_no") or cfg.get("account_no") or DEFAULT_CARD_NO).strip() or DEFAULT_CARD_NO
    card_no = re.sub(r"\s+", "", card_no)

    amounts = parse_amount_list(cfg.get("amounts") if cfg.get("amounts") is not None else cfg.get("amount"))
    if not amounts:
        amounts = [15002.70] * N_ROWS
    balances = parse_balance_list(cfg.get("balances"), amounts, cfg.get("opening_balance"))
    total_income = parse_money(cfg.get("total_income"), None)
    if total_income is None:
        total_income = round(sum(amounts), 2)

    months = parse_months(cfg.get("months") or cfg.get("trade_months"))
    if not months:
        end = parse_ym(cfg.get("end_month") or cfg.get("tax_to"))
        months = default_months(N_ROWS, end)
    trade_dates = [ym_to_trade_date(y, m) for y, m in months]
    date_start = trade_dates[0]
    date_end = trade_dates[-1]
    # 起止日期展示用区间（可被外部覆盖）
    period = str(cfg.get("period") or "").strip()
    if not period:
        period = "{}-{}".format(date_start, date_end)

    gen_time = str(cfg.get("generated_at") or "").strip()
    if not gen_time:
        gen_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # —— 画布 ——
    im = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(im)

    margin_x = 56
    # 标题
    title = "中国建设银行个人活期账户工资交易明细"
    font_title = find_font(34, bold=True)
    draw_text(draw, (W / 2, 48), title, font_title, fill=(15, 15, 15), anchor="ct")

    font_label = find_font(18)
    font_val = find_font(18)
    font_small = find_font(15)
    y = 110
    # 头信息行 1
    draw_text(draw, (margin_x, y), "卡号/账号：", font_label, fill=(40, 40, 40))
    draw_text(draw, (margin_x + 110, y), card_no, font_val)
    draw_text(draw, (520, y), "客户名称：", font_label, fill=(40, 40, 40))
    draw_text(draw, (620, y), name, font_val)
    draw_text(draw, (860, y), "币种/钞汇：", font_label, fill=(40, 40, 40))
    draw_text(draw, (970, y), "人民币 元 钞", font_val)

    y = 148
    draw_text(draw, (margin_x, y), "起止日期：", font_label, fill=(40, 40, 40))
    draw_text(draw, (margin_x + 110, y), period, font_val)
    draw_text(draw, (520, y), "当前时间段收支金额合计：人民币元", font_small, fill=(40, 40, 40))
    draw_text(draw, (margin_x, y + 32), "总支出：0.00", font_val)
    draw_text(draw, (860, y + 32), "总收入：", font_label, fill=(40, 40, 40))
    income_s = fmt_money(total_income)
    font_income = fit_text(draw, income_s, 20, 220, min_size=14, bold=True)
    draw_text(draw, (950, y + 32), income_s, font_income, fill=(15, 15, 15))

    # 表格
    table_top = 230
    table_left = margin_x
    table_right = W - margin_x
    # 列：序号 / 摘要 / 交易日期 / 交易金额 / 账户余额 / 交易地点/附言 / 对方账号与户名
    col_xs = [table_left, 110, 230, 370, 530, 690, 860, table_right]
    headers = ["序号", "摘要", "交易日期", "交易金额", "账户余额", "交易地点/附言", "对方账号与户名"]
    head_h = 42
    row_h = 48
    table_bottom = table_top + head_h + N_ROWS * row_h

    # 外框与网格
    line = (55, 55, 55)
    draw.rectangle((table_left, table_top, table_right, table_bottom), outline=line, width=2)
    # 表头底线
    draw.line((table_left, table_top + head_h, table_right, table_top + head_h), fill=line, width=1)
    for x in col_xs[1:-1]:
        draw.line((x, table_top, x, table_bottom), fill=line, width=1)
    for i in range(1, N_ROWS):
        yy = table_top + head_h + i * row_h
        draw.line((table_left, yy, table_right, yy), fill=line, width=1)

    font_head = find_font(15, bold=True)
    for i, htxt in enumerate(headers):
        cx = (col_xs[i] + col_xs[i + 1]) / 2
        cy = table_top + head_h / 2
        draw_text(draw, (cx, cy), htxt, font_head, fill=(25, 25, 25), anchor="cm")

    font_cell = find_font(15)
    font_cell_sm = find_font(13)
    co_full = "{}/{}".format(counterparty_account, account_name)

    for i in range(N_ROWS):
        y0 = table_top + head_h + i * row_h
        yc = y0 + row_h / 2
        cells = [
            str(i + 1),
            "银联入账",
            trade_dates[i],
            fmt_money(amounts[i]),
            fmt_money(balances[i]),
            "工资",
            co_full,
        ]
        aligns = ["cm", "cm", "cm", "rm", "rm", "cm", "lm"]
        for ci, txt in enumerate(cells):
            x0, x1 = col_xs[ci], col_xs[ci + 1]
            pad = 8
            max_w = max(12, x1 - x0 - pad * 2)
            fnt = fit_text(draw, txt, 15 if ci < 6 else 13, max_w, min_size=10)
            anc = aligns[ci]
            if anc == "cm":
                draw_text(draw, ((x0 + x1) / 2, yc), txt, fnt, anchor="cm")
            elif anc == "rm":
                draw_text(draw, (x1 - pad, yc), txt, fnt, anchor="rm")
            else:
                draw_text(draw, (x0 + pad, yc), txt, fnt, anchor="lm")

    # 印章叠在表格右上（对方账号列附近）
    seal_cx = (col_xs[5] + col_xs[7]) / 2 + 10
    seal_cy = table_top + head_h + row_h * 2.2
    draw_seal(im, seal_cx, seal_cy, radius=120)

    # 页脚
    fy = table_bottom + 36
    draw_text(draw, (margin_x, fy), "生成时间：" + gen_time, font_small, fill=(50, 50, 50))
    tip1 = "温馨提示：本明细仅供参考，请以银行系统实际记录为准；如有疑问请咨询开户网点或客服热线。"
    tip2 = "本文件为演示生成，非正式银行出具的电子回单。"
    draw_text(draw, (margin_x, fy + 34), tip1, find_font(13), fill=(90, 90, 90))
    draw_text(draw, (margin_x, fy + 58), tip2, find_font(13), fill=(140, 90, 90))
    draw_text(draw, (W / 2, H - 48), "-第1页/共1页-", font_small, fill=(60, 60, 60), anchor="ct")

    im.save(out_path, format="PNG", optimize=True)
    meta = {
        "ok": True,
        "rendered": True,
        "name": name,
        "company_name": company,
        "account_name": account_name,
        "counterparty_account": counterparty_account,
        "card_no": card_no,
        "amounts": amounts,
        "balances": balances,
        "months": ["{}-{:02d}".format(y, m) for y, m in months],
        "trade_dates": trade_dates,
        "period": period,
        "total_income": total_income,
        "rows": N_ROWS,
        "size": [W, H],
    }
    print(json.dumps(meta, ensure_ascii=False))


def main():
    if len(sys.argv) < 2:
        print("usage: ccb_flow_render.py config.json", file=sys.stderr)
        sys.exit(2)
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        cfg = json.load(f)
    process(cfg)


if __name__ == "__main__":
    main()
