import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

describe('iPhone 17 Pro Max 收入纳税明细贴边与箭头', () => {
  it('first-paints 17 Pro Max class and edge-to-edge list', () => {
    expect(shuimingResult).toContain("classList.add('app-ios-iphone17promax')");
    expect(shuimingResult).toContain('data-iphone17promax-result-firstpaint');
    expect(shuimingResult).toMatch(/iPhone\\s\*17\\s\*Pro\\s\*Max\|iPhone18,2\\b\|iPhone19,2\\b/);
    expect(shuimingResult).toContain('!is15pmLike && !is17pmLike');
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone17promax body\.page-shuiming-result \.list[\s\S]{0,180}padding-left:\s*0/
    );
    expect(shuimingResult).toContain(
      'html.app-ios-iphone17promax body.page-shuiming-result .list-item'
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone17promax body\.page-shuiming-result \.list-item[\s\S]{0,220}border-radius:\s*0/
    );
  });

  it('pins company chevron to the right and does not use 11-char JS clip', () => {
    expect(shuimingResult).toContain(
      'html.app-ios-iphone17promax body.page-shuiming-result .list-arrow'
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone17promax body\.page-shuiming-result \.list-arrow[\s\S]{0,80}margin-left:\s*auto/
    );
    expect(shuimingResult).toContain('flex: 1 1 0%');
    expect(shuimingResult).not.toContain('function isIPhone17ProMaxCompanyEllipsisClient');
    expect(shuimingResult).not.toContain('companyMaxChars = 11');
    expect(shuimingResult).toContain('var companyMaxChars = iosCompanyEllipsis ? 13 : 12');
  });

  it('auth.js overrides promax-wide 20px gutters and visible company overflow', () => {
    expect(auth).toContain(
      'html.app-ios-iphone17promax body.page-shuiming-result .list,html.app-ios-iphone17promax.app-ios-promax-wide body.page-shuiming-result .list{padding-left:0'
    );
    expect(auth).toContain(
      'html.app-ios-iphone17promax body.page-shuiming-result .list-arrow{margin-left:auto'
    );
    expect(auth).not.toMatch(
      /html\.app-ios-iphone17promax body\.page-shuiming-result \.list-company-name[^']*overflow:visible/
    );
    expect(shuimingResult).toContain('auth.js?v=20260904-17pm-edge');
  });
});
