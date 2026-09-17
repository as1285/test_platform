import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');
const login = readFileSync(resolve(__dirname, '../../login.html'), 'utf8');

describe('iPhone 14 Pro Max 首页通知条 / 纳税明细字号', () => {
  it('大屏字号档包含 14 Pro Max，Air 仍排除', () => {
    expect(auth).toMatch(
      /function isIPhoneProMaxLargeFontClient\(\)[\s\S]*isIPhone14ProMaxClient\(\)/
    );
    expect(auth).toMatch(/function isIPhoneProMaxLargeFontClient\(\)[\s\S]*isIPhoneAirClient\(\)/);
  });

  it('首页 a1 通知条在 14 Pro Max 放大到 18px', () => {
    expect(shouye).toContain('html.app-ios-iphone14promax .sy-apk-marquee');
    expect(shouye).toMatch(
      /html\.app-ios-iphone14promax \.sy-apk-marquee[\s\S]{0,120}font-size:\s*18px/
    );
    expect(shouye).toMatch(
      /html\.app-ios-iphone14promax \.sy-apk-marquee[\s\S]{0,160}font-weight:\s*500/
    );
    expect(shouye).toContain('auth.js?v=20260916-iphone14pm-font');
  });

  it('收入纳税明细首屏打 14promax + promax-font，正文对齐 16 Pro Max', () => {
    expect(shuimingResult).toContain("classList.add('app-ios-iphone14promax')");
    expect(shuimingResult).toContain('iPhone15,3');
    expect(shuimingResult).toContain('html.app-ios-iphone14promax.app-ios-iphone-promax-font body.page-shuiming-result .header-title');
    expect(shuimingResult).toContain('html.app-ios-iphone14promax.app-ios-iphone-promax-font body.page-shuiming-result .summary-label');
    expect(shuimingResult).toContain('html.app-ios-iphone14promax.app-ios-iphone-promax-font body.page-shuiming-result .list-title');
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone14promax\.app-ios-iphone-promax-font body\.page-shuiming-result \.header-title \{[\s\S]{0,40}font-size:\s*20px/
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone14promax\.app-ios-iphone-promax-font body\.page-shuiming-result \.summary-value \{[\s\S]{0,40}font-size:\s*19px/
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone14promax\.app-ios-iphone-promax-font body\.page-shuiming-result \.list-date \{[\s\S]{0,40}font-size:\s*19px/
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone14promax\.app-ios-iphone-promax-font body\.page-shuiming-result \.list-company \{[\s\S]{0,40}font-size:\s*18px/
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone14promax\.app-ios-iphone-promax-font body\.page-shuiming-result \.list-value \{[\s\S]{0,40}font-size:\s*17px/
    );
    expect(shuimingResult).toContain('auth.js?v=20260917-14pm-list');
  });

  it('年度选择页首屏打 14promax，并放大标题/年度行', () => {
    expect(shuiming).toContain("classList.add('app-ios-iphone14promax')");
    expect(shuiming).toContain('html.app-ios-iphone14promax body.page-shuiming .year-label');
    expect(shuiming).toMatch(
      /html\.app-ios-iphone14promax body\.page-shuiming \.year-value \{[\s\S]{0,40}font-size:\s*18px/
    );
    expect(shuiming).toContain('auth.js?v=20260917-14pm-list');
  });

  it('我的页 14 Pro Max 单独回退到 9/1 底图，隐藏 HTML 胶囊避免叠字', () => {
    expect(mine).toContain('mine14pmTopLock');
    expect(mine).toContain('data-mine-14pm-plain');
    expect(mine).toContain('__applyMine14pmPlain');
    expect(mine).toContain('__mine14pmDetect');
    expect(mine).not.toContain('class="mine-e1-shortcut-mask"');
    expect(mine).not.toContain('mine-e1-label-family');
    expect(mine).toContain('html[data-mine-14pm-plain] body.page-mine .mine-e1-pill');
    expect(mine).toContain('auth.js?v=20260917-matepad115s-name');
    expect(auth).toContain('html[data-mine-14pm-plain] body.page-mine .mine-e1-pill{visibility:hidden!important;opacity:0!important;}');
    expect(auth).toContain('safeTop >= 54');
    expect(auth).not.toContain('top:calc(748 * var(--mine-rpx))');
    expect(auth).not.toMatch(/xiaomi13ultra \|\|[\s\S]{0,40}ip14pm/);
  });

  it('登录页 14 Pro Max 放大标题/输入并加宽表单', () => {
    expect(login).toContain("classList.add('app-ios-iphone14promax')");
    expect(login).toContain('iPhone15,3');
    expect(login).toContain('html.app-ios-iphone14promax body.page-login .header-title');
    expect(login).toMatch(
      /html\.app-ios-iphone14promax body\.page-login \.header-title \{[\s\S]{0,40}font-size:\s*20px/
    );
    expect(login).toMatch(
      /html\.app-ios-iphone14promax body\.page-login \.form-label,[\s\S]{0,80}font-size:\s*17px/
    );
    expect(login).toContain('max-width: 390px');
    expect(login).toContain('auth.js?v=20260917-iphone14pm-ui');
  });
});
