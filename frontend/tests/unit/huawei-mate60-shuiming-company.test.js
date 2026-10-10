import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

describe('华为 Mate 60 收入纳税明细扣缴义务人行宽', () => {
  it('first-paint 即铺满公司名剩余宽度，避免 ArkWeb 收成约 7 字', () => {
    expect(shuimingResult).toMatch(/html\.app-android-huawei-mate60[\s\S]{0,80}list-company/);
    expect(auth).toMatch(/html\.app-android-huawei-mate60 body\.page-shuiming-result \.list-company/);
    expect(shuimingResult).toMatch(/auth\.js\?v=2026[\w-]+/);
  });

  it('页内样式与 auth 注入都去掉 list-company 的 max-width:100% 收缩', () => {
    expect(shuimingResult).toMatch(/mate60[\s\S]{0,120}list-company/);
    expect(auth).toMatch(/huawei-mate60[\s\S]{0,80}list-company/);
    expect(shuimingResult).toMatch(/mate60[\s\S]{0,200}list-company/);
    expect(auth).toContain('list-company');
    expect((shuimingResult + auth)).toMatch(/max-width:\s*100%/);
  });
});
