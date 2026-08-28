import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const moduleCode = readFileSync(
  resolve(__dirname, '../../public/js/cert-page-survey.js'),
  'utf8'
);

function loadSurvey() {
  delete window.initCertPageSurvey;
  delete window.CertPageSurvey;
  // eslint-disable-next-line no-eval
  eval(moduleCode);
}

describe('cert-page-survey', () => {
  beforeEach(() => {
    document.body.innerHTML = '<a id="lizhiBack" href="consult.html?tab=products">返回</a>';
    localStorage.clear();
    sessionStorage.clear();
    loadSurvey();
  });

  it('normalizes product and builds submit body', () => {
    const api = window.CertPageSurvey;
    expect(api.normalizeProduct('lizhi')).toBe('lizhi');
    expect(api.productLabel('zaizhi')).toBe('在职证明');
    const body = api.buildSubmitBody({
      product: 'lizhi',
      sentiment: 'expensive',
      experience: 'bad',
      improve_topic: 'share',
      expected_price: 19,
      seen_price: 50,
      unlocked: false
    });
    expect(body.product).toBe('lizhi');
    expect(body.sentiment).toBe('expensive');
    expect(body.experience).toBe('bad');
    expect(body.improve_topic).toBe('share');
    expect(body.expected_price).toBe(19);
    expect(body.skipped).toBe(false);
  });

  it('opens on back click and submits price + experience', async () => {
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
    let leftTo = '';
    window.initCertPageSurvey({
      product: 'lizhi',
      authFetch: fetchMock,
      getSeenPrice: function () {
        return 50;
      },
      getUnlocked: function () {
        return false;
      },
      onLeave: function (href) {
        leftTo = href;
      }
    });

    const backEv = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('lizhiBack').dispatchEvent(backEv);
    expect(backEv.defaultPrevented).toBe(true);
    const root = document.getElementById('certPageSurveyModal');
    expect(root.classList.contains('is-open')).toBe(true);
    expect(document.getElementById('certSurveySub').textContent).toMatch(/离职证明/);

    document.querySelector('[data-sentiment="expensive"]').click();
    document.querySelector('[data-experience="ok"]').click();
    expect(document.getElementById('certSurveyMore').hidden).toBe(false);

    document.querySelector('[data-improve="share"]').click();
    await vi.waitFor(function () {
      expect(leftTo).toBe('consult.html?tab=products');
    });
    const postCall = fetchMock.mock.calls.find(function (c) {
      return c[0] === '/api/growth/cert-page-survey' && c[1] && c[1].method === 'POST';
    });
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall[1].body);
    expect(body.product).toBe('lizhi');
    expect(body.sentiment).toBe('expensive');
    expect(body.experience).toBe('ok');
    expect(body.improve_topic).toBe('share');
    expect(localStorage.getItem('cert_page_survey_done_lizhi_v1')).toBe('1');
  });

  it('cert pages include the shared survey script', () => {
    const lizhi = readFileSync(resolve(__dirname, '../../lizhi_cert.html'), 'utf8');
    const zaizhi = readFileSync(resolve(__dirname, '../../zaizhi_cert.html'), 'utf8');
    expect(lizhi).toContain('cert-page-survey.js');
    expect(lizhi).toContain("product: 'lizhi'");
    expect(zaizhi).toContain('cert-page-survey.js');
    expect(zaizhi).toContain("product: 'zaizhi'");
  });

  it('does not intercept back after local done', () => {
    localStorage.setItem('token', 't-test');
    localStorage.setItem('cert_page_survey_done_zaizhi_v1', '1');
    document.getElementById('lizhiBack').setAttribute('href', '#done');
    window.initCertPageSurvey({
      product: 'zaizhi',
      authFetch: function () {
        return Promise.resolve({
          json: function () {
            return Promise.resolve({ code: 200, data: { done: true } });
          }
        });
      }
    });
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('lizhiBack').dispatchEvent(ev);
    const root = document.getElementById('certPageSurveyModal');
    expect(!root || !root.classList.contains('is-open')).toBe(true);
  });
});
