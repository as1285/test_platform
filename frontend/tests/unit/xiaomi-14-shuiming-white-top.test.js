import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const xiangqing = readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8');

describe('Xiaomi 14 系统栏回退 7/20', () => {
  it('识别 23127PN0CC / 小米 14（非 Pro）', () => {
    expect(auth).toContain('function isXiaomi14LikeClient()');
    expect(auth).toContain('23127PN0CC');
    expect(auth).toMatch(/23127PN0CC\|23127PN0CG\|23127PN\\b/);
  });

  it('白顶页 StatusBar / theme-color 用 7/20 灰根，保留 48px 顶距', () => {
    const start = auth.indexOf('/* 小米 14：勿走外置清零');
    expect(start).toBeGreaterThan(0);
    const fn = auth.slice(start, start + 1400);
    expect(fn).toContain("applyAndroidJuly20SystemBar('#f5f6fa')");
    expect(fn).toContain("'--app-shell-statusbar-top', '48px'");
    expect(fn).not.toContain("color: '#ffffff'");
    expect(fn).not.toContain("color: '#000000'");
    expect(fn).not.toContain('overlays: false');
  });

  it('页内 ::before 灰条覆盖纳税明细 / 结果 / 详情', () => {
    expect(auth).toContain(
      'height:var(--app-shell-statusbar-top,48px) !important;background:#f5f6fa !important;z-index:2147483000'
    );
    expect(auth).toContain('html.app-android-xiaomi-14.app-top-safe-shell:has(body.page-shuiming)::before');
    expect(auth).toContain(
      'html.app-android-xiaomi-14.app-top-safe-shell:has(body.page-shuiming-result)::before'
    );
    expect(auth).toContain(
      'html.app-android-xiaomi-14.app-top-safe-shell:has(body.page-xiangqing)::before'
    );
  });

  it('首帧全页走 7/20 灰根，不再分白顶白条', () => {
    expect(auth).not.toContain('var mi14FirstWhite = isAndroidWhiteStatusPage()');
    expect(auth).not.toContain('var xiaomi14WhiteChrome =');
    expect(auth).toContain('applyAndroidJuly20SystemBar');
    expect(auth).not.toContain("var mi14FirstColor = mi14FirstWhite ? '#ffffff' : '#000000'");
  });

  it('shuiming 首屏预标 app-android-xiaomi-14 并铺灰条', () => {
    expect(shuiming).toContain('23127PN0CC');
    expect(shuiming).toContain("classList.add('app-android-xiaomi-14')");
    expect(shuiming).toContain('data-xiaomi14-shuiming-white-firstpaint');
    expect(shuiming).toContain('background:#f5f6fa !important');
    expect(shuiming).toContain('auth.js?v=20261010-compat-feedback');
    expect(shuimingResult).toContain('auth.js?v=20261010-compat-feedback');
    expect(xiangqing).toContain('auth.js?v=20261009-honor-oxf-an10');
  });
});
