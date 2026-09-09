import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('收入纳税明细「收入合计」问号间距', () => {
  it('问号与「收入合计」留约一个空格，不再贴死', () => {
    expect(shuimingResult).toMatch(
      /\.summary-help-with-colon \{[\s\S]{0,160}margin-left:\s*6px;/
    );
    expect(shuimingResult).toMatch(
      /html\.platform-ios body\.page-shuiming-result \.summary-help-with-colon \{\s*margin-left:\s*6px;/
    );
    expect(shuimingResult).not.toMatch(
      /\.summary-help-with-colon \{[\s\S]{0,160}margin-left:\s*2px;/
    );
  });
});
