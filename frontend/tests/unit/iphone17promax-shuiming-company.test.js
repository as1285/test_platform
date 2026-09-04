import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

describe('iPhone 17 Pro Max 收入纳税明细贴边与箭头', () => {
  it('first-paints 17 Pro Max class and edge-to-edge list', () => {
    expect(shuimingResult).toContain("classList.add('app-ios-iphone17promax')");
    expect(shuimingResult).toContain('data-iphone17promax-result-firstpaint');
    expect(shuimingResult).toContain('data-shuiming-flush-firstpaint');
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

  it('uses a CSS chevron on the company row and does not use 11-char JS clip', () => {
    expect(shuimingResult).toContain('list-row-company');
    expect(shuimingResult).toContain('<span class="list-arrow" aria-hidden="true"></span>');
    expect(shuimingResult).not.toMatch(/<img class="list-arrow"/);
    expect(shuimingResult).toContain('border-top: 1.5px solid #c7c7cc');
    expect(shuimingResult).toContain('translateY(2px) rotate(45deg)');
    expect(shuimingResult).toContain('flex: 1 1 0%');
    expect(shuimingResult).not.toContain('function isIPhone17ProMaxCompanyEllipsisClient');
    expect(shuimingResult).not.toContain('companyMaxChars = 11');
    expect(shuimingResult).toContain('var companyMaxChars = iosCompanyEllipsis ? 13 : 12');
  });

  it('auth.js forces flush gutters and CSS chevron without 17 Pro Max class', () => {
    expect(auth).toContain(
      'html.app-ios-iphone17promax body.page-shuiming-result .list,html.app-ios-iphone17promax.app-ios-promax-wide body.page-shuiming-result .list{padding-left:0'
    );
    expect(auth).toContain(
      'body.page-shuiming-result .list{padding-left:0 !important;padding-right:0 !important;}'
    );
    expect(auth).toContain(
      'body.page-shuiming-result .list-row-company .list-arrow{display:block !important;width:10px'
    );
    expect(auth).toContain('border-top:1.5px solid #c7c7cc');
    expect(auth).not.toMatch(
      /page-shuiming-result \.list\{padding-left:20px/
    );
    expect(auth).toContain('@media screen and (min-width:428px)');
    expect(shuimingResult).toContain('auth.js?v=20260904-op12-top');
  });
});
