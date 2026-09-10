import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const adminJs = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const adminHtml = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');

describe('安装统计：全站注册不跟安装页 UV 比', () => {
  it('卡片改为全站注册，不再写占 UV', () => {
    expect(adminJs).toContain("ud-label\">全站注册");
    expect(adminJs).toContain('含未走安装页 · 同IP去重');
    expect(adminJs).not.toContain('按同一 IP 去重 · 占 UV ');
    expect(adminHtml).toContain('全站注册含 App / 分享 / 首页等未打开安装页的账号');
  });
});
