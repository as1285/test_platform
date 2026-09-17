import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const suffixSrc = readFileSync(resolve(__dirname, '../../public/js/email-suffix.js'), 'utf8');
const registerHtml = readFileSync(resolve(__dirname, '../../register.html'), 'utf8');
const purchaseHtml = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');
const gerenxinxiHtml = readFileSync(resolve(__dirname, '../../gerenxinxi.html'), 'utf8');
const guideSrc = readFileSync(resolve(__dirname, '../../public/js/conversion-guide.js'), 'utf8');
const authSrc = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

function loadSuffix() {
  delete window.EmailSuffix;
  // eslint-disable-next-line no-eval
  eval(suffixSrc);
  return window.EmailSuffix;
}

describe('邮箱后缀补全', () => {
  it('只替换域名，不拿手机号编造地址', () => {
    const api = loadSuffix();
    expect(api.applyEmailDomainSuffix('2504962165', '@qq.com')).toBe('2504962165@qq.com');
    expect(api.applyEmailDomainSuffix('2504962165@163.com', '@qq.com')).toBe('2504962165@qq.com');
    expect(api.applyEmailDomainSuffix('2504962165@', '@163.com')).toBe('2504962165@163.com');
    expect(api.applyEmailDomainSuffix('  name  ', '163.com')).toBe('name@163.com');
    expect(api.applyEmailDomainSuffix('', '@qq.com')).toBe('@qq.com');
    expect(api.applyEmailDomainSuffix('13800138000', '@qq.com')).toBe('13800138000@qq.com');
  });

  it('校验与产品规则一致，拦截乱填', () => {
    const api = loadSuffix();
    expect(api.isValidUserEmail('2504962165@qq.com')).toBe(true);
    expect(api.isValidUserEmail('name@163.com')).toBe(true);
    expect(api.isValidUserEmail('@qq.com')).toBe(false);
    expect(api.isValidUserEmail('123@qq.com')).toBe(false);
    expect(api.isValidUserEmail('1794294569@i')).toBe(false);
  });

  it('点击后缀按钮写入输入框', () => {
    const api = loadSuffix();
    document.body.innerHTML =
      '<input id="email" value="8888">' +
      '<div class="email-suffix-chips" id="chips">' +
      '<button type="button" data-email-suffix="@qq.com">@qq.com</button>' +
      '</div>';
    const input = document.getElementById('email');
    api.wireEmailSuffixChips(document.getElementById('chips'), input);
    document.querySelector('[data-email-suffix="@qq.com"]').click();
    expect(input.value).toBe('8888@qq.com');
  });
});

describe('注册 / 支付 / 引导接入后缀按钮', () => {
  it('注册页有后缀按钮，且不再写不填也能注册', () => {
    expect(registerHtml).toContain('id="emailSuffixChips"');
    expect(registerHtml).toContain('data-email-suffix="@qq.com"');
    expect(registerHtml).toContain('data-email-suffix="@163.com"');
    expect(registerHtml).toContain('开通成功、专属价会发到这个邮箱');
    expect(registerHtml).not.toContain('不填也能注册');
    expect(registerHtml).toContain('email-suffix.js?v=20260907-email-sfx');
  });

  it('支付页没邮箱先收再付，仍可跳过', () => {
    expect(purchaseHtml).toContain('id="purchaseEmailMask"');
    expect(purchaseHtml).toContain('function shouldCollectPurchaseEmail');
    expect(purchaseHtml).toContain('function openPurchaseEmailGate');
    expect(purchaseHtml).toContain('保存邮箱并付款');
    expect(purchaseHtml).toContain('先付款，不开通回执');
    expect(purchaseHtml).toContain('shouldCollectPurchaseEmail() && !alipayPendingPayUrl');
    expect(purchaseHtml).toContain('email-suffix.js?v=20260907-email-sfx');
  });

  it('注册后引导和个人信息也有后缀按钮', () => {
    expect(guideSrc).toContain('id="cgEmailSuffixChips"');
    expect(guideSrc).toContain('data-email-suffix="@qq.com"');
    expect(guideSrc).toContain('填 QQ 号后点 @qq.com 即可');
    expect(guideSrc).toContain('hasEmail: function');
    expect(guideSrc).toContain('setHasEmail: function');
    expect(gerenxinxiHtml).toContain('id="emailSuffixChips"');
    expect(gerenxinxiHtml).toContain('function bindProfileEmailSuffix');
    expect(gerenxinxiHtml).not.toMatch(/alert\(['"]纳税人识别号/);
    expect(gerenxinxiHtml).toContain('data-taxid-view="inline"');
  });

  it('auth 注入新版 conversion-guide 与 email-suffix', () => {
    expect(authSrc).toContain('email-suffix.js?v=20260907-email-sfx');
    expect(authSrc).toContain('conversion-guide.js?v=20260908-no-qr-guide');
  });
});
