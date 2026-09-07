import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const userModuleCode = readFileSync(
  resolve(__dirname, '../../public/js/compat-bug.js'),
  'utf8'
);
const adminFeedbackCode = readFileSync(
  resolve(__dirname, '../../public/js/admin/modules/feedback.js'),
  'utf8'
);
const loaderCode = readFileSync(
  resolve(__dirname, '../../public/js/admin/loader.js'),
  'utf8'
);

describe('C 端兼容反馈校验', () => {
  beforeEach(() => {
    delete window.CompatBugFeedback;
    // eslint-disable-next-line no-eval
    eval(userModuleCode);
  });

  it('要求描述且至少 4 个字', () => {
    const mod = window.CompatBugFeedback;
    expect(mod.validateContent('')).toMatch(/问题描述/);
    expect(mod.validateContent('  白屏  ')).toMatch(/至少/);
    expect(mod.validateContent('底部导航被刘海挡住')).toBe('');
  });
});

describe('C 端兼容反馈入口与页面', () => {
  const consultHtml = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
  const pageHtml = readFileSync(resolve(__dirname, '../../compat_bug.html'), 'utf8');
  const adminHtml = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');

  it('我要咨询税务记录与增值服务都有入口', () => {
    expect(consultHtml).toContain('id="compatBugRecordsEntry"');
    expect(consultHtml).toContain('compat_bug.html?from=consult_records');
    expect(consultHtml).toContain('id="compatBugProductEntry"');
    expect(consultHtml).toContain('compat_bug.html?from=consult_products');
    expect(consultHtml).toContain('兼容问题反馈');
    expect(consultHtml).toContain('反馈兼容BUG');
  });

  it('反馈页有标题、描述、选图与提交', () => {
    expect(pageHtml).toContain('反馈兼容 BUG');
    expect(pageHtml).toContain('id="compatBugContent"');
    expect(pageHtml).toContain('id="compatBugInput"');
    expect(pageHtml).toContain('id="compatBugSubmit"');
    expect(pageHtml).toContain('consult.html?tab=products');
    expect(pageHtml).toContain('/js/compat-bug.js?v=20260905-compat-bug');
  });

  it('管理台有兼容反馈页', () => {
    expect(adminHtml).toContain('id="page-feedback"');
    expect(adminHtml).toContain('兼容 BUG 反馈');
    expect(adminHtml).toContain('id="feedbackMount"');
  });

  it('兼容反馈账号可跳到注册用户', () => {
    expect(loaderCode).toContain('feedback.js?v=20260907-fb-user');
    expect(adminFeedbackCode).toContain('jumpToRegisteredUser');
    expect(adminFeedbackCode).toContain('js-feedback-open-user');
    expect(adminFeedbackCode).toContain('admin-user-jump');

    document.body.innerHTML =
      '<div id="feedbackMount"></div><p id="feedbackSummary"></p>';
    window.AdminModules = {};
    window.jumpToRegisteredUser = vi.fn();
    // eslint-disable-next-line no-eval
    eval(adminFeedbackCode);
    window.AdminModules.feedback.renderList({
      total: 1,
      page: 1,
      limit: 30,
      items: [
        {
          id: 9,
          user_id: '2216955147',
          real_name: '鲁思秋',
          device_info: '22041211AC',
          content: '个税详情页面，一直有红色悬浮窗，无法关闭',
          image_count: 1,
          created_at: '2026-09-06T16:53:00+08:00'
        }
      ]
    });
    const btn = document.querySelector('.js-feedback-open-user');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('data-u')).toBe('2216955147');
    expect(btn.textContent).toBe('2216955147');
    btn.click();
    expect(window.jumpToRegisteredUser).toHaveBeenCalledWith('2216955147');
  });
});
