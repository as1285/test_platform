import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iPhone 14 Pro Max / 11 收入纳税明细灰缝', () => {
  it('15promax（含 14 Pro Max）汇总用 12px/10px 灰缝，不用 10/6', () => {
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone15promax[\s\S]{0,120}\.top-fixed \.summary[\s\S]{0,80}padding:\s*12px 0 10px\s*!important/
    );
    expect(auth).toMatch(
      /html\.app-ios-iphone15promax\.app-top-safe-shell body\.page-shuiming-result \.top-fixed \.summary\{[^}]*padding:12px 0 10px !important/
    );
    expect(shuimingResult).not.toMatch(
      /html\.app-ios-iphone15promax[\s\S]{0,120}\.top-fixed \.summary[\s\S]{0,80}padding:\s*10px 0 6px/
    );
  });

  it('promax-font 白底规则排除 15promax，并强制灰底', () => {
    expect(auth).toContain(
      'html.app-ios-iphone-promax-font.app-top-safe-shell:not(.app-ios-iphone16pro):not(.app-ios-iphone15promax) body.page-shuiming-result .top-fixed .summary'
    );
    expect(auth).toContain(
      'html.app-ios-iphone15promax.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{background:#f5f6fa !important;padding:12px 0 10px !important;}'
    );
  });

  it('iPhone 11 / 414 宽档保留汇总灰缝，并按盒底起算列表', () => {
    expect(shuimingResult).toContain('isIphone11Seam');
    expect(shuimingResult).toMatch(/isIphone16ProSeam \|\| isIphone11Seam/);
    expect(shuimingResult).toContain('min-device-width: 410px');
    expect(shuimingResult).toContain('max-device-height: 900px');
    expect(auth).toContain(
      'html.app-ios-promax-wide.app-top-safe-shell:not(.app-ios-iphone15promax):not(.app-ios-iphone16promax):not(.app-ios-iphone17promax):not(.app-ios-iphone16pro):not(.app-ios-iphoneair) body.page-shuiming-result .top-fixed .summary{background:#f5f6fa !important;padding:12px 0 10px !important;}'
    );
  });

  it('14 Pro Max / 11 汇总两行白底行高加高', () => {
    expect(shuimingResult).toContain(
      'html.app-ios-iphone15promax body.page-shuiming-result .summary > .summary-item,'
    );
    expect(shuimingResult).toContain(
      'html.app-ios-promax-wide:not(.app-ios-iphone15promax):not(.app-ios-iphone16promax):not(.app-ios-iphone17promax):not(.app-ios-iphone16pro):not(.app-ios-iphoneair) body.page-shuiming-result .summary > .summary-item'
    );
    expect(shuimingResult).toMatch(
      /\.summary > \.summary-item \{[\s\S]{0,120}padding-top:\s*10px\s*!important;[\s\S]{0,40}padding-bottom:\s*12px\s*!important/
    );
    expect(shuimingResult).toMatch(
      /\.summary > \.summary-item:last-of-type[\s\S]{0,200}padding-bottom:\s*10px\s*!important/
    );
  });

  it('14 Pro Max / 11 右侧箭头竖线改短为 7px', () => {
    const shortArrow =
      'html.app-ios-iphone15promax body.page-shuiming-result .list-row-company .list-arrow,html.app-ios-iphone15promax.platform-ios body.page-shuiming-result .list-row-company .list-arrow,html.app-ios-promax-wide:not(.app-ios-iphone15promax):not(.app-ios-iphone16promax):not(.app-ios-iphone17promax):not(.app-ios-iphone16pro):not(.app-ios-iphoneair) body.page-shuiming-result .list-row-company .list-arrow{width:7px !important;height:7px !important;}';
    expect(shuimingResult).toContain('右侧「>」竖线对齐正版，改短');
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone15promax body\.page-shuiming-result \.list-row-company \.list-arrow,[\s\S]{0,400}width:\s*7px\s*!important;[\s\n]*height:\s*7px\s*!important;/
    );
    expect(shuimingResult).toContain(shortArrow);
    expect(auth).toContain(shortArrow);
  });
});

