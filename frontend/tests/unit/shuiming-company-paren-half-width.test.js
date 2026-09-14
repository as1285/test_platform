import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const indirectEval = eval;
const html = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

function loadCompanyFn() {
  const start = html.indexOf('function truncateCompanyName');
  const end = html.indexOf('function truncateCompanyName') !== -1
    ? html.indexOf('window.getNoRecordsHtml')
    : -1;
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  indirectEval(
    '(function(){' +
      html.slice(start, end) +
      ';window.truncateCompanyName=truncateCompanyName;})()'
  );
}

describe('收入纳税明细：公司名括号按半个汉字宽截断', () => {
  it('定义了 truncateCompanyName 并用于列表渲染', () => {
    expect(html).toContain('function truncateCompanyName');
    expect(html).toContain('truncateCompanyName(company, companyMaxChars)');
    // 保留既有断言契约：仍按 iOS/Android 取 13/12；Mate 60 跳过预截
    expect(html).toContain('var companyMaxChars = iosCompanyEllipsis ? 13 : 12');
    expect(html).toContain('mate60CompanyFill');
  });

  it('两个全角括号合算一个汉字宽，带括号公司名在 12 内可完整显示', () => {
    loadCompanyFn();
    // 视锐达科技（宁波）有限公司 = 5 + 0.5 + 2 + 0.5 + 3 = 11 宽
    expect(window.truncateCompanyName('视锐达科技（宁波）有限公司', 12)).toBe(
      '视锐达科技（宁波）有限公司'
    );
  });

  it('无括号长名仍按每字 1 截断（保留 12 字）', () => {
    loadCompanyFn();
    expect(window.truncateCompanyName('某某某某某某某某某某某某某', 12)).toBe(
      '某某某某某某某某某某某某...'
    );
  });

  it('括号后超宽仍加省略号，括号只算半个汉字宽', () => {
    loadCompanyFn();
    // 6 汉字 + 0.5 + 6 汉字 + 0.5 = 13 宽 > 12 → 截到累计宽 11.5 处（6 字 + 「（」+ 5 字）
    expect(window.truncateCompanyName('某某某某某某（某某某某某某）', 12)).toBe(
      '某某某某某某（某某某某某...'
    );
  });

  it('空串与 null 安全返回空串', () => {
    loadCompanyFn();
    expect(window.truncateCompanyName('', 12)).toBe('');
    expect(window.truncateCompanyName(null, 12)).toBe('');
  });
});
