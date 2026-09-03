'use strict';

const fs = require('fs');
const path = require('path');

describe('admin emails/send HTML-safe API surface', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../../src/admin/routes.js'), 'utf8');
  const boot = fs.readFileSync(path.join(__dirname, '../../src/bootstrap.js'), 'utf8');

  it('GET /api/admin/emails/send returns JSON 405 instead of Express HTML 404', () => {
    expect(routes).toContain("app.get('/api/admin/emails/send'");
    expect(routes).toContain("code: 405");
    expect(routes).toContain('请使用 POST 发送邮件');
  });

  it('keeps POST send handler', () => {
    expect(routes).toContain("'/api/admin/emails/send'");
    expect(routes).toContain('handleAdminEmailsSend');
  });

  it('API unknown routes respond with JSON 404', () => {
    expect(boot).toContain('jsonApiNotFound');
    expect(boot).toContain('code: 404');
    expect(boot).toContain('jsonApiError');
  });
});
