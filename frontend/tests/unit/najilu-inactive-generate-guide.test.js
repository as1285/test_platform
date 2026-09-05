import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const najiluJs = readFileSync(resolve(__dirname, '../../public/js/najilu.js'), 'utf8');
const guideJs = readFileSync(resolve(__dirname, '../../public/js/conversion-guide.js'), 'utf8');
const najiluHtml = readFileSync(resolve(__dirname, '../../najilu.html'), 'utf8');

function loadNajiluHelpers() {
  delete window.TaxIssueCertificate;
  delete window.ConversionGuide;
  // eslint-disable-next-line no-eval
  eval(najiluJs);
  return window.TaxIssueCertificate;
}

describe('未激活生成纳税记录引导替换完税二维码', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    delete window.ConversionGuide;
    delete window.TaxIssueCertificate;
  });

  it('沿用 account_active，未激活拦截、已激活放行', () => {
    const helpers = loadNajiluHelpers();
    localStorage.setItem('account_active', '0');
    expect(helpers.isClientAccountActive()).toBe(false);
    expect(helpers.shouldGuideInactiveGenerate()).toBe(true);

    localStorage.setItem('account_active', '1');
    expect(helpers.isClientAccountActive()).toBe(true);
    expect(helpers.shouldGuideInactiveGenerate()).toBe(false);
  });

  it('主操作跳到现有完税二维码替换页', () => {
    const helpers = loadNajiluHelpers();
    expect(helpers.najiluQrReplaceHref('najilu_generate')).toBe(
      'najilu_qr.html?from=najilu_generate'
    );
    expect(helpers.najiluQrReplaceHref()).toBe('najilu_qr.html?from=najilu');
  });

  it('未激活弹层可取消回到表单，主按钮去替换', () => {
    const helpers = loadNajiluHelpers();
    localStorage.setItem('account_active', '0');
    helpers.showInactiveGenerateGuide();
    const root = document.getElementById('najilu-qr-guide-root');
    expect(root).toBeTruthy();
    expect(root.textContent).toContain('请先替换完税二维码');
    expect(root.textContent).toContain('去替换');
    expect(root.textContent).toContain('取消');

    root.querySelector('[data-act="close"]').click();
    expect(document.getElementById('najilu-qr-guide-root')).toBe(null);
  });

  it('开具页与转化引导都指向替换完税二维码，不再静默先生成演示版', () => {
    expect(najiluHtml).toContain('id="generateBtn"');
    expect(najiluHtml).toContain('id="najiluQrReplaceLink"');
    expect(najiluJs).toContain('请先替换完税二维码');
    expect(najiluJs).toContain('showInactiveGenerateGuide');
    expect(guideJs).toContain('openInactiveNajiluGenerateGuide');
    expect(guideJs).toContain("goNajiluQrReplace('najilu_generate')");
    expect(guideJs).not.toContain('生成纳税记录需开通');
    expect(guideJs).not.toContain('先生成演示版');
  });
});
