import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const src = readFileSync(resolve(__dirname, '../../public/js/admin/modules/user-emails.js'), 'utf8');
const loader = readFileSync(resolve(__dirname, '../../public/js/admin/loader.js'), 'utf8');

describe('admin email console', () => {
  it('ships overview, send filters, and preview controls', () => {
    expect(html).toContain('id="userEmailOverviewCards"');
    expect(html).toContain('id="userEmailAutoList"');
    expect(html).toContain('id="userEmailSendAudience"');
    expect(html).toContain('id="userEmailSendPreview"');
    expect(html).toContain('id="userEmailHalf"');
    expect(html).toContain('退税测算邮件已停发');
    expect(loader).toContain('user-emails.js?v=20260907-email-hub');
    expect(src).toContain('function loadOverview');
    expect(src).toContain('function audienceLabel');
    expect(src).toContain('jumpToRegisteredUser');
    expect(src).toContain('function previewSend');
    expect(src).toContain('api/admin/emails/overview?days=7');
  });

  it('jumps to registered user from send log', () => {
    document.body.innerHTML =
      '<table><tbody id="userEmailSendTbody"><tr><td><button type="button" class="admin-user-jump js-user-email-open-user" data-u="2216955147">2216955147</button></td></tr></tbody></table>' +
      '<div id="userEmailOverviewCards"></div>' +
      '<div id="userEmailAutoList"></div>' +
      '<p id="userEmailOverviewStat"></p>' +
      '<p id="userEmailStat"></p>' +
      '<p id="userEmailSendStat"></p>';
    window.jumpToRegisteredUser = vi.fn();
    window.adminFetch = vi.fn(function () {
      return Promise.resolve({
        status: 200,
        text: function () {
          return Promise.resolve(
            JSON.stringify({
              code: 200,
              data: { users: [], items: [], auto: [], sent: 0, failed: 0, clicked: 0 }
            })
          );
        }
      });
    });
    window.AdminModules = {};
    // eslint-disable-next-line no-eval
    eval(src);
    window.AdminModules['user-emails'].loadPage();
    var tbody = document.getElementById('userEmailSendTbody');
    tbody.innerHTML =
      '<tr><td><button type="button" class="admin-user-jump js-user-email-open-user" data-u="2216955147">2216955147</button></td></tr>';
    tbody.querySelector('.js-user-email-open-user').click();
    expect(window.jumpToRegisteredUser).toHaveBeenCalledWith('2216955147');
  });
});
