#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""建设银行工资交易明细：按数据完整绘制 PNG（非原图 PS）。"""
from __future__ import print_function

import json
import math
import os
import random
import re
import sys
from datetime import datetime, timedelta

from PIL import Image, ImageDraw, ImageFont

# 接近 A4 截图比例的清晰画布
W = 1240
H = 1754
N_ROWS = 12
MAX_ROWS = 36
DEFAULT_COUNTERPARTY_ACCOUNT = "140500616296"
DEFAULT_CARD_NO = "6217002740035379323"
_RANGE_RE = re.compile(r"^\s*([\d,，.]+)\s*[-~～—–到至]+\s*([\d,，.]+)\s*$")

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


def parse_range_pair(raw):
    """解析工资区间：15000-18000 / 15000~18000 / 1.5万-1.8万 不支持，仅数字。"""
    if raw is None:
        return None
    if isinstance(raw, (list, tuple)):
        if len(raw) >= 2:
            lo = parse_money(raw[0])
            hi = parse_money(raw[1])
            if lo is None or hi is None:
                return None
            if hi < lo:
                lo, hi = hi, lo
            return lo, hi
        return None
    s = str(raw).strip()
    if not s:
        return None
    m = _RANGE_RE.match(s)
    if not m:
        return None
    lo = parse_money(m.group(1))
    hi = parse_money(m.group(2))
    if lo is None or hi is None:
        return None
    if hi < lo:
        lo, hi = hi, lo
    return lo, hi


def random_amounts(n, lo, hi, rng=None):
    n = max(1, int(n or 1))
    lo = float(lo)
    hi = float(hi) if hi is not None else lo
    if hi < lo:
        lo, hi = hi, lo
    rng = rng or random.Random()
    if hi <= lo:
        v = round(lo, 2)
        return [v] * n
    out = []
    for _ in range(n):
        out.append(round(lo + rng.random() * (hi - lo), 2))
    return out


def parse_amount_list(raw, n=N_ROWS):
    if raw is None:
        return None
    if isinstance(raw, (list, tuple)):
        if len(raw) == 1:
            pair = parse_range_pair(raw[0])
            if pair:
                return random_amounts(n, pair[0], pair[1])
        vals = [parse_money(x) for x in raw]
    else:
        s = str(raw).strip()
        if not s:
            return None
        pair = parse_range_pair(s)
        if pair:
            return random_amounts(n, pair[0], pair[1])
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


def resolve_amounts(cfg, n, rng=None):
    """优先精确列表；否则工资下限/上限区间（上限空则每月固定）。"""
    raw_list = cfg.get("amounts") if cfg.get("amounts") is not None else cfg.get("amount")
    pair = parse_range_pair(raw_list) if not isinstance(raw_list, (list, tuple)) else None
    if isinstance(raw_list, (list, tuple)) and len(raw_list) >= 2:
        parsed = parse_amount_list(raw_list, n)
        if parsed:
            return parsed
    elif raw_list not in (None, "") and not pair:
        parsed = parse_amount_list(raw_list, n)
        if parsed:
            return parsed
    lo = parse_money(cfg.get("amount_min") or cfg.get("salary_min"))
    hi = parse_money(cfg.get("amount_max") or cfg.get("salary_max"))
    if pair:
        lo, hi = pair
    if lo is None and hi is None:
        return None
    if lo is None:
        lo = hi
    if hi is None:
        hi = lo
    return random_amounts(n, lo, hi, rng=rng)


def parse_balance_list(raw, amounts, opening):
    n = max(1, len(amounts) if amounts else N_ROWS)
    explicit = parse_amount_list(raw, n) if raw not in (None, "") else None
    if explicit:
        return explicit[:n]
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


def parse_months(raw, n=None):
    """月份列表：['2025-09', ...] 或逗号分隔。n 为空则按列表长度，不强制 12 行。"""
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
    if n is None:
        return out[:MAX_ROWS]
    n = max(1, min(int(n), MAX_ROWS))
    if len(out) < n:
        y, m = out[-1]
        while len(out) < n:
            m += 1
            if m > 12:
                m = 1
                y += 1
            out.append((y, m))
    return out[:n]


def months_in_range(start_ym, end_ym, max_n=MAX_ROWS):
    """含起止月的连续月份。"""
    start = parse_ym(start_ym) if not isinstance(start_ym, tuple) else start_ym
    end = parse_ym(end_ym) if not isinstance(end_ym, tuple) else end_ym
    if not start or not end:
        return None
    sy, sm = start
    ey, em = end
    sidx = sy * 12 + sm
    eidx = ey * 12 + em
    if sidx > eidx:
        sidx, eidx = eidx, sidx
    if eidx - sidx + 1 > max_n:
        sidx = eidx - max_n + 1
    items = []
    idx = sidx
    while idx <= eidx:
        y = idx // 12
        m = idx - y * 12
        if m == 0:
            m = 12
            y -= 1
        items.append((y, m))
        idx += 1
    return items


