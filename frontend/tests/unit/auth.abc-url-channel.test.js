import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function setPageSearch(search) {
  window.history.pushState({}, '', '/purchase.html' + (search || ''));
}

beforeAll(() => {
  window.localStorage.clear();
  window.CLIENT_APP_VERSION = 'unit-test';
  const code = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
  // eslint-disable-next-line no-eval
  eval(code);
});

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  setPageSearch('');
});

describe('abc channel is URL-only', () => {
  it('counts as abc only when the page URL has ch=abc', () => {
    setPageSearch('?ch=abc');
    expect(window.getSalesChannel()).toBe('abc');
    expect(window.isUrlOnlySalesChannel('abc')).toBe(true);
  });

  it('does not count leftover localStorage abc without URL', () => {
    window.localStorage.setItem(
      'sales_channel_v1',
      JSON.stringify({ ch: 'abc', at: Date.now(), source: 'url', permanent: true })
    );
    setPageSearch('');
    expect(window.getSalesChannel()).toBe('');
  });

  it('still uses other stored channels without URL', () => {
    window.localStorage.setItem(
      'sales_channel_v1',
      JSON.stringify({ ch: 'github', at: Date.now(), source: 'url', permanent: true })
    );
    setPageSearch('');
    expect(window.getSalesChannel()).toBe('github');
  });

  it('logged-in install-packages URL includes abc from the page URL', () => {
    window.localStorage.setItem('token', 't');
    setPageSearch('?ch=abc');
    expect(window.getPublicInstallPackagesUrl()).toContain('sales_ch=abc');
    window.localStorage.removeItem('token');
    /* 清掉 URL-only 会话记忆，单独验证残留 localStorage abc 不生效 */
    window.sessionStorage.clear();
    setPageSearch('');
    window.localStorage.setItem(
      'sales_channel_v1',
      JSON.stringify({ ch: 'abc', at: Date.now(), source: 'url', permanent: true })
    );
    expect(window.getPublicInstallPackagesUrl()).toBe('/api/public/install-packages');
  });

  it('keeps abc in the same tab via sessionStorage after URL loses ch', () => {
    setPageSearch('?ch=abc');
    expect(window.getSalesChannel()).toBe('abc');
    setPageSearch('/mine.html');
    expect(window.getSalesChannel()).toBe('abc');
    expect(window.localStorage.getItem('sales_channel_v1')).toBe(null);
    const sess = JSON.parse(window.sessionStorage.getItem('sales_channel_url_only_session_v1'));
    expect(sess.ch).toBe('abc');
  });

  it('binds abc into register sales channel only when URL has ch=abc', () => {
    setPageSearch('?ch=abc');
    expect(window.getRegisterSalesChannel(true)).toBe('abc');
    setPageSearch('?ch=github');
    expect(window.getRegisterSalesChannel(false)).toBe('github');
    window.localStorage.setItem(
      'sales_channel_v1',
      JSON.stringify({ ch: 'abc', at: Date.now(), source: 'url', permanent: true })
    );
    setPageSearch('');
    expect(window.getRegisterSalesChannel(true)).toBe('');
  });
});
