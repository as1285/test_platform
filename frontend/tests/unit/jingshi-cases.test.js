import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const frontend = resolve(__dirname, '../..');
const shouye = readFileSync(resolve(frontend, 'shouye.html'), 'utf8');
const jingshiPath = resolve(frontend, 'jingshi.html');
const jingshi = readFileSync(jingshiPath, 'utf8');
const sousuo = readFileSync(resolve(frontend, 'sousuo.html'), 'utf8');
const boot = readFileSync(resolve(frontend, 'public/js/auth-boot.js'), 'utf8');
const auth = readFileSync(resolve(frontend, 'public/js/auth.js'), 'utf8');
const admin = readFileSync(resolve(frontend, 'public/js/admin_panel.js'), 'utf8');

describe('homepage 查看更多 opens 警示案例专题', () => {
  it('查看更多 goes to jingshi.html, not the generic zixun list', () => {
    expect(shouye).toMatch(/href="jingshi\.html"[^>]*sy-hit-more/);
    expect(shouye).toMatch(/href="jingshi\.html"[^>]*aria-label="查看更多"/);
    expect(shouye).not.toMatch(/href="zixun\.html"[^>]*sy-hit-more/);
    expect(shouye).toMatch(/href="zixun\.html"[^>]*sy-hit-news/);
  });

  it('查看资讯 / 扫一扫 keep targets; 更多功能 opens service manager', () => {
    expect(shouye).toMatch(/href="zixun\.html"[^>]*sy-hit-news/);
    expect(shouye).toMatch(/href="zhongdian_fuwu\.html"[^>]*aria-label="更多功能"/);
    expect(shouye).not.toMatch(/href="help_center\.html"[^>]*aria-label="更多服务"/);
    expect(shouye).toContain("window.location.href = 'scan.html'");
    expect(shouye).not.toContain("window.location.href = 'help_center.html'");
  });

  it('jingshi page matches 综合所得年度汇算 · 警示案例 special UI', () => {
    expect(existsSync(jingshiPath)).toBe(true);
    expect(jingshi).toContain('<title>综合所得年度汇算 · 警示案例</title>');
    expect(jingshi).toContain('综合所得年度汇算');
    expect(jingshi).toContain('警示案例');
    expect(jingshi).toContain('虚假申报案例');
    expect(jingshi).toContain('风险提示案例');
    expect(jingshi).toContain('网警重要提醒');
    expect(jingshi).toContain('案例');
    expect(jingshi).toContain('...全文');
    expect(jingshi).toContain('未依法办理个人所得税综合所得汇算清缴案件');
    expect(jingshi).toContain('未在法定期限内办理综合所得汇算清缴、虚假填报子女教育专项附加扣除案件');
    expect(jingshi).toContain('办理汇算想便捷 APP密码要记牢');
    expect(jingshi).toContain('获取退税想及时 准确卡号必须有');
    expect(jingshi).toContain('谨防假冒税务机关诈骗');
    expect(jingshi).toContain('openJingshiDetail');
    expect(jingshi).toContain('jsDetail');
    expect(jingshi).toContain('演示');
    expect(jingshi).toContain('href="shouye.html"');
    expect(jingshi).not.toContain('class="header-title">资讯<');
    expect(jingshi).not.toContain('bottom-nav');
  });

  it('bumps cache stamps on the new page and homepage assets', () => {
    expect(jingshi).toContain('auth-boot.js?v=20260905-no-home-refund');
    expect(jingshi).toContain('auth.js?v=20260905-no-home-refund');
    expect(shouye).toContain('auth-boot.js?v=20260918-ios27-short');
    expect(shouye).toContain('auth.js?v=20260918-ios27-short');
    expect(shouye).toContain('nav.css?v=20260910-ios-14pm-fb1');
  });

  it('is reachable without login and titled in admin analytics', () => {
    expect(boot).toContain("'jingshi.html': true");
    expect(auth).toContain("'jingshi.html': true");
    expect(admin).toContain("'jingshi.html': '警示案例'");
  });

  it('search catalog can open the special page via 查看更多 / 警示案例', () => {
    expect(sousuo).toContain("href: 'jingshi.html'");
    expect(sousuo).toContain('查看更多');
    expect(sousuo).toContain('综合所得年度汇算警示案例');
    expect(sousuo).toContain("href: 'zixun.html'");
  });
});
