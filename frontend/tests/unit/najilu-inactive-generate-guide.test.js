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

describe('纳税记录生成不再弹替换完税二维码', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    delete window.ConversionGuide;
    delete window.TaxIssueCertificate;
  });

  it('仍可读取激活态；未激活也不再拦截生成', () => {
    const helpers = loadNajiluHelpers();
    localStorage.setItem('account_active', '0');
    expect(helpers.isClientAccountActive()).toBe(false);
    expect(helpers.shouldGuideInactiveGenerate()).toBe(true);

    localStorage.setItem('account_active', '1');
    expect(helpers.isClientAccountActive()).toBe(true);
    expect(helpers.shouldGuideInactiveGenerate()).toBe(false);
  });

  it('替换页链接仍可用（咨询等入口）', () => {
    const helpers = loadNajiluHelpers();
    expect(helpers.najiluQrReplaceHref('najilu_generate')).toBe(
      'najilu_qr.html?from=najilu_generate'
    );
    expect(helpers.najiluQrReplaceHref()).toBe('najilu_qr.html?from=najilu');
  });

  it('未激活引导函数为空实现，不插入弹层', () => {
    const helpers = loadNajiluHelpers();
    localStorage.setItem('account_active', '0');
    helpers.showInactiveGenerateGuide();
    expect(document.getElementById('najilu-qr-guide-root')).toBe(null);
    expect(document.body.textContent).not.toContain('请先替换完税二维码');
  });

  it('首次生成引导为空实现，onContinue 仍会执行', () => {
    const helpers = loadNajiluHelpers();
    localStorage.setItem('account_active', '1');
    expect(helpers.shouldGuideFirstGenerateQr()).toBe(true);
    let continued = false;
    helpers.showFirstGenerateQrGuide({
      allowContinue: true,
      onContinue: function () {
        continued = true;
      }
    });
    expect(continued).toBe(true);
    expect(document.getElementById('najilu-qr-guide-root')).toBe(null);
  });

  it('开具页点击生成不弹引导层', () => {
    document.body.innerHTML =
      '<input type="month" id="rangeStartInput" value="2026-01">' +
      '<input type="month" id="rangeEndInput" value="2026-03">' +
      '<span id="rangeStartLabel">2026-01</span>' +
      '<span id="rangeEndLabel">2026-03</span>' +
      '<div id="sliderLane"><span id="sliderHint"></span>' +
      '<div id="sliderHandle" class="verified"></div></div>' +
      '<button type="button" id="generateBtn">生成纳税记录</button>' +
      '<a href="#" id="viewRecordsLink">查看申请记录</a>';
    const loc = {
      pathname: '/najilu.html',
      href: 'http://localhost/najilu.html',
      search: '',
      replace: function () {}
    };
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: loc });
    window.alert = function () {};
    localStorage.setItem('account_active', '0');
    loadNajiluHelpers();
    const btn = document.getElementById('generateBtn');
    btn.disabled = false;
    btn.click();
    expect(document.getElementById('najilu-qr-guide-root')).toBe(null);
    expect(document.body.textContent).not.toContain('去替换');
  });

  it('源码去掉拦截弹框文案与生成按钮 capture 拦截', () => {
    expect(najiluHtml).toContain('id="generateBtn"');
    expect(najiluHtml).not.toContain('id="najiluQrReplaceLink"');
    expect(najiluJs).not.toContain('请先替换完税二维码');
    expect(najiluJs).not.toContain('建议先替换完税二维码');
    expect(najiluJs).not.toContain('najilu-qr-guide-root');
    expect(najiluJs).toContain('showFirstGenerateQrGuide');
    expect(guideJs).toContain('openInactiveNajiluGenerateGuide');
    expect(guideJs).not.toContain('请先替换完税二维码');
    expect(guideJs).not.toContain("goNajiluQrReplace('najilu_generate')");
  });
});
