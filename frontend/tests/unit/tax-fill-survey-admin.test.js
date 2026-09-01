import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const moduleCode = readFileSync(
  resolve(__dirname, '../../public/js/admin/modules/tax-fill-survey.js'),
  'utf8'
);

describe('admin tax-fill-survey module', () => {
  beforeEach(() => {
    delete window.AdminModules;
    document.body.innerHTML = '<div id="taxFillSurveyMount"></div>';
    // eslint-disable-next-line no-eval
    eval(moduleCode);
  });

  it('renders unhappy topic breakdown and suggestion text', () => {
    const mod = window.AdminModules['tax-fill-survey'];
    expect(mod.satisfactionLabel('good')).toBe('满意');
    expect(mod.improveLabel('paste')).toBe('粘贴导入');
    expect(mod.formatTopics({ improve_topics: ['paste', 'calc'] })).toBe('粘贴导入、计算说明');
    mod.renderStats({
      period: { label: '最近 7 天' },
      note: '填写页问卷',
      survey: {
        submitted: 2,
        skipped: 0,
        total: 2,
        with_suggestion: 1,
        with_improve: 1,
        unhappy: 1,
        unhappy_with_improve: 1,
        good_pct: 50,
        bad_pct: 50,
        satisfaction: { good: 1, ok: 0, bad: 1 },
        improve: { paste: 1, calc: 1 },
        improve_unhappy: { paste: 1, calc: 1 },
        recent: [
          {
            created_at: '2026-08-28T01:00:00.000Z',
            username: 'u1',
            real_name: '张三',
            satisfaction: 'bad',
            improve_topic: 'paste,calc',
            improve_topics: ['paste', 'calc'],
            suggestion: '粘贴导入经常失败',
            skipped: false
          }
        ]
      }
    });
    const html = document.getElementById('taxFillSurveyMount').innerHTML;
    expect(html).toContain('粘贴导入经常失败');
    expect(html).toContain('u1');
    expect(html).toContain('不满意');
    expect(html).toContain('一般/不满意');
    expect(html).toContain('粘贴导入、计算说明');
  });
});
