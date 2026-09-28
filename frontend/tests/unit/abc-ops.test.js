import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const src = readFileSync(resolve(__dirname, '../../public/js/admin/modules/abc-ops.js'), 'utf8');
const loader = readFileSync(resolve(__dirname, '../../public/js/admin/loader.js'), 'utf8');
const panel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const css = readFileSync(resolve(__dirname, '../../css/admin_panel.css'), 'utf8');

describe('admin ABC ops module', () => {
  it('ships hub pages, APIs, and cache bust', () => {
    expect(html).toContain('id="page-abc-ops"');
    expect(html).toContain('id="page-abc-users"');
    expect(html).toContain('id="abcOpsFunnel"');
    expect(html).toContain('id="abcOpsUserTbody"');
    expect(html).toContain('href="#abc-ops"');
    expect(html).toContain('admin_panel.js?v=20260907-abc-ops');
    expect(html).toContain('admin_panel.css?v=20260907-abc-ops');
    expect(loader).toContain('abc-ops.js?v=20260907-abc-ops');
    expect(loader).toContain("'abc-users': 'abc-ops'");
    expect(src).toContain('api/admin/ops/abc/overview?days=');
    expect(src).toContain('api/admin/ops/abc/users?');
    expect(src).toContain('api/admin/ops/abc/payments?days=');
    expect(src).toContain('jumpToRegisteredUser');
    expect(panel).toContain("nav: 'abc-ops'");
    expect(panel).toContain("id: 'funnel'");
    expect(panel).toContain("MENU_TREE_VER = 'ops-ia-v23-abc-ops'");
    expect(css).toContain('.abc-ops-funnel');
  });

  it('jumps to registered user from the list', () => {
    document.body.innerHTML =
      '<div id="abcOpsTodayKpi"></div>' +
      '<div id="abcOpsFunnel"></div>' +
      '<div id="abcOpsRates"></div>' +
      '<div id="abcOpsStock"></div>' +
      '<div id="abcOpsVisHint"></div>' +
      '<p id="abcOpsPeriodHint"></p>' +
      '<table><tbody id="abcOpsUserTbody"></tbody></table>' +
      '<p id="abcOpsUserStat"></p>' +
      '<span id="abcOpsUserPageInfo"></span>';
    window.jumpToRegisteredUser = vi.fn();
    window.adminFetch = vi.fn(function () {
      return Promise.resolve({
        json: function () {
          return Promise.resolve({
            code: 200,
            data: { items: [], total: 0, visibility: { sees_new_abc: true } }
          });
        }
      });
    });
    window.AdminModules = {};
    window.location.hash = '#abc-ops/users';
    // eslint-disable-next-line no-eval
    eval(src);
    window.AdminModules['abc-ops'].loadPage();
    var tbody = document.getElementById('abcOpsUserTbody');
    tbody.innerHTML =
      '<tr><td><button type="button" class="admin-user-jump js-abc-open-user" data-u="18929827379">18929827379</button></td></tr>';
    tbody.querySelector('.js-abc-open-user').click();
    expect(window.jumpToRegisteredUser).toHaveBeenCalledWith('18929827379');
  });
});
