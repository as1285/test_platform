import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iPhone 14 Pro 收入纳税明细顶栏字号对齐官方', () => {
  it('iOS 返回 / 批量申诉默认 17px，对齐 UINavigationBar', () => {
    expect(shuimingResult).toMatch(
      /html\.platform-ios body\.page-shuiming-result \.back-btn,[\s\S]{0,80}html\.platform-ios body\.page-shuiming-result \.header-right \{[\s\S]{0,40}font-size:\s*17px/
    );
  });

  it('14 Pro 不再把返回 / 批量申诉收到 14px', () => {
    expect(shuimingResult).toContain('不再收成 14px');
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone14pro body\.page-shuiming-result \.top-fixed \.header \.back-btn \{[\s\S]{0,40}font-size:\s*17px\s*!important/
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone14pro body\.page-shuiming-result \.top-fixed \.header \.header-right \{[\s\S]{0,40}font-size:\s*17px\s*!important/
    );
    expect(shuimingResult).not.toMatch(
      /html\.app-ios-iphone14pro body\.page-shuiming-result \.top-fixed \.header \.back-btn \{[\s\S]{0,40}font-size:\s*14px/
    );
  });
});
