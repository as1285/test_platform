import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const indirectEval = eval;
const html = readFileSync(resolve(__dirname, '../../renzhi.html'), 'utf8');
const core = readFileSync(resolve(__dirname, '../../public/js/consult-core.js'), 'utf8');

function loadRenzhiHelpers() {
  const m = html.match(
    /<script>\s*(function escAttr[\s\S]*?)bindEmptyGuide\(\);\s*loadEmployerList\(\);/
  );
  if (!m) throw new Error('renzhi empty-guide helpers not found');
  indirectEval(m[1]);
}

function mountGuideDom() {
  document.body.innerHTML =
    '<div id="listContainer"></div>' +
    '<div id="renzhiEmptyGuide" class="rz-guide-root" hidden>' +
    '<div class="rz-guide-mask" id="renzhiEmptyGuideMask"></div>' +
    '<button type="button" id="renzhiEmptyGuideLater">稍后再说</button>' +
    '<button type="button" id="renzhiEmptyGuideGo">去添加</button>' +
    '</div>';
  localStorage.clear();
  localStorage.setItem('user_id', 'u-test');
  loadRenzhiHelpers();
  window.bindEmptyGuide();
}

describe('renzhi empty first-visit guide', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('shows guide only on first confirmed empty list', () => {
    mountGuideDom();
    window.showEmpty(true);
    const root = document.getElementById('renzhiEmptyGuide');
    expect(root.classList.contains('is-open')).toBe(true);
    expect(root.hidden).toBe(false);
    expect(localStorage.getItem('renzhi_empty_guide_v1:u-test')).toBe('1');
    window.closeEmptyGuide();
    expect(root.classList.contains('is-open')).toBe(false);
    window.showEmpty(true);
    expect(root.classList.contains('is-open')).toBe(false);
  });

  it('does not popup when employer list failed to load', () => {
    mountGuideDom();
    window.showEmpty(false);
    expect(document.getElementById('renzhiEmptyGuide').classList.contains('is-open')).toBe(false);
    expect(localStorage.getItem('renzhi_empty_guide_v1:u-test')).toBe(null);
  });

  it('empty state links to consult add-employer form', () => {
    mountGuideDom();
    window.showEmpty(true);
    const a = document.querySelector('.empty-add-link');
    expect(a).toBeTruthy();
    expect(a.getAttribute('href')).toContain('consult.html?tab=employers&open=employer');
    expect(a.getAttribute('href')).toContain('user_id=u-test');
  });

  it('go-add jumps to consult employer form', () => {
    mountGuideDom();
    const href = window.addEmployerHref();
    expect(href).toBe('consult.html?tab=employers&open=employer&user_id=u-test');
  });
});

describe('consult-core open employer from url', () => {
  it('auto-opens add form when open=employer', () => {
    expect(core).toContain('function tryOpenEmployerFormFromUrl');
    expect(core).toContain("getUrlParam('open') === 'employer'");
    expect(core).toContain('tryOpenEmployerFormFromUrl()');
    expect(core).toContain('scrollToEmployerForm()');
  });
});
