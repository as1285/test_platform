import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const moduleCode = readFileSync(
  resolve(__dirname, '../../public/js/tax-fill-survey.js'),
  'utf8'
);

function loadSurvey() {
  delete window.initTaxFillSurvey;
  delete window.TaxFillSurvey;
  // eslint-disable-next-line no-eval
  eval(moduleCode);
}

function surveyCardHtml() {
  return (
    '<div id="panel-records" class="tab-panel active"></div>' +
    '<a id="consultBackLink" href="mine.html">返回</a>' +
    '<div id="taxFillSurveyCard">' +
    '<div id="taxFillSurveyCardForm">' +
    '<div id="taxFillSurveyCardSatOpts">' +
    '<button type="button" data-satisfaction="good">满意</button>' +
    '<button type="button" data-satisfaction="ok">一般</button>' +
    '</div>' +
    '<div id="taxFillSurveyCardImproveChips">' +
    '<button type="button" data-improve="paste">粘贴导入</button>' +
    '</div>' +
    '<textarea id="taxFillSurveyCardSuggestion"></textarea>' +
    '<p id="taxFillSurveyCardCount">0 / 500</p>' +
    '<p id="taxFillSurveyCardErr"></p>' +
    '<button type="button" id="taxFillSurveyCardSubmit">提交建议</button>' +
    '</div>' +
    '<p id="taxFillSurveyCardThanks" hidden>已收到</p>' +
    '</div>'
  );
}

describe('tax-fill-survey', () => {
  beforeEach(() => {
    document.body.innerHTML = '<a id="consultBackLink" href="mine.html">返回</a>';
    localStorage.clear();
    sessionStorage.clear();
    loadSurvey();
  });

  it('normalizes fields and builds submit body', () => {
    const api = window.TaxFillSurvey;
    expect(api.normalizeSatisfaction('bad')).toBe('bad');
    expect(api.normalizeImproveTopic('GENERATE')).toBe('generate');
    expect(api.normalizeSuggestion('  建议  ')).toBe('建议');
    const body = api.buildSubmitBody({
      satisfaction: 'good',
      improve_topic: 'paste',
      suggestion: '导入失败'
    });
    expect(body.satisfaction).toBe('good');
    expect(body.improve_topic).toBe('paste');
    expect(body.suggestion).toBe('导入失败');
    expect(body.skipped).toBe(false);
  });

  it('consult page includes survey card and script', () => {
    const html = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
    expect(html).toContain('tax-fill-survey.js');
    expect(html).toContain('taxFillSurveyCard');
    expect(html).toContain('consultBackLink');
    expect(html).toContain('优化建议');
  });

  it('card submit posts satisfaction and suggestion', async () => {
    document.body.innerHTML = surveyCardHtml();
    localStorage.setItem('token', 't-test');
    const fetchMock = vi.fn(function (url) {
      return Promise.resolve({
        json: function () {
          if (String(url).indexOf('/status') >= 0) {
            return Promise.resolve({ code: 200, data: { done: false } });
          }
          return Promise.resolve({ code: 200, data: { done: true } });
        }
      });
    });
    window.authFetch = fetchMock;
    window.initTaxFillSurvey({});

    document.querySelector('[data-satisfaction="ok"]').click();
    document.querySelector('[data-improve="paste"]').click();
    document.getElementById('taxFillSurveyCardSuggestion').value = '想按月改工资';
    document.getElementById('taxFillSurveyCardSubmit').click();

    await vi.waitFor(function () {
      expect(document.getElementById('taxFillSurveyCardThanks').hidden).toBe(false);
    });
    const postCall = fetchMock.mock.calls.find(function (c) {
      return c[0] === '/api/growth/tax-fill-survey' && c[1] && c[1].method === 'POST';
    });
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall[1].body);
    expect(body.satisfaction).toBe('ok');
    expect(body.improve_topic).toBe('paste');
    expect(body.suggestion).toBe('想按月改工资');
    expect(localStorage.getItem('tax_fill_survey_done_v1')).toBe('1');
  });

  it('intercepts back on records tab until submitted', () => {
    document.body.innerHTML =
      '<div id="panel-records" class="tab-panel active"></div>' +
      '<a id="consultBackLink" href="mine.html">返回</a>';
    localStorage.setItem('token', 't-test');
    window.authFetch = function () {
      return Promise.resolve({
        json: function () {
          return Promise.resolve({ code: 200, data: { done: false } });
        }
      });
    };
    let leftTo = '';
    window.initTaxFillSurvey({
      onLeave: function (href) {
        leftTo = href;
      }
    });
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('consultBackLink').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.getElementById('taxFillSurveyModal').classList.contains('is-open')).toBe(
      true
    );
    expect(leftTo).toBe('');
  });
});