def default_months(n=N_ROWS, end_ym=None):
    """默认结束月往前共 n 个月（含结束月）。"""
    n = max(1, min(int(n or N_ROWS), MAX_ROWS))
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


def resolve_months(cfg):
    months = parse_months(cfg.get("months") or cfg.get("trade_months"), n=None)
    if months:
        return months[:MAX_ROWS]
    start = cfg.get("start_month") or cfg.get("tax_from")
    end = cfg.get("end_month") or cfg.get("tax_to")
    ranged = months_in_range(start, end)
    if ranged:
        return ranged
    end_only = parse_ym(end)
    return default_months(N_ROWS, end_only)


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


def parse_trade_date(raw):
    """解析 YYYY-MM-DD / YYYYMMDD / YYYY/MM/DD → YYYYMMDD。"""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    s = s.replace("/", "-").replace(".", "-")
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return datetime(y, mo, d).strftime("%Y%m%d")
        except ValueError:
            return None
    m2 = re.match(r"^(\d{8})$", s)
    if m2:
        try:
            return datetime.strptime(s, "%Y%m%d").strftime("%Y%m%d")
        except ValueError:
            return None
    return None


def parse_expenses(raw, fallback_months=None):
    """支出项列表：[{date, amount, summary, memo, counterparty}, ...]"""
    if raw is None or raw == "":
        return []
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return []
        try:
            raw = json.loads(s)
        except Exception:
            return []
    if not isinstance(raw, (list, tuple)):
        return []
    out = []
    fb = list(fallback_months or [])
    for i, item in enumerate(raw):
        if item is None:
            continue
        if isinstance(item, (int, float)):
            amt = float(item)
            date_s = None
            summary = "转账支出"
            memo = "消费"
            party = ""
        elif isinstance(item, dict):
            amt = parse_money(item.get("amount") or item.get("money") or item.get("value"))
            date_s = parse_trade_date(
                item.get("date") or item.get("trade_date") or item.get("交易日期")
            )
            summary = str(item.get("summary") or item.get("摘要") or "转账支出").strip() or "转账支出"
            memo = str(
                item.get("memo")
                or item.get("note")
                or item.get("postscript")
                or item.get("附言")
                or "消费"
            ).strip() or "消费"
            party = str(
                item.get("counterparty")
                or item.get("counterparty_name")
                or item.get("对方")
                or ""
            ).strip()
        else:
            continue
        if amt is None or amt <= 0:
            continue
        amt = round(float(amt), 2)
        if not date_s:
            if i < len(fb):
                y, m = fb[i]
                date_s = ym_to_trade_date(y, m, day=20)
            elif fb:
                y, m = fb[-1]
                date_s = ym_to_trade_date(y, m, day=20)
            else:
                date_s = datetime.now().strftime("%Y%m%d")
        out.append(
            {
                "date": date_s,
                "amount": amt,
                "summary": summary,
                "memo": memo,
                "counterparty": party,
            }
        )
    return out[:MAX_ROWS]


def build_transactions(months, amounts, expenses, counterparty_account, account_name):
    """合并工资收入与支出，按日期排序；余额在外层计算。"""
    rows = []
    co_income = "{}/{}".format(counterparty_account, account_name)
    n = min(len(months), len(amounts))
    for i in range(n):
        y, m = months[i]
        rows.append(
            {
                "kind": "income",
                "date": ym_to_trade_date(y, m),
                "amount": round(float(amounts[i]), 2),
                "summary": "银联入账",
                "memo": "工资",
                "counterparty": co_income,
            }
        )
    for exp in expenses or []:
        party = str(exp.get("counterparty") or "").strip()
        rows.append(
            {
                "kind": "expense",
                "date": exp["date"],
                "amount": round(float(exp["amount"]), 2),
                "summary": exp.get("summary") or "转账支出",
                "memo": exp.get("memo") or "消费",
                "counterparty": party,
            }
        )
    rows.sort(key=lambda r: (r["date"], 0 if r["kind"] == "income" else 1, r["amount"]))
    if len(rows) > MAX_ROWS:
        rows = rows[:MAX_ROWS]
    return rows


