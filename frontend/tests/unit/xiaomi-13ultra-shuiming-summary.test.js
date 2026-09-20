import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('小米 13 Ultra 收入纳税明细汇总加高', () => {
  it('识别 2304FPN6 / Xiaomi 13 Ultra，且不并入 13', () => {
    expect(auth).toContain('function isXiaomi13UltraClient()');
    expect(auth).toMatch(/2304FPN6/);
    expect(auth).toMatch(/\(\?:Xiaomi\|Mi\|小米\)\[\\s_-\]\*13\[\\s_-\]\*Ultra/);
    expect(auth).toMatch(
      /isXiaomi13ProClient\(\) \|\| isXiaomi13UltraClient\(\)/
    );
    expect(auth).toMatch(
      /\(\?:Xiaomi\|Mi\|小米\)\[\\s_-\]\*13\\b\(\?!\[\\s_-\]\*\(\?:Pro\|Ultra\|Lite\)\)/
    );
    expect(shuimingResult).toMatch(/2304FPN6\|\(\?:Xiaomi\|Mi\|小米\)\[\\s_-\]\*13\[\\s_-\]\*Ultra/);
    expect(shuimingResult).toContain("classList.add('app-android-xiaomi-13ultra')");
  });

  it('汇总两行白底行高高于安卓默认，列表顶距随实测下推', () => {
    expect(shuimingResult).toContain('html.app-android-xiaomi-13ultra body.page-shuiming-result .page-root');
    expect(shuimingResult).toMatch(
      /html\.app-android-xiaomi-13ultra body\.page-shuiming-result \.page-root \{\s*--list-summary-pad:\s*92px;/
    );
    expect(shuimingResult).toMatch(
      /html\.app-android-xiaomi-13ultra[\s\S]{0,160}\.top-fixed \.summary[\s\S]{0,80}padding:\s*12px 0 10px\s*!important/
    );
    expect(shuimingResult).toMatch(
      /html\.app-android-xiaomi-13ultra body\.page-shuiming-result \.summary > \.summary-item \{\s*padding-top:\s*8px\s*!important;\s*padding-bottom:\s*10px\s*!important;/
    );
    expect(shuimingResult).toMatch(
      /html\.app-android-xiaomi-13ultra body\.page-shuiming-result \.summary > \.summary-item:last-of-type \{\s*padding-bottom:\s*8px\s*!important;/
    );
    expect(shuimingResult).toContain(
      'html.app-android-xiaomi-13ultra body.page-shuiming-result .list-title'
    );
    expect(shuimingResult).toContain(
      'html.app-android-xiaomi-13ultra body.page-shuiming-result .list-date'
    );
    expect(shuimingResult).toMatch(
      /html\.app-android-xiaomi-13ultra body\.page-shuiming-result \.list-title[\s\S]{0,120}font-size:\s*17px\s*!important/
    );
  });

  it('沉浸白顶栏打上 13ultra class，不走 mi-family 外置黑条', () => {
    expect(auth).toContain("classList.add('app-android-xiaomi-13ultra')");
    expect(auth).toContain('html.app-android-xiaomi-13ultra.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}');
    expect(auth).toContain('html.app-android-xiaomi-13ultra.app-top-safe-shell::before{content:"" !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:var(--app-shell-statusbar-top,40px) !important;background:#000 !important;z-index:2147483000 !important;pointer-events:none !important;}');
    expect(auth).toContain('html.app-android-xiaomi-13ultra.app-android-client.app-top-safe-shell body.page-shouye::before{background-color:#000 !important;background-image:none !important;}');
    expect(auth).toContain('!xiaomi13UltraClient &&');
    expect(auth).toContain('isXiaomi13UltraClient() ||');
  });
});
