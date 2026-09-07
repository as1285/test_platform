import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../css/device-tokens.css'), 'utf8');

describe('iPhone 16 Pro 收入纳税明细顶距与灰缝边', () => {
  it('shuiming_result 首屏打标 16 Pro 并锁 59px + 44px 顶栏', () => {
    expect(shuimingResult).toContain('app-ios-iphone16pro');
    expect(shuimingResult).toContain('data-iphone16pro-result-firstpaint');
    expect(shuimingResult).toContain('max(59px,env(safe-area-inset-top,59px))');
    expect(shuimingResult).toContain('--header-height:44px');
  });

  it('首屏与页面 CSS：无阴影、顶栏 44px、汇总顶 12px 灰缝', () => {
    expect(shuimingResult).toMatch(
      /data-iphone16pro-result-firstpaint[\s\S]*box-shadow:none !important/
    );
    expect(shuimingResult).toMatch(
      /data-iphone16pro-result-firstpaint[\s\S]*padding:12px 0 10px !important/
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone16pro[\s\S]{0,80}body\.page-shuiming-result \.top-fixed \.summary[\s\S]{0,160}padding:\s*12px 0 10px\s*!important/
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone16pro body\.page-shuiming-result \.list[\s\S]{0,160}padding-left:\s*0\s*!important/
    );
    expect(shuimingResult).toContain('data-iphone16pro-vp-grey-seam');
    expect(shuimingResult).toContain('isIphone16ProSeam ? 0');
  });

  it('非 Cordova 通用顶距规则排除 16 Pro', () => {
    expect(auth).toContain(':not(.app-ios-iphone16pro)');
  });

  it('auth 在贴边规则后强制 16 Pro 44px 顶栏 + 12px 顶灰缝', () => {
    const idxFlush = auth.lastIndexOf(
      'body.page-shuiming-result .list{padding-left:0 !important;padding-right:0 !important;}'
    );
    const idxSeam = auth.indexOf('顶栏 44px；汇总顶 12px 灰缝对齐官方');
    expect(idxFlush).toBeGreaterThan(0);
    expect(idxSeam).toBeGreaterThan(idxFlush);
    expect(auth).toMatch(
      /html\.app-ios-iphone16pro[\s\S]{0,200}\.top-fixed \.summary[\s\S]{0,120}padding:12px 0 10px !important/
    );
    expect(auth).toContain('promax-font.app-top-safe-shell:not(.app-ios-iphone16pro)');
  });

  it('device-tokens 为 16 Pro 设置 44px 顶栏与官方灰缝', () => {
    expect(tokens).toMatch(/html\.app-ios-iphone16pro\s*\{[^}]*--device-list-edge:\s*0px/);
    expect(tokens).toMatch(
      /html\.app-ios-iphone16pro body\.page-shuiming-result \.page-root\s*\{[^}]*--header-height:\s*44px/
    );
    expect(tokens).toMatch(
      /html\.app-ios-iphone16pro body\.page-shuiming-result \.top-fixed \.summary\s*\{[^}]*padding:\s*12px 0 10px/
    );
  });
});
