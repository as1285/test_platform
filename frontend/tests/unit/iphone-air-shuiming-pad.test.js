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
});
