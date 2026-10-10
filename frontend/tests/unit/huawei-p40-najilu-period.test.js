import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE =
  /HUAWEIANA|ANA-AN00|ANA-TN00|ANA-NX9|ANA-LX4|ANA-L29|ANA-N29|ANA-AN\d{2}|ANA-TN\d{2}|ANA-AL\d{2}|ANA-LX\d{2}|ANA-N\d{2}/i;
const NAME_RE = /(?:Huawei|HUAWEI|华为)?[\s_-]*P40(?![\s_-]*Pro)/i;
const PRO_EXCLUDE_RE = /P40[\s_-]*Pro|\bELS-/i;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const najiluHtml = readFileSync(resolve(__dirname, '../../najilu.html'), 'utf8');
const najiluJs = readFileSync(resolve(__dirname, '../../public/js/najilu.js'), 'utf8');

describe('Huawei P40 najilu tax-period horizontal', () => {
  it('matches ANA model codes and P40 marketing name', () => {
    ['ANA-AN00', 'ANA-TN00', 'ANA-NX9', 'ANA-LX4', 'HUAWEIANA'].forEach((id) => {
      expect(MODEL_RE.test(id), id).toBe(true);
    });
    ['P40', 'HUAWEI P40', '华为P40', 'Huawei_P40'].forEach((name) => {
      expect(NAME_RE.test(name), name).toBe(true);
    });
  });

  it('does not treat P40 Pro / ELS as P40', () => {
    expect(NAME_RE.test('P40 Pro')).toBe(false);
    expect(NAME_RE.test('HUAWEI P40 Pro')).toBe(false);
    expect(PRO_EXCLUDE_RE.test('ELS-AN00')).toBe(true);
    expect(PRO_EXCLUDE_RE.test('P40 Pro')).toBe(true);
    expect(MODEL_RE.test('ELS-AN00')).toBe(false);
  });

  it('auth exposes isHuaweiP40Client and app-android-huawei-p40', () => {
    expect(auth).toContain('function isHuaweiP40Client()');
    expect(auth).toContain('ANA-AN00');
    expect(auth).toContain("classList.add('app-android-huawei-p40')");
    expect(auth).toContain('var huaweiP40Client = isHuaweiP40Client()');
  });

  it('auth-boot first-paints app-android-huawei-p40', () => {
    expect(boot).toContain('app-android-huawei-p40');
    expect(boot).toContain('ANA-AN00');
  });

  it('najilu keeps period on one line and tags period value', () => {
    expect(najiluHtml).toMatch(/\.application-line\s*\{[\s\S]*flex-wrap:\s*nowrap/);
    expect(najiluHtml).toMatch(/\.application-value\s*\{[\s\S]*white-space:\s*nowrap/);
    expect(najiluHtml).toContain('html.app-android-huawei-p40 body.page-najilu');
    expect(najiluHtml).toContain('html.app-android-huawei-p40pro body.page-najilu');
    expect(najiluJs).toContain('application-value application-period');
    expect(najiluJs).toContain('纳税记录申请记录');
    expect(najiluJs).toContain('温馨提示');
  });

  it('shrinks period/time fonts and pads header above status bar', () => {
    expect(najiluHtml).toMatch(/html\.app-android-huawei-p40 body\.page-najilu \.application-time[\s\S]*?font-size:\s*13px/);
    expect(najiluHtml).toMatch(/html\.app-android-huawei-p40 body\.page-najilu \.application-value\.application-period[\s\S]*?font-size:\s*11px/);
    expect(najiluHtml).toMatch(/html\.app-android-huawei-p40 body\.page-najilu \.application-status[\s\S]*?margin-left:\s*8px/);
    expect(najiluHtml).toMatch(/html\.app-android-huawei-p40 body\.page-najilu \.header[\s\S]*?padding-top:\s*max\(40px/);
    expect(auth).toContain("classList.add('app-android-immersive-white-top')");
    expect(auth).toContain('!huaweiP40Client');
    expect(boot).toContain("classList.add('app-android-immersive-white-top')");
    expect(boot).toContain('function applyHuaweiP40InsetFirstPaint');
    expect(boot).toContain('applyHuaweiP40InsetFirstPaint()');
    expect(najiluHtml).toMatch(/color:\s*#1677ff/);
    expect(najiluHtml).toMatch(/application-period[\s\S]*?overflow:\s*visible/);
    expect(najiluHtml).toMatch(/application-period[\s\S]*?font-size:\s*11px/);
  });
});
