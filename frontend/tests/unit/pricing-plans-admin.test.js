import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const adminJs = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const adminCss = readFileSync(resolve(__dirname, '../../css/admin_panel.css'), 'utf8');
const purchase = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');

describe('新站支付方案 A/B', () => {
  it('后台可以配置多方案、价格、天数和流量', () => {
    expect(html).toContain('id="pricingPlansSection"');
    expect(html).toContain('id="btnAddPricingPlan"');
    expect(html).toContain('id="btnSavePricingPlans"');
    expect(html).toContain('id="skuCatalogLegacy"');
    expect(html).toContain('class="pricing-plans-toolbar"');
    expect(html).toContain('周卡 ¥100 / 7 天、月卡 ¥150 / 30 天、年卡 ¥200 / 365 天');
    expect(html).toContain('套餐名称、价格和天数都可以改');
    expect(adminJs).toContain('function renderPricingPlans');
    expect(adminJs).toContain('function validatePricingPlansClient');
    expect(adminJs).toContain('pricing_plans: doc');
    expect(adminJs).toContain("title.textContent = on ? '支付方案' : '支付套餐'");
    expect(adminJs).toContain('流量分配合计须为 100%');
    expect(adminJs).toContain('placeholder="如 周卡"');
    expect(adminJs).toContain('请填写套餐名称');
    expect(adminJs).toContain('class="pricing-plan-table"');
    expect(adminJs).toContain("el.classList.toggle('is-ok', ok)");
    expect(adminCss).toContain('.pricing-plan-card');
    expect(adminCss).toContain('.pricing-plans-toolbar');
    expect(html).toContain('id="bidCfgForm"');
    expect(adminJs).toContain('bidCfg.hidden = !!on');
  });

  it('新站支付页兜底是周卡月卡年卡', () => {
    expect(purchase).toContain('GETJOB68_FALLBACK_ALIPAY_SKUS');
    expect(purchase).toContain("id: 'gj_a_week'");
    expect(purchase).toContain("amount: '100.00'");
    expect(purchase).toContain("id: 'gj_a_year'");
    expect(purchase).toContain("amount: '200.00'");
    expect(purchase).toContain('function purchaseHostIsGetjob68');
  });
});
