#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""陕西养老保险缴费证明类图片 · 原图像素级改第2行缴费月份与个人缴费金额。"""
from __future__ import print_function

import json
import os
import re
import sys

import numpy as np
from PIL import Image


def find_hlines(gray, thr=80, min_ratio=0.3):
    dark = (gray < thr).sum(axis=1)
    rows = np.where(dark > gray.shape[1] * min_ratio)[0]
    if len(rows) == 0:
        return []
    groups = []
    start = prev = int(rows[0])
    for r in rows[1:]:
        r = int(r)
        if r - prev > 3:
            groups.append((start + prev) // 2)
            start = r
        prev = r
    groups.append((start + prev) // 2)
    return groups


def find_vlines(gray, y0, y1, thr=80, min_ratio=0.4):
    region = gray[y0:y1, :]
    dark = (region < thr).sum(axis=0)
    cols = np.where(dark > region.shape[0] * min_ratio)[0]
    if len(cols) == 0:
        return []
    groups = []
    start = prev = int(cols[0])
    for c in cols[1:]:
        c = int(c)
        if c - prev > 3:
            groups.append((start + prev) // 2)
            start = c
        prev = c
    groups.append((start + prev) // 2)
    return groups


def detect_table_lines(gray):
    """自适应找表头+两行数据的 4 条横线与竖线。"""
    h_candidates = []
    for thr in (60, 70, 80, 90, 100, 120, 140, 160):
        for mr in (0.12, 0.18, 0.25, 0.3, 0.4):
            hl = find_hlines(gray, thr=thr, min_ratio=mr)
            if len(hl) >= 4:
                h_candidates.append(hl)
    if not h_candidates:
        return None, None

    best = None
    best_score = -1e18
    for hl in h_candidates:
        for i in range(len(hl) - 3):
            win = hl[i : i + 4]
            gaps = [win[j + 1] - win[j] for j in range(3)]
            if min(gaps) < 8:
                continue
            # 两行数据行高应接近；表头行可略不同
            body_sim = -abs(gaps[1] - gaps[2])
            # 表体不能太矮
            if gaps[1] < 12 or gaps[2] < 12:
                continue
            score = body_sim + min(gaps) * 0.05 + (1.0 if gaps[0] >= gaps[1] * 0.5 else 0)
            # 偏好靠图像中部的表格
            mid = (win[0] + win[3]) / 2.0
            score -= abs(mid - gray.shape[0] * 0.45) * 0.01
            if score > best_score:
                best_score = score
                best = win

    if best is None:
        # 回退：默认参数第一条可用序列
        hl0 = find_hlines(gray)
        if len(hl0) >= 4:
            best = hl0[:4]
        else:
            return None, None

    y_h, y_r1, y_r2, y_end = best
    v_best = None
    for thr in (50, 60, 70, 80, 100, 120, 140, 160):
        for mr in (0.08, 0.1, 0.12, 0.15, 0.2, 0.3, 0.4):
            vl = find_vlines(gray, y_h, y_end, thr=thr, min_ratio=mr)
            if len(vl) < 5:
                continue
            # 在候选竖线中挑选 5 条，使「缴费月份」列（第 3 列，0-based index 2）足够宽
            for start in range(0, max(1, len(vl) - 4)):
                main = vl[start : start + 5]
                month_w = main[3] - main[2]
                amt_w = main[4] - main[3]
                if month_w < 36:
                    continue
                # 月份列通常宽于序号/姓名列
                left_w = main[1] - main[0]
                score = month_w + min(amt_w, 200) * 0.25 - abs(month_w - 180) * 0.05
                if month_w > left_w:
                    score += 20
                if v_best is None or score > v_best[0]:
                    v_best = (score, main)

    if v_best is None:
        for thr, mr in ((80, 0.1), (100, 0.1), (80, 0.15), (100, 0.15)):
            vl = find_vlines(gray, y_h, y_end, thr=thr, min_ratio=mr)
            if len(vl) >= 5:
                return best, vl[:5]
        return best, None
    return best, v_best[1]


def cc_boxes(arr, x0, x1, y0, y1, pad=5, thr=145, minpx=20):
    cell = arr[y0:y1, x0:x1]
    H, W = cell.shape[:2]
    if H < 4 or W < 4:
        return []
    gray = cell.mean(axis=2)
    ink = (gray < thr).copy()
    p = max(1, min(pad, H // 6, W // 30))
    ink[:p, :] = False
    ink[-p:, :] = False
    ink[:, :p] = False
    ink[:, -p:] = False
    visited = np.zeros_like(ink, dtype=bool)
    boxes = []
    for y in range(H):
        for x in range(W):
            if not ink[y, x] or visited[y, x]:
                continue
            stack = [(y, x)]
            visited[y, x] = True
            xs, ys = [], []
            while stack:
                cy, cx = stack.pop()
                xs.append(cx)
                ys.append(cy)
                for dy, dx in (
                    (0, 1),
                    (0, -1),
                    (1, 0),
                    (-1, 0),
                    (1, 1),
                    (1, -1),
                    (-1, 1),
                    (-1, -1),
                ):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and ink[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        stack.append((ny, nx))
            if len(xs) < minpx:
                continue
            boxes.append([min(xs), min(ys), max(xs), max(ys)])
    boxes.sort(key=lambda b: b[0])
    return boxes


def _box_w(b):
    return b[2] - b[0] + 1


def _box_h(b):
    return b[3] - b[1] + 1


def split_wide_box(arr, x0, y0, box, thr=145, parts=2):
    """把粘连的宽字形按垂直投影切成 parts 份。"""
    bx0, by0, bx1, by1 = box
    cell = arr[y0 + by0 : y0 + by1 + 1, x0 + bx0 : x0 + bx1 + 1]
    if cell.size == 0:
        return [box]
    gray = cell.mean(axis=2)
    ink = gray < thr
    col = ink.sum(axis=0).astype(np.float64)
    if col.sum() < 1 or parts < 2:
        return [box]
    # 在中间区域找投影谷，切成 parts
    w = len(col)
    cuts = []
    for k in range(1, parts):
        lo = int(w * (k / float(parts)) - w * 0.18)
        hi = int(w * (k / float(parts)) + w * 0.18)
        lo = max(2, lo)
        hi = min(w - 2, hi)
        if hi <= lo:
            cuts.append(int(w * k / float(parts)))
            continue
        seg = col[lo:hi]
        cuts.append(lo + int(np.argmin(seg)))
    cuts = [0] + cuts + [w]
    out = []
    for i in range(len(cuts) - 1):
        a, b = cuts[i], cuts[i + 1] - 1
        if b <= a:
            continue
        sub = ink[:, a : b + 1]
        ys = np.where(sub.any(axis=1))[0]
        xs = np.where(sub.any(axis=0))[0]
        if len(ys) == 0 or len(xs) == 0:
            continue
        out.append(
            [
                bx0 + a + int(xs[0]),
                by0 + int(ys[0]),
                bx0 + a + int(xs[-1]),
                by0 + int(ys[-1]),
            ]
        )
    return out if out else [box]


def projection_digit_boxes(arr, x0, x1, y0, y1, expect=12, thr=145):
    """连通域失败时：在墨迹水平跨度上均分 expect 个数字槽位。"""
    cell = arr[y0:y1, x0:x1]
    H, W = cell.shape[:2]
    if H < 4 or W < 4:
        return []
    gray = cell.mean(axis=2)
    ink = gray < thr
    pad = max(1, min(4, H // 8, W // 40))
    ink[:pad, :] = False
    ink[-pad:, :] = False
    ink[:, :pad] = False
    ink[:, -pad:] = False
    rows = np.where(ink.any(axis=1))[0]
    cols = np.where(ink.any(axis=0))[0]
    if len(rows) == 0 or len(cols) == 0:
        return []
    ry0, ry1 = int(rows[0]), int(rows[-1])
    cx0, cx1 = int(cols[0]), int(cols[-1])
    span = cx1 - cx0 + 1
    if span < expect * 3:
        return []
    # 检测中间空隙（连字符位置），左右各 6 位
    colsum = ink[ry0 : ry1 + 1, cx0 : cx1 + 1].sum(axis=0)
    mid = span // 2
    gap_lo = max(0, mid - span // 6)
    gap_hi = min(span, mid + span // 6)
    gap_rel = gap_lo + int(np.argmin(colsum[gap_lo:gap_hi])) if gap_hi > gap_lo else mid
    # 若中间有明显空隙，按左右两段各 6 槽；否则整段 12 槽
    use_gap = colsum[gap_rel] <= max(1.0, colsum.max() * 0.15)
    boxes = []
    if use_gap and gap_rel > expect and (span - gap_rel) > expect:
        left = (cx0, cx0 + gap_rel - 1)
        right = (cx0 + gap_rel + 1, cx1)
        for side_x0, side_x1 in (left, right):
            sw = side_x1 - side_x0 + 1
            for i in range(6):
                a = side_x0 + int(i * sw / 6.0)
                b = side_x0 + int((i + 1) * sw / 6.0) - 1
                if b < a:
                    b = a
                boxes.append([a, ry0, b, ry1])
    else:
        for i in range(expect):
            a = cx0 + int(i * span / float(expect))
            b = cx0 + int((i + 1) * span / float(expect)) - 1
            if b < a:
                b = a
            boxes.append([a, ry0, b, ry1])
    return boxes[:expect]


def normalize_digit_boxes(arr, x0, x1, y0, y1, expect=12):
    """多策略找出 expect 个数字框（忽略连字符）。"""
    cell_h = max(1, y1 - y0)
    cell_w = max(1, x1 - x0)
    trials = []
    for thr in (120, 135, 145, 155, 165, 180, 200):
        for minpx in (8, 12, 16, 20, 28):
            for pad in (2, 3, 5, 8):
                if pad * 2 >= cell_h or pad * 2 >= cell_w:
                    continue
                boxes = cc_boxes(arr, x0, x1, y0, y1, pad=pad, thr=thr, minpx=minpx)
                if boxes:
                    trials.append((thr, boxes))

    def refine(thr, boxes):
        boxes = [b[:] for b in boxes]
        # 去掉过小噪点
        med_h = float(np.median([_box_h(b) for b in boxes])) if boxes else 1
        boxes = [b for b in boxes if _box_h(b) >= med_h * 0.35 and _box_w(b) >= 2]
        if not boxes:
            return []
        med_w = float(np.median([_box_w(b) for b in boxes]))
        # 拆开明显粘连（宽度 >= 1.7 中位宽）
        split = []
        for b in boxes:
            w = _box_w(b)
            if w >= med_w * 1.7 and w >= 12:
                nparts = int(round(w / max(med_w, 1)))
                nparts = max(2, min(4, nparts))
                split.extend(split_wide_box(arr, x0, y0, b, thr=thr, parts=nparts))
            else:
                split.append(b)
        split.sort(key=lambda b: b[0])
        # 多余框：优先丢掉中间细长的连字符/噪点
        while len(split) > expect:
            # 找最像连字符的：偏矮或偏窄，且靠近中位 x
            xs = [ (b[0] + b[2]) / 2.0 for b in split ]
            mid_x = (xs[0] + xs[-1]) / 2.0
            def hyphen_score(i):
                b = split[i]
                return (_box_w(b) / max(_box_h(b), 1)) * 2 + abs(xs[i] - mid_x) * 0.01 + _box_h(b) * 0.05
            drop = min(range(len(split)), key=hyphen_score)
            # 若最矮的明显更矮，优先丢最矮
            heights = [_box_h(b) for b in split]
            if min(heights) <= max(1, np.median(heights) * 0.55):
                drop = int(np.argmin(heights))
            split.pop(drop)
        # 仍不足则尝试再拆最宽的
        guard = 0
        while len(split) < expect and guard < 8:
            guard += 1
            wi = max(range(len(split)), key=lambda i: _box_w(split[i]))
            parts = split_wide_box(arr, x0, y0, split[wi], thr=thr, parts=2)
            if len(parts) < 2:
                break
            split = split[:wi] + parts + split[wi + 1 :]
            split.sort(key=lambda b: b[0])
            while len(split) > expect:
                heights = [_box_h(b) for b in split]
                split.pop(int(np.argmin(heights)))
        return split if len(split) >= expect else split

    best = []
    for thr, boxes in trials:
        got = refine(thr, boxes)
        if len(got) >= expect:
            return got[:expect]
        if len(got) > len(best):
            best = got

    # 投影均分兜底
    for thr in (130, 145, 160, 180, 200):
        proj = projection_digit_boxes(arr, x0, x1, y0, y1, expect=expect, thr=thr)
        if len(proj) >= expect:
            return proj[:expect]

    return best


def paste_across(arr, src, donor_origin, donor_box, target_origin, target_box):
    pad = 1
    dx0, dy0, dx1, dy1 = donor_box
    dox, doy = donor_origin
    y0p = max(0, doy + dy0 - pad)
    y1p = min(src.shape[0], doy + dy1 + 1 + pad)
    x0p = max(0, dox + dx0 - pad)
    x1p = min(src.shape[1], dox + dx1 + 1 + pad)
    if y1p <= y0p or x1p <= x0p:
        return
    patch = src[y0p:y1p, x0p:x1p].copy()
    tx0, ty0, tx1, ty1 = target_box
    tox, toy = target_origin
    target_bottom = toy + ty1
    target_cx = tox + (tx0 + tx1) / 2.0
    ph, pw = patch.shape[:2]
    donor_bottom_in_patch = (doy + dy1) - y0p
    paste_y = int(target_bottom - donor_bottom_in_patch)
    paste_x = int(round(target_cx - pw / 2.0))
    if paste_y < 0 or paste_x < 0:
        return
    if paste_y + ph > arr.shape[0] or paste_x + pw > arr.shape[1]:
        return
    roi = arr[paste_y : paste_y + ph, paste_x : paste_x + pw].copy()
    mask = patch.mean(axis=2) < 200
    roi[mask] = patch[mask]
    arr[paste_y : paste_y + ph, paste_x : paste_x + pw] = roi


def normalize_ym6(raw):
    s = str(raw or '').strip().replace('/', '').replace('.', '')
    m = re.match(r'^(\d{4})-?(\d{1,2})$', s)
    if m:
        return m.group(1) + str(int(m.group(2))).zfill(2)
    s = re.sub(r'\D', '', s)
    if len(s) == 6:
        return s
    raise RuntimeError('月份格式无效：' + str(raw))


def edit_month_amount(arr, src, month_start, month_end, amount):
    gray = arr.mean(axis=2)
    hlines, vlines = detect_table_lines(gray)
    if not hlines:
        # 兼容旧逻辑
        hlines = find_hlines(gray)
        if len(hlines) >= 4:
            hlines = hlines[:4]
    if not hlines or len(hlines) < 4:
        raise RuntimeError('无法识别表格横线（需表头+至少两行数据）')
    y_h, y_r1, y_r2, y_end = int(hlines[0]), int(hlines[1]), int(hlines[2]), int(hlines[3])
    if not vlines or len(vlines) < 5:
        vlines = find_vlines(gray, y_h, y_end)
    if not vlines or len(vlines) < 5:
        raise RuntimeError('无法识别表格竖线')
    mx0, mx1 = int(vlines[2]), int(vlines[3])
    ax0, ax1 = int(vlines[3]), int(vlines[4])

    month_start = normalize_ym6(month_start)
    month_end = normalize_ym6(month_end)
    target12 = month_start + month_end
    amount = str(amount).strip()
    if not amount.isdigit():
        raise RuntimeError('个人缴费金额须为数字')

    # Original layout assumed: 202601-202603 (12 digit glyphs, hyphen ignored by CC)
    boxes = normalize_digit_boxes(arr, mx0, mx1, y_r2, y_end, expect=12)
    if len(boxes) < 12:
        # 再试第 1 行月份作几何参考（有些图第 2 行更糊）
        boxes_r1_try = normalize_digit_boxes(arr, mx0, mx1, y_r1, y_r2, expect=12)
        if len(boxes_r1_try) >= 12:
            # 把第 1 行框映射到第 2 行 y 范围
            boxes = []
            for b in boxes_r1_try[:12]:
                boxes.append([b[0], 2, b[2], (y_end - y_r2) - 3])
        else:
            raise RuntimeError(
                '缴费月份识别失败（字形不足 12 个，仅识别到 %d 个；请上传更清晰的原表图）'
                % len(boxes)
            )

    # Digit bank: original first half + second half + row1 months
    bank = {}
    src_boxes = normalize_digit_boxes(src, mx0, mx1, y_r2, y_end, expect=12)
    if len(src_boxes) < 12:
        src_boxes = boxes
    for i, ch in enumerate('202601'):
        if i < len(src_boxes):
            bank.setdefault(ch, ('m2', src_boxes[i]))
    for i, ch in enumerate('202603'):
        j = 6 + i
        if j < len(src_boxes):
            bank.setdefault(ch, ('m2', src_boxes[j]))
    boxes_r1m = normalize_digit_boxes(arr, mx0, mx1, y_r1, y_r2, expect=12)
    if len(boxes_r1m) >= 12:
        for i, ch in enumerate('202507202512'):
            bank.setdefault(ch, ('m1', boxes_r1m[i]))

    def donor_for(ch):
        hit = bank.get(ch)
        if not hit:
            # 回退：用任意已识别数字框
            for alt in '0123456789':
                if alt in bank:
                    hit = bank[alt]
                    break
        if not hit:
            hit = ('m2', boxes[0])
        kind, box = hit
        if kind == 'm1':
            return (mx0, y_r1), box
        return (mx0, y_r2), box

    # Clear left/right digit bands separately to preserve the hyphen between halves
    for lo, hi in ((0, 5), (6, 11)):
        clear_x0 = mx0 + boxes[lo][0] - 3
        clear_x1 = mx0 + boxes[hi][2] + 4
        clear_y0 = y_r2 + min(b[1] for b in boxes[lo : hi + 1]) - 3
        clear_y1 = y_r2 + max(b[3] for b in boxes[lo : hi + 1]) + 4
        clear_x0 = max(0, clear_x0)
        clear_y0 = max(0, clear_y0)
        clear_x1 = min(arr.shape[1], clear_x1)
        clear_y1 = min(arr.shape[0], clear_y1)
        arr[clear_y0:clear_y1, clear_x0:clear_x1] = 255

    for i, ch in enumerate(target12):
        d_origin, d_box = donor_for(ch)
        paste_across(arr, src, d_origin, d_box, (mx0, y_r2), boxes[i])

    # Amount: prefer copy digits from row1 amount (often 2232)
    r1_amt = normalize_digit_boxes(arr, ax0, ax1, y_r1, y_r2, expect=4)
    if len(r1_amt) < 4:
        r1_amt = cc_boxes(arr, ax0, ax1, y_r1, y_r2, pad=3, thr=145, minpx=10)
    r2_amt = normalize_digit_boxes(src, ax0, ax1, y_r2, y_end, expect=max(4, len(amount)))
    if len(r2_amt) < 1:
        r2_amt = cc_boxes(src, ax0, ax1, y_r2, y_end, pad=3, thr=145, minpx=10)
    if not r2_amt:
        r2_amt = cc_boxes(arr, ax0, ax1, y_r2, y_end, pad=3, thr=160, minpx=8)
    if not r2_amt:
        raise RuntimeError('个人缴费单元格识别失败')

    r1_digit_boxes = {}
    if len(r1_amt) >= 4:
        for i, ch in enumerate('2232'):
            if i < len(r1_amt):
                r1_digit_boxes[ch] = r1_amt[i]

    span_x0 = r2_amt[0][0]
    span_x1 = r2_amt[-1][2]
    span_y0 = min(b[1] for b in r2_amt)
    span_y1 = max(b[3] for b in r2_amt)

    r2x0 = max(0, ax0 + span_x0 - 3)
    r2y0 = max(0, y_r2 + span_y0 - 3)
    r2x1 = min(arr.shape[1], ax0 + span_x1 + 4)
    r2y1 = min(arr.shape[0], y_r2 + span_y1 + 4)
    arr[r2y0:r2y1, r2x0:r2x1] = 255

    n = len(amount)
    for i, ch in enumerate(amount):
        if ch in r1_digit_boxes:
            d_origin, d_box = (ax0, y_r1), r1_digit_boxes[ch]
        else:
            d_origin, d_box = donor_for(ch)
        tx0 = span_x0 + int(i * (span_x1 - span_x0 + 1) / n)
        tx1 = span_x0 + int((i + 1) * (span_x1 - span_x0 + 1) / n) - 2
        paste_across(
            arr,
            src,
            d_origin,
            d_box,
            (ax0, y_r2),
            [tx0, span_y0, tx1, span_y1],
        )

    return {
        'month': month_start + '-' + month_end,
        'amount': amount,
        'table_y': [int(y_h), int(y_r1), int(y_r2), int(y_end)],
        'digit_boxes': len(boxes),
    }


def process(image_path, out_path, fields):
    img = Image.open(image_path).convert('RGB')
    arr = np.array(img)
    src = arr.copy()
    meta = edit_month_amount(
        arr,
        src,
        fields.get('month_start') or '202601',
        fields.get('month_end') or '202606',
        fields.get('amount') or '2232',
    )
    Image.fromarray(arr).save(out_path, optimize=True)
    return meta


def main():
    if len(sys.argv) < 2:
        print('usage: ylbx_pixel_edit.py in.json', file=sys.stderr)
        sys.exit(2)
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)
    meta = process(data['image_path'], data['out_path'], data)
    print(json.dumps({'ok': True, 'meta': meta}, ensure_ascii=False))


if __name__ == '__main__':
    main()
