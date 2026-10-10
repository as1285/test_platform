import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8');

describe('iPhone 13 Pro Max 收入纳税明细顶栏', () => {
  it('识别 13 Pro Max，并保留 app-ios-iphone13promax', () => {
    expect(auth).toContain('function isIPhone13ProMaxClient(');
    expect(auth).toContain("classList.add('app-ios-iphone13promax')");
    expect(auth).toContain('app-ios-iphone13promax');
    expect(shuimingResult).toContain('app-ios-iphone13promax');
  });

  it('明细页为刘海机顶栏让开状态栏（含 47px 档）', () => {
    expect(shuimingResult).toContain('47px');
    expect(auth).toMatch(/iphone13promax[\s\S]{0,200}47px|47px[\s\S]{0,200}iphone13promax|padding:47px/);
    expect(shuimingResult).toMatch(/auth\.js\?v=2026[\w-]+/);
  });

  it('筛选页仍走白顶首绘与当前 auth 戳', () => {
    expect(shuiming).toMatch(/auth\.js\?v=2026[\w-]+/);
    expect(shuiming).toContain('data-ios-white-status-firstpaint');
  });
});
