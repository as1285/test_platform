import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const daiban = readFileSync(resolve(__dirname, '../../daiban.html'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const navCss = readFileSync(resolve(__dirname, '../../css/nav.css'), 'utf8');

describe('iPhone 16 Pro 待办底栏与其它 TAB 同高', () => {
  it('待办首绘打 16 Pro 标，并用 100vh 锁住大视口', () => {
    expect(daiban).toContain('app-ios-iphone16pro');
    expect(daiban).toContain('iPhone17,1');
    expect(daiban).toContain('data-iphone16pro-daiban-nav');
    expect(daiban).toContain('db16proNavLock');
    expect(daiban).toMatch(/html\.app-ios-iphone16pro \.daiban-page[\s\S]*min-height:\s*100vh\s*!important/);
    expect(daiban).toContain('auth.js?v=20260915-ios-16pro-db');
    expect(daiban).toContain('nav.css?v=20260915-ios-16pro-db');
  });

  it('chrome 注入不再给 16 Pro 待办套 100dvh', () => {
    expect(auth).toContain('html:not(.app-ios-iphone14promax):not(.app-ios-iphone16pro) body.page-daiban');
    expect(auth).toContain(
      'html.app-ios-iphone16pro body.page-daiban,html.app-ios-iphone16pro body.page-bancha,html.app-ios-iphone16pro .daiban-page'
    );
    expect(auth).toContain(
      'html.app-ios-iphone16pro body.page-daiban > .bottom-nav,html.app-ios-iphone16pro body.page-daiban > .bottom-nav.ios-device'
    );
    expect(navCss).toContain('html.app-ios-iphone16pro .daiban-page');
    expect(navCss).toMatch(
      /html\.app-ios-iphone16pro \.daiban-page[\s\S]*min-height:\s*100vh\s*!important/
    );
  });
});
