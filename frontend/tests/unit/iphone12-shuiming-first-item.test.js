import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iPhone 12 纳税明细首条不被汇总挡住', () => {
  it('isIPhone13Client 不把 iPhone13,2（12）当成 13', () => {
    expect(auth).toContain('iPhone13,[1-4]');
    expect(auth).toMatch(/iPhone\\s\*13\\b\(\?!\[\\d,\]\)/);
    const fn = auth.match(
      /function isIPhone13Client\(\) \{[\s\S]*?\n  \}/
    );
    expect(fn && fn[0]).toBeTruthy();
    expect(fn[0]).toContain('iPhone13,[1-4]');
    expect(fn[0]).not.toMatch(/if \(\/iPhone\\s\*13\\b\|iPhone14,5\\b\/i\.test\(blob\)\)/);
  });

  it('结果页首屏打 iPhone 12 标并抬高列表顶距、汇总灰底', () => {
    expect(shuimingResult).toContain('data-iphone12-result-firstpaint');
    expect(shuimingResult).toContain('app-ios-iphone12pro');
    expect(shuimingResult).toContain('--list-summary-pad:112px');
    expect(shuimingResult).toContain('isIphone12Seam');
    expect(shuimingResult).toContain('html.app-ios-iphone12pro.app-top-safe-shell body.page-shuiming-result .top-fixed .summary');
    expect(shuimingResult).toContain('background: #f5f6fa !important');
    expect(shuimingResult).toContain('auth.js?v=20260918-ios27-edge');
  });

  it('首屏 iPhone13 判定排除 12 系列硬件号', () => {
    expect(shuimingResult).toContain('iPhone13,[1-4]');
    expect(shuimingResult).toMatch(/iPhone\\s\*13\\b\(\?!\[\\d,\]\)/);
  });
});
