import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iPhone 16 Pro Max 收入纳税明细标题下灰缝', () => {
  it('auth 不为 16 Pro Max 强制汇总白底，改为官方灰缝', () => {
    expect(auth).not.toMatch(
      /html\.app-ios-iphone16promax\.app-top-safe-shell body\.page-shuiming-result \.top-fixed \.summary\{[^}]*background:#fff !important/
    );
    expect(auth).toMatch(
      /html\.app-ios-iphone16promax\.app-top-safe-shell body\.page-shuiming-result \.top-fixed \.summary\{[^}]*background:#f5f6fa !important[^}]*padding:12px 0 10px !important/
    );
    // promax-font 通用白底须排除 16/17PM，并有更高优先级灰缝兜底
    expect(auth).toMatch(
      /iphone-promax-font\.app-top-safe-shell:not\(\.app-ios-iphone16pro\):not\(\.app-ios-iphone15promax\):not\(\.app-ios-iphone16promax\):not\(\.app-ios-iphone17promax\) body\.page-shuiming-result \.top-fixed \.summary\{[^}]*background:#fff/
    );
    expect(auth).toMatch(
      /html\.app-ios-iphone16promax\.app-ios-iphone-promax-font\.app-top-safe-shell body\.page-shuiming-result \.top-fixed \.summary[^}]*background:#f5f6fa !important/
    );
  });

  it('页面 CSS / 首屏预标含 16 Pro Max 标题下灰缝', () => {
    expect(shuimingResult).toContain('data-iphone16pm-result-grey-seam');
    expect(shuimingResult).toContain('勿白底 / 白阴影贴死顶栏（反馈 #58）');
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone16promax body\.page-shuiming-result \.top-fixed \.summary[\s\S]{0,200}padding:\s*12px 0 10px\s*!important/
    );
  });
});
