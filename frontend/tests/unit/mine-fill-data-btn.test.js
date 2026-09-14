import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');
const consultHtml = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
const consultCss = readFileSync(resolve(__dirname, '../../css/consult.css'), 'utf8');
const consultCore = readFileSync(resolve(__dirname, '../../public/js/consult-core.js'), 'utf8');
const guideSrc = readFileSync(resolve(__dirname, '../../public/js/conversion-guide.js'), 'utf8');

function loadGuide() {
  window.__cgCapturePrivacyBound = false;
  delete window.ConversionGuide;
  window.trackUserAction = vi.fn();
  window.fetch = vi.fn(() => Promise.reject(new Error('offline')));
  // eslint-disable-next-line no-eval
  eval(guideSrc);
  return window.ConversionGuide;
}

describe('我的页左上角填写数据按钮', () => {
  it('已去掉左上角填写 / 查看数据入口', () => {
    expect(mine).not.toContain('id="mineFillDataBtn"');
    expect(mine).not.toContain('class="mine-fill-data-btn"');
    expect(mine).not.toContain('填写数据');
    expect(mine).not.toContain('.mine-fill-data-btn');
    expect(consultHtml).not.toContain('id="consultFillEntryToggle"');
    expect(consultHtml).not.toContain('隐藏填写');
    expect(consultCss).not.toContain('.consult-fill-entry-toggle');
    expect(consultCore).not.toContain('function initConsultFillEntryToggle');
    expect(consultHtml).toContain('consult.css?v=20260914-same-month');
    expect(consultHtml).toContain('consult-core.js?v=20260914-same-month');
  });
});

describe('填写数据入口开关运行时', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.documentElement.classList.remove('cg-mine-fill-data-off');
    document.body.removeAttribute('data-cg-tax-edit-ui');
    document.body.removeAttribute('data-cg-screenshot-ui');
    window.__cgCapturePrivacyBound = false;
    vi.stubGlobal('location', {
      href: 'http://localhost/consult.html?tab=records',
      pathname: '/consult.html',
      search: '?tab=records',
      assign: vi.fn(),
      replace: vi.fn()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    document.documentElement.classList.remove('cg-mine-fill-data-off');
  });

  it('goMineFillData 仍跳到个税记录页', () => {
    const cg = loadGuide();
    cg.goMineFillData();
    expect(window.location.href).toMatch(/consult\.html\?tab=records/);
  });
});
