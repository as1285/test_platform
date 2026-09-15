import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const panel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const css = readFileSync(resolve(__dirname, '../../css/admin_panel.css'), 'utf8');

function loadAdminToast() {
  const start = panel.indexOf('function adminToast(');
  const end = panel.indexOf('window.adminToast = adminToast;');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  // eslint-disable-next-line no-new-func
  const fn = new Function(panel.slice(start, end + 'window.adminToast = adminToast;'.length) + '\nreturn adminToast;');
  return fn();
}

describe('保存出价配置成功弹出 Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('接线与缓存戳齐全', () => {
    expect(panel).toContain("adminToast(data.msg || '出价配置已保存')");
    expect(panel).toContain("adminToast(data.msg || '保存失败', { type: 'error' })");
    expect(html).toContain('admin_panel.js?v=20260915-subadmin-codes');
    expect(html).toContain('admin_panel.css?v=20260910-bid-toast');
    expect(css).toContain('.admin-toast-host');
    expect(css).toContain('.admin-toast.is-ok');
  });

  it('成功提示会插入绿色 Toast 节点', () => {
    const adminToast = loadAdminToast();
    adminToast('出价配置已保存');
    const host = document.getElementById('adminToastHost');
    expect(host).toBeTruthy();
    const el = host.querySelector('.admin-toast');
    expect(el).toBeTruthy();
    expect(el.textContent).toBe('出价配置已保存');
    expect(el.className).toContain('is-ok');
    expect(el.className).not.toContain('is-err');
  });

  it('失败提示走错误样式', () => {
    const adminToast = loadAdminToast();
    adminToast('保存失败', { type: 'error' });
    const el = document.querySelector('.admin-toast');
    expect(el.textContent).toBe('保存失败');
    expect(el.className).toContain('is-err');
  });
});
