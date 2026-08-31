import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../refund_ad.html'), 'utf8');

describe('refund_ad bottom guide copy', () => {
  it('has detailed who / how / contact copy below the poster', () => {
    expect(html).toContain('id="refundAdGuide"');
    expect(html).toContain('怎么判断、怎么咨询');
    expect(html).toContain('谁可以先问');
    expect(html).toContain('建议按这 3 步');
    expect(html).toContain('备注「二次退税」');
    expect(html).toContain('id="refundAdNeedEmployer"');
    expect(html).toContain('去添加任职受雇');
    expect(html).toContain('open=employer');
    expect(html).toContain('btnCopyRefundWechatGuide');
  });

  it('shows empty-employer tip from local count and tracks guide jumps', () => {
    expect(html).toContain('function syncNeedEmployerTip');
    expect(html).toContain("localStorage.getItem('employer_count')");
    expect(html).toContain("track_refund_ad_guide_employer");
    expect(html).toContain("track_refund_ad_guide_tax");
  });
});
