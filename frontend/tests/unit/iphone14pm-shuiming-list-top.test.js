import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iPhone 14 Pro Max 收入纳税明细列表顶距', () => {
  it('按 CSS 预期顶栏位置判断错位，安全区约 59px 不当成橡皮筋', () => {
    expect(shuimingResult).toContain('function shuimingExpectedHeaderTop');
    expect(shuimingResult).toContain('function shuimingChromeUnstable');
    expect(shuimingResult).toContain('var expected = shuimingExpectedHeaderTop(headerEl)');
    expect(shuimingResult).toContain('if (expected > 2)');
    expect(shuimingResult).toContain('if (Math.abs(ht - expected) <= 12) return false');
    expect(shuimingResult).toMatch(
      /\/\* 14 Pro Max \/ 15promax：[\s\S]*不能当橡皮筋错位而跳过按汇总底重算 \*\/[\s\S]*if \(expected > 2\)/
    );
  });

  it('14PM / 15promax 首屏列表顶距含顶栏 + 安全区 + 汇总垫', () => {
    expect(shuimingResult).toContain('data-iphone14pm-list-top-firstpaint');
    expect(shuimingResult).toContain(
      'margin-top:calc(52px + var(--app-shell-statusbar-top,59px) + var(--list-summary-pad,96px))'
    );
    expect(shuimingResult).toContain(
      '--shuiming-chrome-top:var(--app-shell-statusbar-top,env(safe-area-inset-top,59px))'
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone15promax body\.page-shuiming-result \.page-root,[\s\S]{0,80}html\.app-ios-iphone14promax body\.page-shuiming-result \.page-root/
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone15promax body\.page-shuiming-result \.list[\s\S]{0,200}margin-top:\s*calc\(52px \+ var\(--app-shell-statusbar-top,\s*59px\) \+ var\(--list-summary-pad,\s*96px\)\)/
    );
  });

  it('auth 晚注入也不把 14PM / 15promax 列表顶距锁成仅顶栏+安全区', () => {
    expect(auth).toContain(
      'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .list,html.app-ios-iphone14promax.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(52px + var(--app-shell-statusbar-top,59px) + var(--list-summary-pad,96px)) !important;'
    );
    expect(auth).not.toContain(
      'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .list,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}'
    );
  });

  it('15 宽档仍按汇总盒底起算列表，测量成功后才会改 margin', () => {
    expect(shuimingResult).toContain('isIphone15Wide');
    expect(shuimingResult).toContain('if (shuimingChromeUnstable() || !(headerBottom > 0)) return');
    expect(shuimingResult).toContain('applyShuimingListTop(list, root, listTop)');
    expect(shuimingResult).toContain("setProperty('margin-top', y + 'px', 'important')");
    expect(shuimingResult).toMatch(/isIphone15Wide \|\| isIphone16ProSeam \|\| isIphone11Seam/);
    expect(shuimingResult).toContain('auth.js?v=20260923-bs4s-noclock');
  });
});
