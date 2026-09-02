import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const LIO_RE =
  /LIO-AN00|LIO-AL00|LIO-TL00|LIO-L29|LIO-N29|LIO-AN00m|LIO-AN00P|\bLIO-|Mate\s*30E?\s*Pro|Mate\s*30\s*E\s*Pro/i;
const FIRST_PAINT_RE = /LIO-|Mate\s*30E?\s*Pro|Mate\s*30\s*E\s*Pro/i;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8')
};

describe('Huawei Mate 30E Pro / LIO-AN00m status-bar inset', () => {
  it('matches LIO-AN00m and Mate 30E Pro marketing names', () => {
    ['LIO-AN00m', 'LIO-AN00', 'LIO-AL00', 'Mate 30E Pro', 'HUAWEI Mate 30E Pro 5G', 'Mate 30 Pro'].forEach(
      (id) => {
        expect(LIO_RE.test(id), id).toBe(true);
      }
    );
  });

  it('does not treat TAS Mate 30 as Pro', () => {
    expect(LIO_RE.test('TAS-AN00')).toBe(false);
    expect(LIO_RE.test('Mate 30')).toBe(false);
    expect(LIO_RE.test('HUAWEI Mate 30 5G')).toBe(false);
  });

  it('uses clientUaBlob and keeps Lio on immersive 40px, not outer-zero', () => {
    const lioFn = auth.slice(
      auth.indexOf('function isHuaweiLioAn00Client()'),
      auth.indexOf('function isHuaweiMate70Client()')
    );
    expect(lioFn).toContain('clientUaBlob()');
    expect(lioFn).toMatch(/Mate\\s\*30E\?\\s\*Pro/);
    expect(auth).not.toMatch(
      /if \(isHuaweiLioAn00Client\(\) \|\| isHuaweiClsAl00Client\(\)\) \{\s*return false;/
    );
    expect(auth).toContain('app-android-huawei-mate30pro');
    expect(auth).toContain(
      'html.app-android-huawei-mate30pro.app-android-immersive-white-top.app-top-safe-shell'
    );
    expect(auth).toContain(':not(.app-android-huawei-lio-an00)');
  });

  it('first-paints tax pages so 收入纳税明细 is not under the notch', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(FIRST_PAINT_RE.test(html), name).toBe(true);
      expect(html, name).toContain('app-android-huawei-mate30pro');
      expect(html, name).toContain('app-android-immersive-white-top');
    });
    expect(pages.shuimingResult).toContain('data-mate30pro-result-firstpaint');
    expect(pages.shuimingResult).toContain(
      'html.app-android-huawei-mate30pro body.page-shuiming-result .page-root'
    );
    expect(pages.shuimingResult).not.toMatch(
      /html\.app-android-huawei-mate30,html\.app-android-huawei-mate30pro body/
    );
  });
});
