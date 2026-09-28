import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('红米 K70 标准版收入纳税明细汇总加高', () => {
  it('识别 23113RKC6C / Redmi K70，且不并入至尊', () => {
    expect(auth).toContain('function isRedmiK70Client()');
    expect(auth).toContain('function isRedmiK70StandardClient()');
    expect(auth).toMatch(/23113RKC6\[CG\]/);
    expect(auth).toMatch(
      /\(\?:Redmi\|Xiaomi\|REDMI\)\[\\s_-\]\*K70\(\?!\[\\s_-\]\*\(\?:至尊\|Ultra\|Pro\)\)/
    );
    expect(shuimingResult).toMatch(/23113RKC6\[CG\]\|2311DRK48\[CGI\]/);
    expect(shuimingResult).toContain("classList.add('app-android-redmi-k70')");
    expect(shuimingResult).toContain("classList.add('app-android-redmi-k70-ultra')");
  });

  it('汇总两行白底行高高于安卓默认，且不含至尊', () => {
    expect(shuimingResult).toContain(
      'html.app-android-redmi-k70:not(.app-android-redmi-k70-ultra) body.page-shuiming-result .page-root'
    );
    expect(shuimingResult).toMatch(
      /html\.app-android-redmi-k70:not\(\.app-android-redmi-k70-ultra\) body\.page-shuiming-result \.page-root \{\s*--list-summary-pad:\s*92px;/
    );
    expect(shuimingResult).toMatch(
      /html\.app-android-redmi-k70:not\(\.app-android-redmi-k70-ultra\)[\s\S]{0,180}\.top-fixed \.summary[\s\S]{0,80}padding:\s*12px 0 10px\s*!important/
    );
    expect(shuimingResult).toMatch(
      /html\.app-android-redmi-k70:not\(\.app-android-redmi-k70-ultra\) body\.page-shuiming-result \.summary > \.summary-item \{\s*padding-top:\s*8px\s*!important;\s*padding-bottom:\s*10px\s*!important;/
    );
    expect(shuimingResult).toMatch(
      /html\.app-android-redmi-k70:not\(\.app-android-redmi-k70-ultra\) body\.page-shuiming-result \.summary > \.summary-item:last-of-type \{\s*padding-bottom:\s*8px\s*!important;/
    );
  });

  it('首屏打上 K70 标准版 class，且不走沉浸白顶', () => {
    expect(shuimingResult).toContain("classList.add('app-android-redmi-k70')");
    expect(shuimingResult).toMatch(
      /classList\.add\('app-android-redmi-k70'\);\s*document\.documentElement\.classList\.remove\('app-android-immersive-white-top'\)/
    );
    expect(auth).toContain("classList.add('app-android-redmi-k70')");
  });
});
