import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('Android 收入纳税明细顶栏滑动不消失', () => {
  it('auth-boot 用 overflow-x:clip 裁横向，避免 hidden 把顶栏带跑', () => {
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

  it('安卓把顶栏和合计按真实模块排进文档流，不再 fixed 空挂', () => {
    expect(shuimingResult).toContain('shuiming-android-inflow');
    expect(shuimingResult).toContain('data-shuiming-android-inflow');
    expect(shuimingResult).toContain('data-shuiming-android-module');
    expect(shuimingResult).toContain('function isAndroidInflowClient');
    expect(shuimingResult).toContain('function placeAndroidShuimingModules');
    expect(shuimingResult).toContain('function paintAndroidHeaderBar');
    expect(shuimingResult).toContain('function androidChromeTopPx');
    expect(shuimingResult).toContain('if (!(n > 0) || n > 80) return 40');
    expect(shuimingResult).toContain('if (root && !isAndroidInflowClient())');
    expect(shuimingResult).toContain('shuiming-android-module');
    expect(shuimingResult).toContain('shuiming-android-status-pad');
    expect(shuimingResult).toContain('data-shuiming-android-status-pad');
    expect(shuimingResult).toContain('.page-root>.header');
    expect(shuimingResult).toContain('padding:0 16px!important');
    expect(shuimingResult).toContain('auth-boot.js?v=20260923-bs4s-noclock');
    expect(shuimingResult).toContain('flex-direction:column!important');
    expect(shuimingResult).toContain('flex:1 1 auto!important');
    expect(shuimingResult).toContain('flex:0 0 auto!important');
    expect(shuimingResult).toContain('position:relative!important;top:auto!important');
    expect(shuimingResult).not.toContain('data-shuiming-android-list-lock');
    expect(shuimingResult).not.toContain('data-shuiming-a57-weekback');
    expect(shuimingResult).not.toContain('shuiming-android-weekback');
  });

  it('页面样式对 Android 用文档流模块，列表在合计下自己滑', () => {
    expect(shuimingResult).toMatch(
      /html\.shuiming-android-inflow body\.page-shuiming-result \.top-fixed \.header,[\s\S]*position:\s*relative !important/
    );
    expect(shuimingResult).toMatch(
      /html\.shuiming-android-inflow body\.page-shuiming-result \.top-fixed \.summary,[\s\S]*top:\s*auto !important/
    );
    expect(shuimingResult).toMatch(
      /html\.shuiming-android-inflow body\.page-shuiming-result \.list,[\s\S]*margin-top:\s*0 !important/
    );
    expect(shuimingResult).toMatch(
      /html\.platform-android body\.page-shuiming-result \.page-root,[\s\S]*display:\s*flex !important/
    );
    expect(shuimingResult).toContain('if (isIosUnifiedSeam || isAndroidInflowClient())');
    expect(shuimingResult).toContain('function lockAndroidShuimingPageScroll');
  });
});
