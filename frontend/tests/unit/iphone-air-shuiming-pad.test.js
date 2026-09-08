import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iPhone Air 收入纳税明细左右贴边', () => {
  it('auth.js 识别 Air（iPhone18,4 / 420×912）并打 app-ios-iphoneair', () => {
    expect(auth).toContain('function isIPhoneAirClient');
    expect(auth).toContain('isIPhone420x912Viewport');
    expect(auth).toContain('iPhone18,4');
    expect(auth).toContain("classList.add('app-ios-iphoneair')");
    expect(auth).toMatch(/isIPhone17ProLikeClient[\s\S]*iPhone18,4[\s\S]*return false/);
  });

  it('auth.js / 结果页用贴边规则压过 ≥414 的 20px 留白', () => {
    expect(auth).toContain('html.app-ios-iphoneair body.page-shuiming-result .list{padding-left:0');
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
      'html.app-ios-iphoneair body.page-shuiming-result .top-fixed .summary,html.app-ios-iphoneair.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{background:#f5f6fa !important;}'
    );
    expect(auth).toContain("classList.remove('app-ios-iphone-promax-font')");
    expect(auth).toMatch(/function isIPhoneProMaxLargeFontClient\(\)[\s\S]*isIPhoneAirClient\(\)/);
  });
});

describe('收入纳税明细切年份二次进入顶空白', () => {
  it('关掉路径级滚动恢复；列表接到汇总底下；禁用原生整页橡皮筋，改脚本联动回弹', () => {
    expect(shuimingResult).toContain("history.scrollRestoration = 'manual'");
    expect(shuimingResult).toContain('function resetShuimingScrollTop');
    expect(shuimingResult).toContain('function shuimingPageScrolled');
    expect(shuimingResult).toContain('function shuimingChromeUnstable');
    expect(shuimingResult).toContain("setProperty('--list-summary-pad', '0px', 'important')");
    expect(shuimingResult).toContain("setProperty('padding-top', '0px', 'important')");
    expect(shuimingResult).toContain("setProperty('margin-top', listTop + 'px', 'important')");
    expect(shuimingResult).toContain('overscroll-behavior-y: none');
    expect(shuimingResult).not.toContain('overscroll-behavior-y: contain');
    expect(shuimingResult).toContain('resetShuimingScrollTop();');
    expect(shuimingResult).toContain('auth.js?v=20260907-ios-white-bar');
  });
});

describe('收入纳税明细滚动拉手与顶部回弹', () => {
  it('拉手加粗到 4px；顶到头时汇总+列表一起下移，不撕开灰缝', () => {
    expect(shuimingResult).toMatch(/\.sm-scroll-thumb\s*\{[^}]*width:\s*4px/);
    expect(shuimingResult).toContain('function initSmRubberAndScrollThumb');
    expect(shuimingResult).toContain('function applyRubber');
    expect(shuimingResult).toContain('function getRubberEls');
    expect(shuimingResult).toContain('sm-rubber-drag');
    expect(shuimingResult).toContain('sm-rubber-release');
    expect(shuimingResult).toContain('RUBBER_MAX');
    expect(shuimingResult).toContain("getElementById('recordList')");
  });
});
