import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const daiban = readFileSync(resolve(__dirname, '../../daiban.html'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const navCss = readFileSync(resolve(__dirname, '../../css/nav.css'), 'utf8');

describe('iPhone 16 Pro 待办底栏与其它 TAB 同高', () => {
  it('壳层与 auth/boot 识别 16 Pro，待办底栏规则在 auth/nav', () => {
    expect(auth).toContain('app-ios-iphone16pro');
    expect(boot).toContain('app-ios-iphone16pro');
    expect(navCss).toContain('html.app-ios-iphone16pro .daiban-page');
    expect(daiban).toMatch(/auth\.js\?v=2026[\w-]+/);
    expect(daiban).toMatch(/nav\.css\?v=2026[\w-]+/);
  });

  it('chrome 注入给 16 Pro 待办/办查等页锁底栏，并用 100vh 规则', () => {
    expect(auth).toContain(
      'html.app-ios-iphone16pro body.page-daiban > .bottom-nav'
    );
    expect(auth).toContain(
      'html.app-ios-iphone16pro body.page-bancha > .bottom-nav'
    );
    expect(navCss).toMatch(
      /html\.app-ios-iphone16pro \.daiban-page[\s\S]*min-height:\s*100vh\s*!important/
    );
  });
});
