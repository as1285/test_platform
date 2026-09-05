import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const frontend = resolve(__dirname, '../..');
const shouye = readFileSync(resolve(frontend, 'shouye.html'), 'utf8');
const pagePath = resolve(frontend, 'zhongdian_fuwu.html');
const page = readFileSync(pagePath, 'utf8');
const storeSrc = readFileSync(resolve(frontend, 'public/js/home-services.js'), 'utf8');
const boot = readFileSync(resolve(frontend, 'public/js/auth-boot.js'), 'utf8');
const auth = readFileSync(resolve(frontend, 'public/js/auth.js'), 'utf8');

function loadStore() {
  // eslint-disable-next-line no-eval
  eval(storeSrc);
  return window.TaxHomeServices;
}

describe('homepage 更多功能 opens 首页重点服务管理', () => {
  it('home card points to zhongdian_fuwu.html, not help_center', () => {
    expect(shouye).toMatch(/href="zhongdian_fuwu\.html"[^>]*aria-label="更多功能"/);
    expect(shouye).not.toMatch(/href="help_center\.html"[^>]*aria-label="更多功能"/);
    expect(shouye).not.toMatch(/href="help_center\.html"[^>]*aria-label="更多服务"/);
    expect(shouye).toContain('/js/home-services.js?v=20260905-zdfw');
  });

  it('scan opens scanner page', () => {
    expect(shouye).toContain("window.location.href = 'scan.html'");
    expect(shouye).not.toContain("window.location.href = 'help_center.html'");
  });

  it('management page matches official copy and +/- handles', () => {
    expect(existsSync(pagePath)).toBe(true);
    expect(page).toContain('<title>首页重点服务管理</title>');
    expect(page).toContain('class="header-title">首页重点服务管理<');
    expect(page).toContain('拖动图标以调整顺序或增减，最多可添加7个服务。');
    expect(page).toContain('当前重点服务');
    expect(page).toContain('更多服务');
    expect(page).toContain('完成');
    expect(page).toContain('返回');
    expect(page).toContain('zdfw-act-minus');
    expect(page).toContain('zdfw-act-plus');
    expect(page).toContain('zdfw-act-dot');
    expect(page).toContain('zdfw-handle');
    expect(page).toContain('data-mode');
    expect(page).toContain('href="shouye.html"');
    expect(page).toContain('/js/home-services.js?v=20260905-zdfw2');
  });

  it('is reachable without login', () => {
    expect(boot).toContain("'zhongdian_fuwu.html': true");
    expect(auth).toContain("'zhongdian_fuwu.html': true");
  });
});

describe('TaxHomeServices catalog and store', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem('tax_home_key_services_v1');
    } catch (e0) {}
    delete window.TaxHomeServices;
  });

  it('defaults to the three homepage slice cards', () => {
    const hs = loadStore();
    expect(hs.DEFAULT_IDS).toEqual(['zonghe', 'shuiming', 'najilu']);
    expect(hs.loadSelectedIds()).toEqual(['zonghe', 'shuiming', 'najilu']);
    expect(hs.getById('zonghe').name).toBe('综合所得年度汇算');
    expect(hs.getById('shuiming').name).toBe('收入纳税明细');
    expect(hs.getById('najilu').name).toBe('纳税记录开具');
    expect(hs.getById('yanglao').name).toBe('个人养老金扣除管理');
    expect(hs.getById('zxk').name).toBe('专项附加扣除');
    expect(hs.getById('weituo').name).toBe('委托代理关系管理');
    expect(hs.getById('gongyi').name).toBe('公益慈善捐赠扣除填报');
    expect(hs.getById('jingying_a').name).toBe('其他经营所得（A表）');
    expect(hs.getById('jingying_b').name).toBe('其他经营所得（B表）');
    expect(hs.getById('jingying').name).toBe('经营所得申报');
    expect(hs.getById('jingying_c').name).toBe('经营所得(C表)');
  });

  it('adds and removes with 1..7 bounds', () => {
    const hs = loadStore();
    expect(hs.addService('yanglao').ok).toBe(true);
    expect(hs.loadSelectedIds()).toEqual(['zonghe', 'shuiming', 'najilu', 'yanglao']);
    expect(hs.removeService('yanglao').ok).toBe(true);
    expect(hs.loadSelectedIds()).toEqual(['zonghe', 'shuiming', 'najilu']);

    hs.saveSelectedIds(['zonghe']);
    const min = hs.removeService('zonghe');
    expect(min.ok).toBe(false);
    expect(min.reason).toBe('min');

    hs.saveSelectedIds(['zonghe', 'shuiming', 'najilu', 'yanglao', 'zxk', 'weituo', 'gongyi']);
    const max = hs.addService('jingying');
    expect(max.ok).toBe(false);
    expect(max.reason).toBe('max');
    expect(max.message).toContain('最多可添加7个服务');
  });

  it('reorders and groups remaining services under 办税', () => {
    const hs = loadStore();
    hs.saveSelectedIds(['zonghe', 'shuiming', 'najilu']);
    expect(hs.moveService('najilu', 0).ids).toEqual(['najilu', 'zonghe', 'shuiming']);
    const groups = hs.moreServicesByCategory(['zonghe', 'shuiming', 'najilu', 'yanglao']);
    expect(groups.some(function (g) { return g.category === '办税'; })).toBe(true);
    const tax = groups.filter(function (g) { return g.category === '办税'; })[0];
    const names = tax.items.map(function (it) { return it.name; });
    expect(names).toContain('专项附加扣除');
    expect(names).toContain('经营所得申报');
    expect(names).not.toContain('综合所得年度汇算');
    expect(names).not.toContain('个人养老金扣除管理');
  });
});
