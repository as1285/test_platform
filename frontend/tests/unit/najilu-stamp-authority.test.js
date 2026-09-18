import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const najiluJs = readFileSync(resolve(__dirname, '../../public/js/najilu.js'), 'utf8');

function load() {
  delete window.TaxIssueCertificate;
  // eslint-disable-next-line no-eval
  eval(najiluJs);
  return window.TaxIssueCertificate;
}

describe('纳税记录章用个税流水税务机关到区级', () => {
  beforeEach(() => {
    delete window.TaxIssueCertificate;
  });

  it('区局、新区、开发区、县局保持原级，不上收到市局', () => {
    const { authorityToDistrictStampText } = load();
    expect(authorityToDistrictStampText('国家税务总局南京市鼓楼区税务局')).toBe(
      '国家税务总局南京市鼓楼区税务局'
    );
    expect(authorityToDistrictStampText('国家税务总局郑州市金水区税务局')).toBe(
      '国家税务总局郑州市金水区税务局'
    );
    expect(authorityToDistrictStampText('国家税务总局上海市浦东新区税务局')).toBe(
      '国家税务总局上海市浦东新区税务局'
    );
    expect(authorityToDistrictStampText('国家税务总局武汉东湖新技术开发区税务局')).toBe(
      '国家税务总局武汉东湖新技术开发区税务局'
    );
    expect(authorityToDistrictStampText('国家税务总局长丰县税务局')).toBe(
      '国家税务总局长丰县税务局'
    );
    expect(authorityToDistrictStampText('国家税务总局南京市税务局')).toBe(
      '国家税务总局南京市税务局'
    );
  });

  it('分局、税务所收到区/市局', () => {
    const { authorityToDistrictStampText } = load();
    expect(authorityToDistrictStampText('国家税务总局南京市鼓楼区税务局第一税务所')).toBe(
      '国家税务总局南京市鼓楼区税务局'
    );
    expect(authorityToDistrictStampText('国家税务总局南京市税务局第一税务分局')).toBe(
      '国家税务总局南京市税务局'
    );
  });

  it('章面取本次开具流水里出现最多的区局', () => {
    const { stampAuthority } = load();
    expect(
      stampAuthority([
        { tax_authority: '国家税务总局南京市鼓楼区税务局' },
        { tax_authority: '国家税务总局南京市鼓楼区税务局' },
        { tax_authority: '国家税务总局郑州市金水区税务局' }
      ])
    ).toBe('国家税务总局南京市鼓楼区税务局');
  });

  it('次数相同则用更靠后（更新）的流水机关', () => {
    const { stampAuthority } = load();
    expect(
      stampAuthority([
        { tax_authority: '国家税务总局南京市鼓楼区税务局' },
        { tax_authority: '国家税务总局郑州市金水区税务局' }
      ])
    ).toBe('国家税务总局郑州市金水区税务局');
  });
});
