import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const result = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('未修复兼容反馈', () => {
  it('iPhone OS 18_7 + Version/26 按 26 处理，纳税明细不再把顶栏清零', () => {
    expect(auth).toContain('Version\\/(\\d+)');
    expect(auth).toContain('verMajor >= 26 && verMajor > osMajor');
    expect(result).toContain('Version\\/(\\d+)');
    expect(result).toContain('verMajor >= 26 && verMajor > iosMajor');
  });

  it('vivo V2285A 与小米 15 Ultra 纳税明细顶栏留 40px', () => {
    expect(auth).toContain('function isVivoV2285AClient()');
    expect(auth).toContain('V2285A');
    expect(auth).toContain("classList.add('app-android-vivo-v2285a')");
    expect(result).toContain('V2285A');
    expect(result).toContain('25019PNF3');
    expect(result).toContain('app-android-xiaomi-15ultra');
    expect(result).toContain('html.app-android-vivo-v2285a body.page-shuiming-result .top-fixed .header');
  });

  it('iPhone 15 税务机关名称允许换行', () => {
    expect(result).toContain('html.app-ios-iphone15 body.page-shuiming-result .list-company');
    expect(result).toContain('white-space: normal');
  });
});
