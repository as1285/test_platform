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

  it('exposes campaign-stats for SMTP fail rate on the ad hub', () => {
    expect(routes).toContain("'/api/admin/emails/campaign-stats'");
    expect(routes).toContain('handleAdminEmailsCampaignStats');
    expect(routes).toContain('ops-ad-analytics');
  });

  it('API unknown routes respond with JSON 404', () => {
    expect(boot).toContain('jsonApiNotFound');
    expect(boot).toContain('code: 404');
    expect(boot).toContain('jsonApiError');
  });

  it('rewrites multipart-as-JSON parse errors into a readable upload message', () => {
    expect(boot).toContain('------WebK');
    expect(boot).toContain('上传格式不正确，请重新选择文件后重试');
  });
});
