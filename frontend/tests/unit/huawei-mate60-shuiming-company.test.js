import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

describe('华为 Mate 60 收入纳税明细扣缴义务人行宽', () => {
  it('first-paint 即铺满公司名剩余宽度，避免 ArkWeb 收成约 7 字', () => {
    expect(shuimingResult).toContain("classList.add('app-android-huawei-mate60')");
    expect(shuimingResult).toContain('data-mate60-result-firstpaint');
    expect(shuimingResult).toContain(
      'html.app-android-huawei-mate60 body.page-shuiming-result .list-company-name'
    );
    expect(shuimingResult).toMatch(
      /html\.app-android-huawei-mate60 body\.page-shuiming-result \.list-company\{display:flex/
    );
    expect(shuimingResult).toMatch(
      /html\.app-android-huawei-mate60 body\.page-shuiming-result \.list-company-name\{display:block !important;flex:1 1 0%/
    );
    expect(shuimingResult).toContain('companyMaxChars = 20');
    expect(shuimingResult).toContain("classList.contains('app-android-huawei-mate60')");
  });

  it('页内样式与 auth 注入都去掉 list-company 的 max-width:100% 收缩', () => {
    expect(shuimingResult).toContain(
      'html.app-android-huawei-mate60 body.page-shuiming-result .list-company'
    );
    expect(shuimingResult).toMatch(
      /Mate 60 \/ Pro：ArkWeb[\s\S]{0,80}max-width:100%/
    );
    expect(auth).toContain(
      'html.app-android-huawei-mate60 body.page-shuiming-result .list-company-name'
    );
    expect(auth).toContain(
      'html.app-android-huawei-mate60 body.page-shuiming-result .list-row-left'
    );
  });
});
