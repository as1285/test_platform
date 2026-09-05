import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const frontend = resolve(__dirname, '../..');
const shouye = readFileSync(resolve(frontend, 'shouye.html'), 'utf8');
const zixunPath = resolve(frontend, 'zixun.html');
const zixun = readFileSync(zixunPath, 'utf8');
const boot = readFileSync(resolve(frontend, 'public/js/auth-boot.js'), 'utf8');
const auth = readFileSync(resolve(frontend, 'public/js/auth.js'), 'utf8');

describe('homepage news opens zixun list', () => {
  it('查看资讯 points to zixun.html; 查看更多 goes to jingshi, not help_center', () => {
    expect(shouye).toMatch(/href="zixun\.html"[^>]*sy-hit-news/);
    expect(shouye).toMatch(/href="jingshi\.html"[^>]*sy-hit-more/);
    expect(shouye).toMatch(/aria-label="查看资讯"/);
    expect(shouye).toMatch(/aria-label="查看更多"/);
    expect(shouye).not.toMatch(/href="zixun\.html"[^>]*sy-hit-more/);
    expect(shouye).not.toMatch(/href="help_center\.html"[^>]*sy-hit-news/);
    expect(shouye).not.toMatch(/href="help_center\.html"[^>]*sy-hit-more/);
    expect(shouye).not.toMatch(/href="help_center\.html"[^>]*aria-label="查看资讯"/);
    expect(shouye).not.toMatch(/href="help_center\.html"[^>]*aria-label="查看更多"/);
  });

  it('更多服务 still goes to help_center; scan opens scanner', () => {
    expect(shouye).toMatch(/href="help_center\.html"[^>]*aria-label="更多服务"/);
    expect(shouye).not.toContain("window.location.href = 'help_center.html'");
    expect(shouye).toContain("window.location.href = 'scan.html'");
  });

  it('zixun page exists with title and homepage news rows', () => {
    expect(existsSync(zixunPath)).toBe(true);
    expect(zixun).toContain('<title>资讯</title>');
    expect(zixun).toContain('class="header-title">资讯<');
    expect(zixun).toContain('href="shouye.html"');
    expect(zixun).toContain('办理汇算想便捷 APP密码要记牢');
    expect(zixun).toContain('获取退税想及时 准确卡号必须有');
    expect(zixun).toContain('未依法办理个人所得税综合所得汇算清缴案件');
    expect(zixun).toContain('未在法定期限内办理综合所得汇算清缴、虚假填报子女教育专项附加扣除案件');
    expect(zixun).toContain('2025-02-28');
    expect(zixun).toContain('2024-03-15');
    expect(zixun).toContain('资讯列表');
    expect(zixun).toContain('openZixunDetail');
    expect(zixun).toContain('zxDetail');
    expect(zixun).toContain('演示');
  });

  it('is reachable without login', () => {
    expect(boot).toContain("'zixun.html': true");
    expect(auth).toContain("'zixun.html': true");
  });
});
