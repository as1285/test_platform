import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');
const consultHtml = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
const consultCss = readFileSync(resolve(__dirname, '../../css/consult.css'), 'utf8');
const consultCore = readFileSync(resolve(__dirname, '../../public/js/consult-core.js'), 'utf8');
const guideSrc = readFileSync(resolve(__dirname, '../../public/js/conversion-guide.js'), 'utf8');
const authSrc = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

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
  it('有左上角填写数据按钮节点与样式', () => {
    expect(mine).toContain('id="mineFillDataBtn"');
    expect(mine).toContain('class="mine-fill-data-btn"');
    expect(mine).toContain('填写数据');
    expect(mine).toContain('.mine-fill-data-btn');
    expect(mine).toContain('left: 16px');
    expect(mine).toContain("localStorage.getItem('cg_mine_fill_data_btn') === '0'");
    expect(mine).toMatch(/mineFillDataBtn\.addEventListener\('click'[\s\S]*goMineFillDataPage/);
  });

  it('隐藏态与截图模式会藏掉按钮', () => {
    expect(mine).toContain('html.cg-mine-fill-data-off body.page-mine .mine-fill-data-btn');
    expect(mine).toContain('html.cg-screenshot-mode body.page-mine .mine-fill-data-btn');
    expect(guideSrc).toContain("MINE_FILL_DATA_BTN_KEY = 'cg_mine_fill_data_btn'");
    expect(guideSrc).toContain('#mineFillDataBtn');
    expect(authSrc).toContain('conversion-guide.js?v=20260907-no-refund-force');
    expect(mine).toContain('auth.js?v=20260907-fill-btn');
  });
});

describe('个税记录修改页控制我的页填写入口', () => {
  it('右上角有显示/隐藏开关', () => {
    expect(consultHtml).toContain('id="consultFillEntryToggle"');
    expect(consultHtml).toContain('隐藏填写');
    expect(consultCss).toContain('.consult-fill-entry-toggle');
    expect(consultCss).toContain('right: 12px');
    expect(consultCore).toContain('function initConsultFillEntryToggle');
    expect(consultCore).toContain('function setMineFillDataBtn');
    expect(consultCore).toContain("btn.textContent = on ? '隐藏填写' : '显示填写'");
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

  it('默认显示，关闭后写入 localStorage 并打隐藏 class', () => {
    document.body.innerHTML =
      '<button type="button" id="consultFillEntryToggle">隐藏填写</button>' +
      '<button type="button" id="mineFillDataBtn">填写数据</button>';
    const cg = loadGuide();
    expect(cg.isMineFillDataBtnOn()).toBe(true);
    expect(document.documentElement.classList.contains('cg-mine-fill-data-off')).toBe(false);

    cg.setMineFillDataBtn(false);
    expect(localStorage.getItem('cg_mine_fill_data_btn')).toBe('0');
    expect(document.documentElement.classList.contains('cg-mine-fill-data-off')).toBe(true);
    expect(document.getElementById('consultFillEntryToggle').textContent).toBe('显示填写');

    cg.setMineFillDataBtn(true);
    expect(localStorage.getItem('cg_mine_fill_data_btn')).toBe(null);
    expect(document.documentElement.classList.contains('cg-mine-fill-data-off')).toBe(false);
    expect(document.getElementById('consultFillEntryToggle').textContent).toBe('隐藏填写');
  });

  it('goMineFillData 跳到个税记录页', () => {
    const cg = loadGuide();
    cg.goMineFillData();
    expect(window.location.href).toMatch(/consult\.html\?tab=records/);
  });
});
