import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const catalog = readFileSync(resolve(__dirname, '../../../backend/src/admin/uiCompatCatalog.js'), 'utf8');

describe('Mate 60 收入纳税明细：扣缴义务人吃满箭头左侧', () => {
  it('跳过 JS 12 字预截，完整公司名交给 CSS 省略', () => {
    expect(shuimingResult).toContain('function isMate60CompanyFillClient');
    expect(shuimingResult).toContain('var mate60CompanyFill = isMate60CompanyFillClient()');
    expect(shuimingResult).toContain('? String(company)');
    expect(shuimingResult).toContain('truncateCompanyName(company, companyMaxChars)');
    expect(shuimingResult).toContain('var companyMaxChars = iosCompanyEllipsis ? 13 : 12');
    expect(shuimingResult).toContain('HarmonyOS flex 会把 12 字再收到约 7 字');
  });

  it('公司名 flex 吃满箭头左侧，首屏与页面样式都打开省略', () => {
    expect(shuimingResult).toContain('data-mate60-result-firstpaint');
    expect(shuimingResult).toContain(
      'html.app-android-huawei-mate60 body.page-shuiming-result .list-company-name'
    );
    expect(shuimingResult).toContain('flex:1 1 0% !important;min-width:0 !important;max-width:none !important');
    expect(shuimingResult).toContain('text-overflow:ellipsis !important');
    expect(shuimingResult).toContain('text-overflow: clip !important');
    expect(shuimingResult).toContain('auth.js?v=20260914-m60-company');
  });

  it('auth.js 同步注入同一套公司名宽度规则', () => {
    expect(auth).toContain(
      'html.app-android-huawei-mate60 body.page-shuiming-result .list-company-name,'
    );
    expect(auth).toContain(
      'flex:1 1 0% !important;min-width:0 !important;max-width:none !important;overflow:hidden !important;'
    );
    expect(catalog).toContain('扣缴义务人吃满箭头左侧宽度');
    expect(catalog).toContain('苏州宇量引力网络科技有限公司');
  });
});
