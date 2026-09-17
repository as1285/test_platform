import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8');

describe('iPhone 133 ProMaxx 收入纳税明细顶栏', () => {
  it('识别 133 ProMaxx / 13 Pro Max，且不套 status-outer 零顶距', () => {
    expect(auth).toContain('function isIPhone133ProMaxxOverlapClient()');
    expect(auth).toContain('ProMaxx');
    expect(auth).toContain('MLLL63');
    expect(auth).toContain('iPhone\\s*133');
    const fn = auth.slice(
      auth.indexOf('function applyIPhone16ProPageChrome()'),
      auth.indexOf('function applyImmersiveNotchWhitePageChrome()')
    );
    expect(fn).toContain('isIPhone133ProMaxxOverlapClient()');
    expect(fn).toContain('useOuterBar = false');
    expect(fn).toContain("classList.add('app-ios-iphone133promax')");
  });

  it('明细页首屏即垫 47px，返回/批量申诉避开状态栏', () => {
    expect(shuimingResult).toContain('data-iphone133pm-result-firstpaint');
    expect(shuimingResult).toContain('app-ios-iphone133promax');
    expect(shuimingResult).toContain('padding:47px 16px 0');
    expect(shuimingResult).toContain('top:47px');
    expect(shuimingResult).toContain("classList.remove('app-ios-status-outer')");
    expect(shuimingResult).toContain('auth.js?v=20260917-14pm-list');
    expect(auth).toContain('html.app-ios-iphone133promax.app-ios-status-outer body.page-shuiming-result .top-fixed .header');
    expect(auth).toContain('padding:47px 16px 0');
  });

  it('筛选页同样让开状态栏', () => {
    expect(shuiming).toContain('data-iphone133pm-shuiming-firstpaint');
    expect(shuiming).toContain('app-ios-iphone133promax');
    expect(shuiming).toContain('padding-top:calc(14px + 47px)');
    expect(shuiming).toContain('auth.js?v=20260917-14pm-list');
  });
});
