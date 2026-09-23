import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');
const consultHtml = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
const consultCss = readFileSync(resolve(__dirname, '../../css/consult.css'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
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

describe('我的页激活按钮下方填写数据', () => {
  it('激活按钮下方有填写数据入口', () => {
    expect(mine).toContain('id="mineActivateBtn"');
    expect(mine).toContain('id="mineFillDataBtn"');
    expect(mine).toContain('class="mine-fill-data-btn"');
    expect(mine).toContain('填写数据');
    expect(mine).toContain('.mine-fill-data-btn');
    expect(mine).toContain('--mine-fill-data-gap: 44px');
    expect(mine).toContain('body.page-mine.mine-account-active');
    const activateAt = mine.indexOf('id="mineActivateBtn"');
    const fillAt = mine.indexOf('id="mineFillDataBtn"');
    expect(fillAt).toBeGreaterThan(activateAt);
  });

  it('个税记录页右上角可隐藏我的页填写数据按钮', () => {
    expect(consultHtml).toContain('id="consultFillEntryToggle"');
    expect(consultHtml).toContain('class="consult-fill-entry-toggle"');
    expect(consultHtml).toContain('隐藏我的页填写数据按钮');
    expect(consultCss).toContain('.consult-fill-entry-toggle');
    expect(consultCss).toContain('grid-column: 3');
    expect(consultHtml).toContain('consult.css?v=20260923-fill-entry');
    expect(guideSrc).toContain('function bindConsultFillEntryToggle');
    expect(guideSrc).toContain('toggleMineFillDataBtn()');
    expect(guideSrc).toContain('function bindMineFillDataBtn');
    expect(guideSrc).toContain('goMineFillData()');
    expect(auth).toContain('conversion-guide.js?v=20260923-fill-data');
    expect(auth).toContain('var(--mine-fill-data-gap,44px)');
    expect(mine).toContain('left: 16px;');
    expect(mine).toContain('right: auto;');
    expect(auth).toContain('left:16px !important;right:auto !important;');
    expect(auth).toContain('left:18px !important;right:auto !important;');
    expect(auth).not.toContain('.mine-fill-data-btn{top:calc(var(--mine-activate-btn-top-offset,66px) + var(--app-shell-statusbar-top,0px) + var(--mine-fill-data-gap,44px)) !important;right:16px !important;');
  });
});

describe('填写数据入口开关运行时', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '';
    document.body.innerHTML =
      '<button type="button" id="mineFillDataBtn">填写数据</button>' +
      '<button type="button" id="consultFillEntryToggle">隐藏填写</button>';
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

  it('goMineFillData 跳到个税记录页', () => {
    const cg = loadGuide();
    cg.goMineFillData();
    expect(window.location.href).toMatch(/consult\.html\?tab=records/);
  });

  it('我的页填写数据按钮点击后进入个税记录页', () => {
    loadGuide();
    document.getElementById('mineFillDataBtn').click();
    expect(window.location.href).toMatch(/consult\.html\?tab=records/);
  });

  it('右上角开关可隐藏并再显示我的页填写数据按钮', () => {
    loadGuide();
    const btn = document.getElementById('consultFillEntryToggle');
    btn.click();
    expect(localStorage.getItem('cg_mine_fill_data_btn')).toBe('0');
    expect(document.documentElement.classList.contains('cg-mine-fill-data-off')).toBe(true);
    expect(btn.textContent).toBe('显示填写');
    expect(btn.getAttribute('aria-label')).toBe('显示我的页填写数据按钮');
    btn.click();
    expect(localStorage.getItem('cg_mine_fill_data_btn')).toBeNull();
    expect(document.documentElement.classList.contains('cg-mine-fill-data-off')).toBe(false);
    expect(btn.textContent).toBe('隐藏填写');
  });
});
