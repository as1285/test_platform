import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8');

describe('iPhone Air 收入纳税明细左右贴边', () => {
  it('auth.js 识别 Air（iPhone18,4 / 420×912）并打 app-ios-iphoneair', () => {
    expect(auth).toContain('function isIPhoneAirClient');
    expect(auth).toContain('isIPhone420x912Viewport');
    expect(auth).toContain('iPhone18,4');
    expect(auth).toContain("classList.add('app-ios-iphoneair')");
    expect(auth).toMatch(/isIPhone17ProLikeClient[\s\S]*iPhone18,4[\s\S]*return false/);
  });

  it('auth.js / 结果页用贴边规则压过 ≥414 的 20px 留白', () => {
    expect(auth).toContain('html.app-ios-iphoneair body.page-shuiming-result .list{');
    expect(auth).toContain('padding-left:0 !important;padding-right:0 !important');
    expect(auth).toContain(
      'html.app-ios-iphoneair body.page-shuiming-result .list-item{--list-inline-pad:16px;border-radius:0'
    );
    expect(shuimingResult).toContain('app-ios-iphoneair');
    expect(shuimingResult).toContain('data-iphoneair-result-firstpaint');
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphoneair body\.page-shuiming-result \.list[\s\S]*padding-left:\s*0/
    );
    expect(shuimingResult).toContain('min-device-width: 416px');
    expect(shuimingResult).toContain('max-device-width: 424px');
  });

  it('Air 不吃 promax-font 白底汇总，灰缝压回 #f5f6fa', () => {
    expect(shuimingResult).toContain('&& !isAirLike');
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphoneair[\s\S]*\.top-fixed \.summary[\s\S]*background:\s*#f5f6fa/
    );
    expect(auth).toContain(
      'html.app-ios-iphoneair body.page-shuiming-result .top-fixed .summary,html.app-ios-iphoneair.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,html.app-ios-iphoneair.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,44px) + var(--app-shell-statusbar-top,59px)) !important;background:#f5f6fa !important;padding:12px 0 10px !important;}'
    );
    expect(auth).toContain("classList.remove('app-ios-iphone-promax-font')");
    expect(auth).toMatch(/function isIPhoneProMaxLargeFontClient\(\)[\s\S]*isIPhoneAirClient\(\)/);
  });
});

describe('iPhone Air 收入纳税明细顶部状态栏避让', () => {
  it('首屏 / 静态 CSS / auth 注入均为顶栏补 max(59px) 安全区', () => {
    expect(shuimingResult).toContain(
      'html.app-ios-iphoneair{--app-shell-statusbar-top:max(59px,env(safe-area-inset-top,59px)) !important;'
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphoneair[\s\S]*\.top-fixed \.header[\s\S]*padding:\s*var\(--app-shell-statusbar-top,\s*59px\)\s*12px\s*0/
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphoneair[\s\S]*\.top-fixed \.summary[\s\S]*top:\s*calc\(var\(--header-height,\s*44px\) \+ var\(--app-shell-statusbar-top,\s*59px\)\)/
    );
    expect(auth).toContain("classList.add('app-top-safe-shell')");
    expect(auth).toContain("'max(59px, env(safe-area-inset-top, 59px))'");
    expect(auth).toContain(
      'html.app-ios-iphoneair body.page-shuiming-result .top-fixed .header,html.app-ios-iphoneair.app-top-safe-shell body.page-shuiming-result .top-fixed .header{top:0 !important;height:calc(var(--header-height,44px) + var(--app-shell-statusbar-top,59px)) !important;'
    );
    expect(shuiming).toContain(
      'padding-top: calc(14px + var(--app-shell-statusbar-top, 59px)) !important'
    );
    expect(shuimingResult).toContain('auth.js?v=20261006-android-july20-mi14');
    expect(shuiming).toContain('auth.js?v=20261006-android-july20-mi14');
  });
});

describe('收入纳税明细切年份二次进入顶空白', () => {
  it('关掉路径级滚动恢复；列表接到汇总底下，padding-top 置 0，避免使劲回弹拽出灰垫', () => {
    expect(shuimingResult).toContain("history.scrollRestoration = 'manual'");
    expect(shuimingResult).toContain('function resetShuimingScrollTop');
    expect(shuimingResult).toContain('function shuimingPageScrolled');
    expect(shuimingResult).toContain('function shuimingChromeUnstable');
    expect(shuimingResult).toContain("setProperty('--list-summary-pad', '0px', 'important')");
    expect(shuimingResult).toContain("setProperty('padding-top', '0px', 'important')");
    expect(shuimingResult).toMatch(/setProperty\(\s*['"]margin-top['"]/);
    expect(shuimingResult).toContain('overscroll-behavior-y: none');
    expect(shuimingResult).toContain('resetShuimingScrollTop();');
    expect(shuimingResult).toContain('auth.js?v=20261006-android-july20-mi14');
  });
});
