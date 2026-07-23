#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 Noto Serif CJK TTC 抽取简体（SC）单字库。"""
import sys

from fontTools.ttLib import TTCollection


def main():
    if len(sys.argv) < 3:
        print('usage: sbdy_extract_cjk_font.py <in.ttc> <out.otf>', file=sys.stderr)
        return 2
    src, out = sys.argv[1], sys.argv[2]
    ttc = TTCollection(src)
    face = ttc.fonts[2]  # JP=0 KR=1 SC=2 TC=3 HK=4
    face.flavor = None
    face.save(out)
    print('cached font', out)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
