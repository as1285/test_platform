import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('Android 收入纳税明细顶栏滑动不消失', () => {
  it('auth-boot 用 overflow-x:clip 裁横向，避免 hidden 把 fixed 顶栏带跑', () => {
    expect(boot).toContain('function clipAndroidHorizontalOverflow');
    expect(boot).toContain(
      'html.app-android-client,html.app-android-client body{overflow-x:clip;max-width:100%;}'
    );
    expect(boot).not.toContain(
      'html.app-android-client,html.app-android-client body{overflow-x:hidden;max-width:100%;}'
    );
    expect(boot).toContain('ColorOS 上明细页 fixed 顶栏会跟滑走');
    expect(boot).toContain("root.style.setProperty('--shuiming-chrome-top', '40px')");
  });

  it('明细页首屏钉住顶栏/汇总，并压过旧缓存的 overflow-x:hidden', () => {
    expect(shuimingResult).toContain('data-shuiming-android-fixed-chrome');
    expect(shuimingResult).toContain('overflow-x:clip!important');
    expect(shuimingResult).toContain('overscroll-behavior-y:none');
    expect(shuimingResult).toContain(
      'html.platform-android body.page-shuiming-result .top-fixed .header'
    );
    expect(shuimingResult).toContain('position:fixed!important');
    expect(shuimingResult).toContain('z-index:130!important');
    expect(shuimingResult).toContain(
      'top:calc(var(--header-height,48px) + var(--shuiming-chrome-top,var(--safe-top,0px)))!important'
    );
    expect(shuimingResult).toContain(
      '.top-fixed .header .header-title{display:block!important'
    );
    expect(shuimingResult).toContain('auth-boot.js?v=20260918-header-pin');
  });

  it('页面样式对 Android 再用 clip 钉住 header/summary', () => {
    expect(shuimingResult).toContain('overflow-x: clip !important');
    expect(shuimingResult).toMatch(
      /html\.platform-android body\.page-shuiming-result \.top-fixed \.header,[\s\S]*position:\s*fixed !important/
    );
    expect(shuimingResult).toMatch(
      /html\.platform-android body\.page-shuiming-result \.top-fixed \.header,[\s\S]*z-index:\s*130 !important/
    );
    expect(shuimingResult).toMatch(
      /html\.platform-android body\.page-shuiming-result \.top-fixed \.summary,[\s\S]*top:\s*calc\(var\(--header-height, 48px\) \+ var\(--shuiming-chrome-top/
    );
    expect(shuimingResult).toMatch(
      /html\.platform-android body\.page-shuiming-result \.top-fixed \.header \.header-title,[\s\S]*display:\s*block !important/
    );
  });
});
