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
    '<button type="button" data-satisfaction="bad">不满意</button>' +
    '</div>' +
    '<div id="taxFillSurveyCardImproveBlock">' +
    '<label id="taxFillSurveyCardImproveLabel">哪里不满意 <span id="taxFillSurveyCardImproveReq">必选</span></label>' +
    '<div id="taxFillSurveyCardImproveChips">' +
    '<button type="button" data-improve="paste">粘贴导入</button>' +
    '<button type="button" data-improve="calc">计算说明</button>' +
    '</div></div>' +
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
    expect(api.normalizeImproveTopics(['paste', 'calc', 'paste'])).toEqual(['paste', 'calc']);
    expect(api.normalizeSuggestion('  建议  ')).toBe('建议');
    expect(api.needsImproveTopics('bad')).toBe(true);
    expect(api.needsImproveTopics('good')).toBe(false);
    const body = api.buildSubmitBody({
      satisfaction: 'ok',
      improve_topics: ['paste', 'list'],
      suggestion: '导入失败'
    });
    expect(body.satisfaction).toBe('ok');
    expect(body.improve_topic).toBe('paste,list');
    expect(body.improve_topics).toEqual(['paste', 'list']);
    expect(body.suggestion).toBe('导入失败');
    expect(body.skipped).toBe(false);
  });

  it('rejects ok/bad without improve topics on client', () => {
    const api = window.TaxFillSurvey;
    expect(api.buildSubmitBody({ satisfaction: 'bad' }).error).toMatch(/不满意/);
  });

  it('consult page includes survey card and script', () => {
    const html = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
    expect(html).toContain('tax-fill-survey.js');
    expect(html).toContain('taxFillSurveyCard');
    expect(html).toContain('consultBackLink');
    expect(html).toContain('补充说明');
    expect(html).toContain('可多选');
  });

  it('card submit requires improve topic for ok/bad', async () => {
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

    document.querySelector('[data-satisfaction="bad"]').click();
    document.getElementById('taxFillSurveyCardSubmit').click();
    expect(document.getElementById('taxFillSurveyCardErr').textContent).toMatch(/不满意/);
    expect(
      fetchMock.mock.calls.some(function (c) {
        return c[0] === '/api/growth/tax-fill-survey' && c[1] && c[1].method === 'POST';
      })
    ).toBe(false);

    document.querySelector('[data-improve="paste"]').click();
    document.querySelector('[data-improve="calc"]').click();
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
    expect(body.satisfaction).toBe('bad');
    expect(body.improve_topics).toEqual(['paste', 'calc']);
    expect(body.improve_topic).toBe('paste,calc');
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
