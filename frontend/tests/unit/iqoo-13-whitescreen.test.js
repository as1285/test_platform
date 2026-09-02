import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');
const result = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iQOO 13 selectors must stay page-scoped', () => {
  it('does not paint every page body as the tax-result white header', () => {
    expect(auth).not.toMatch(/html\.app-android-iqoo-13 body,/);
    expect(auth).not.toMatch(/html\.app-android-iqoo-13\.app-top-safe-shell,html\.app-android-iqoo-15\.app-top-safe-shell body\.page-shuiming-result/);
    expect(auth).toContain(
      'html.app-android-iqoo-13 body.page-shuiming-result .page-root,html.app-android-iqoo-15 body.page-shuiming-result .page-root'
    );
    expect(auth).toContain(
      'html.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .header'
    );
  });

  it('keeps shuiming_result.html iQOO 13 rules on the result page only', () => {
    expect(result).not.toMatch(/html\.app-android-iqoo-13,html\.app-android-iqoo-15 body\.page-shuiming-result/);
    expect(result).toContain('html.app-android-iqoo-13 body.page-shuiming-result .page-root');
    expect(result).toContain('html.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .header');
  });

  it('does not force black chrome or hide home slices on iQOO', () => {
    expect(auth).not.toContain('function iqooBlackPageChromeCss');
    expect(auth).not.toContain('function pinIqooMineE1TailCrop');
    expect(boot).not.toContain('iqoo13MineFirstPaint');
    expect(shouye).not.toMatch(/app-android-iqoo-13 body\.page-shouye \.sy-apk-stack/);
    expect(mine).not.toContain('iqoo13MineFirstPaint');
    expect(mine).not.toContain('data-iqoo13-mine-firstpaint');
  });
});