def apply_balances(rows, opening):
    open_bal = parse_money(opening, 7415.60)
    run = open_bal
    balances = []
    for r in rows:
        if r["kind"] == "expense":
            run = round(run - float(r["amount"]), 2)
        else:
            run = round(run + float(r["amount"]), 2)
        balances.append(run)
    return balances


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

    amounts = None
    months = resolve_months(cfg)
    n_rows = max(1, min(len(months), MAX_ROWS))
    months = months[:n_rows]
    rng = None
    seed = cfg.get("amount_seed")
    if seed not in (None, ""):
        try:
            rng = random.Random(int(seed))
        except Exception:
            rng = random.Random(str(seed))
    amounts = resolve_amounts(cfg, n_rows, rng=rng)
    if not amounts:
        amounts = [15002.70] * n_rows
    amounts = amounts[:n_rows]
    if len(amounts) < n_rows:
        amounts = amounts + [amounts[-1]] * (n_rows - len(amounts))

    expenses = parse_expenses(cfg.get("expenses") or cfg.get("expense_items"), fallback_months=months)
    txns = build_transactions(months, amounts, expenses, counterparty_account, account_name)
    n_rows = max(1, min(len(txns), MAX_ROWS))
    txns = txns[:n_rows]

    balances = None
    if cfg.get("balances") not in (None, ""):
        # 显式余额仅在无支出且行数匹配时使用；否则重算
        if not expenses:
            balances = parse_balance_list(cfg.get("balances"), amounts, cfg.get("opening_balance"))
            if balances and len(balances) == n_rows:
                pass
            else:
                balances = None
    if balances is None:
        balances = apply_balances(txns, cfg.get("opening_balance"))

    total_income = parse_money(cfg.get("total_income"), None)
    if total_income is None:
        total_income = round(sum(r["amount"] for r in txns if r["kind"] == "income"), 2)
    total_expense = parse_money(cfg.get("total_expense") or cfg.get("total_expenditure"), None)
    if total_expense is None:
        total_expense = round(sum(r["amount"] for r in txns if r["kind"] == "expense"), 2)

    trade_dates = [r["date"] for r in txns]
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
    table_top = 230
    head_h = 42
    row_h = 48
    table_bottom = table_top + head_h + n_rows * row_h
    canvas_h = max(H, table_bottom + 200)
    im = Image.new("RGB", (W, canvas_h), (255, 255, 255))
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
    expense_s = fmt_money(total_expense)
    draw_text(draw, (margin_x, y + 32), "总支出：" + expense_s, font_val)
    draw_text(draw, (860, y + 32), "总收入：", font_label, fill=(40, 40, 40))
    income_s = fmt_money(total_income)
    font_income = fit_text(draw, income_s, 20, 220, min_size=14, bold=True)
    draw_text(draw, (950, y + 32), income_s, font_income, fill=(15, 15, 15))

    # 表格
    table_left = margin_x
    table_right = W - margin_x
    # 列：序号 / 摘要 / 交易日期 / 交易金额 / 账户余额 / 交易地点/附言 / 对方账号与户名
    col_xs = [table_left, 110, 230, 370, 530, 690, 860, table_right]
    headers = ["序号", "摘要", "交易日期", "交易金额", "账户余额", "交易地点/附言", "对方账号与户名"]

    # 外框与网格
    line = (55, 55, 55)
    draw.rectangle((table_left, table_top, table_right, table_bottom), outline=line, width=2)
    # 表头底线
    draw.line((table_left, table_top + head_h, table_right, table_top + head_h), fill=line, width=1)
    for x in col_xs[1:-1]:
        draw.line((x, table_top, x, table_bottom), fill=line, width=1)
    for i in range(1, n_rows):
        yy = table_top + head_h + i * row_h
        draw.line((table_left, yy, table_right, yy), fill=line, width=1)

    font_head = find_font(15, bold=True)
    for i, htxt in enumerate(headers):
        cx = (col_xs[i] + col_xs[i + 1]) / 2
        cy = table_top + head_h / 2
        draw_text(draw, (cx, cy), htxt, font_head, fill=(25, 25, 25), anchor="cm")

    font_cell = find_font(15)
    font_cell_sm = find_font(13)

    for i in range(n_rows):
        y0 = table_top + head_h + i * row_h
        yc = y0 + row_h / 2
        txn = txns[i]
        # 支出金额显示为负数，便于区分方向
        amt_disp = -txn["amount"] if txn["kind"] == "expense" else txn["amount"]
        cells = [
            str(i + 1),
            txn["summary"],
            txn["date"],
            fmt_money(amt_disp),
            fmt_money(balances[i]),
            txn["memo"],
            txn["counterparty"],
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
    draw_text(draw, (W / 2, canvas_h - 48), "-第1页/共1页-", font_small, fill=(60, 60, 60), anchor="ct")

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
        "expenses": expenses,
        "period": period,
        "total_income": total_income,
        "total_expense": total_expense,
        "rows": n_rows,
        "size": [W, canvas_h],
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
