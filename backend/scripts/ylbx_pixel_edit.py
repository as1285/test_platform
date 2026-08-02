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


def cc_boxes(arr, x0, x1, y0, y1, pad=5, thr=145, minpx=20):
    cell = arr[y0:y1, x0:x1]
    H, W = cell.shape[:2]
    gray = cell.mean(axis=2)
    ink = (gray < thr).copy()
    ink[:pad, :] = False
    ink[-pad:, :] = False
    ink[:, :pad] = False
    ink[:, -pad:] = False
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


def paste_across(arr, src, donor_origin, donor_box, target_origin, target_box):
    pad = 1
    dx0, dy0, dx1, dy1 = donor_box
    dox, doy = donor_origin
    patch = src[doy + dy0 - pad : doy + dy1 + 1 + pad, dox + dx0 - pad : dox + dx1 + 1 + pad].copy()
    tx0, ty0, tx1, ty1 = target_box
    tox, toy = target_origin
    target_bottom = toy + ty1
    target_cx = tox + (tx0 + tx1) / 2.0
    ph, pw = patch.shape[:2]
    donor_bottom_in_patch = dy1 - (dy0 - pad)
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
    hlines = find_hlines(gray)
    if len(hlines) < 4:
        raise RuntimeError('无法识别表格横线（需表头+至少两行数据）')
    y_h, y_r1, y_r2, y_end = hlines[0], hlines[1], hlines[2], hlines[3]
    vlines = find_vlines(gray, y_h, y_end)
    if len(vlines) < 5:
        raise RuntimeError('无法识别表格竖线')
    mx0, mx1 = vlines[2], vlines[3]
    ax0, ax1 = vlines[3], vlines[4]

    month_start = normalize_ym6(month_start)
    month_end = normalize_ym6(month_end)
    target12 = month_start + month_end
    amount = str(amount).strip()
    if not amount.isdigit():
        raise RuntimeError('个人缴费金额须为数字')

    # Original layout assumed: 202601-202603 (12 digit glyphs, hyphen ignored by CC)
    boxes = cc_boxes(arr, mx0, mx1, y_r2, y_end)
    if len(boxes) < 12:
        raise RuntimeError('缴费月份识别失败（字形不足 12 个）')

    # Digit bank: original first half 202601 + second half 202603 + row1 months
    bank = {}
    for i, ch in enumerate('202601'):
        bank.setdefault(ch, ('m2', boxes[i]))
    for i, ch in enumerate('202603'):
        bank.setdefault(ch, ('m2', boxes[6 + i]))
    boxes_r1m = cc_boxes(arr, mx0, mx1, y_r1, y_r2)
    if len(boxes_r1m) >= 12:
        for i, ch in enumerate('202507202512'):
            bank.setdefault(ch, ('m1', boxes_r1m[i]))

    def donor_for(ch):
        hit = bank.get(ch)
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
        arr[clear_y0:clear_y1, clear_x0:clear_x1] = 255

    for i, ch in enumerate(target12):
        d_origin, d_box = donor_for(ch)
        paste_across(arr, src, d_origin, d_box, (mx0, y_r2), boxes[i])

    # Amount: prefer copy digits from row1 amount (often 2232)
    r1_amt = cc_boxes(arr, ax0, ax1, y_r1, y_r2)
    r2_amt = cc_boxes(src, ax0, ax1, y_r2, y_end)  # original slots from src
    if not r2_amt:
        r2_amt = cc_boxes(arr, ax0, ax1, y_r2, y_end)
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

    r2x0 = ax0 + span_x0 - 3
    r2y0 = y_r2 + span_y0 - 3
    r2x1 = ax0 + span_x1 + 4
    r2y1 = y_r2 + span_y1 + 4
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
