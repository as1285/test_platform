import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import {
  validateFeature,
  getExplain,
  validateIndex
} from '../../public/js/surveys/validate.js';

const surveysDir = resolve(__dirname, '../../public/js/surveys');

function loadJson(name) {
  return JSON.parse(readFileSync(resolve(surveysDir, name), 'utf8'));
}

const index = loadJson('index.json');
const featureDocs = index.features.map(function (f) {
  return { meta: f, doc: loadJson(f.file) };
});

describe('survey catalog', () => {
  it('index lists every feature json except validate and itself', () => {
    const jsonFiles = readdirSync(surveysDir)
      .filter(function (n) {
        return n.endsWith('.json') && n !== 'index.json';
      })
      .sort();
    const listed = index.features.map(function (f) {
      return f.file;
    }).sort();
    expect(listed).toEqual(jsonFiles);
  });

  it('index and all feature files pass schema checks', () => {
    const byId = {};
    featureDocs.forEach(function (item) {
      byId[item.doc.id] = item.doc;
      expect(item.doc.id).toBe(item.meta.id);
      expect(validateFeature(item.doc)).toEqual([]);
    });
    expect(validateIndex(index, byId)).toEqual([]);
  });

  it('each concern explain is user-facing and honest', () => {
    featureDocs.forEach(function (item) {
      item.doc.concerns.forEach(function (c) {
        expect(c.explain.trim().length).toBeGreaterThanOrEqual(20);
        expect(c.explain).not.toMatch(/等同于税务局|等同于银行流水|官方出具/);
        expect(getExplain(item.doc, c.id)).toBe(c.explain.trim());
      });
    });
  });

  it('getExplain returns empty for unknown concern', () => {
    expect(getExplain(featureDocs[0].doc, 'not_a_real_concern')).toBe('');
    expect(getExplain(null, 'x')).toBe('');
  });

  it('rejects incomplete or dishonest feature docs', () => {
    const bad = {
      id: 'x',
      title: 'X',
      page: 'x.html',
      phase: 1,
      trigger: { type: 'exit' },
      price: { enabled: false },
      usage: {
        satisfaction: [{ id: 'good', label: '好' }],
        improve: [{ id: 'other', label: '其他' }]
      },
      concerns: [
        { id: 'a', label: '怕官方', explain: '这等同于税务局完税证明，可直接对外使用。' },
        { id: 'b', label: '短', explain: '太短' }
      ]
    };
    const errors = validateFeature(bad);
    expect(errors.some(function (e) {
      return e.indexOf('once_per_user') >= 0;
    })).toBe(true);
    expect(errors.some(function (e) {
      return e.indexOf('不得把演示说成官方') >= 0;
    })).toBe(true);
    expect(errors.some(function (e) {
      return e.indexOf('不少于') >= 0;
    })).toBe(true);
  });

  it('phase 1 features already have live or planned admin hooks', () => {
    const phase1 = featureDocs.filter(function (item) {
      return item.doc.phase === 1;
    });
    expect(phase1.map(function (item) {
      return item.doc.id;
    })).toEqual(['purchase', 'tax_fill', 'lizhi_cert', 'zaizhi_cert']);
    phase1.forEach(function (item) {
      expect(item.doc.admin).toBeTruthy();
      expect(item.doc.concerns.length).toBeGreaterThanOrEqual(4);
    });
  });
});
