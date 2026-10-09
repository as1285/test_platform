import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const purchase = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');

describe('purchase 支付页广告暂关', () => {
  it('新站也不再展示二次退税广告块', () => {
    expect(purchase).toContain('id="purchaseRefundAd"');
    expect(purchase).toContain('开通页二次退税广告暂关（含新站 getjob68）');
    expect(purchase).toContain('新站/旧站开通页均暂不展示二次退税广告');
    expect(purchase).toContain('新站广告暂关，不再插在套餐上方');
    /* 布局不再把广告插在套餐前 */
    expect(purchase).not.toMatch(
      /orderAfterHero\(\[\s*benefits,\s*offerBanner,\s*refundAdEntry/
    );
  });
});
