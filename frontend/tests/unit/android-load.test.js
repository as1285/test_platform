import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const frontend = resolve(__dirname, '../..');
const auth = readFileSync(join(frontend, 'public/js/auth.js'), 'utf8');
const boot = readFileSync(join(frontend, 'public/js/auth-boot.js'), 'utf8');
const fastNav = readFileSync(join(frontend, 'public/js/fast-nav.js'), 'utf8');
const theme = readFileSync(join(frontend, 'public/js/theme-loader.js'), 'utf8');
const assemble = readFileSync(join(frontend, 'scripts/assemble-site.mjs'), 'utf8');

function htmlPages() {
  return readdirSync(frontend).filter((name) => name.endsWith('.html') && name !== 'mine_mate60_aug12.html');
}

describe('android first-paint load', () => {
  it('defers OEM chrome and conversion-guide on primary tabs', () => {
    expect(auth).toContain('function markViewportChromeClasses()');
    expect(auth).toContain('function scheduleDeferredMobileChrome()');
    expect(auth).toContain('setupMobileStatusBar()');
    expect(auth).toContain('applyShouyePageChrome()');
    expect(auth).toMatch(/requestIdleCallback\(function \(\) \{\s*afterPaint\(run\);/);
    expect(auth).toContain("androidLike && primaryTabs[currentPageName()]");
    expect(auth).toContain("'mine.html': true");
    expect(auth).toContain("'daiban.html': true");
    expect(auth.indexOf('markViewportChromeClasses()')).toBeLessThan(auth.indexOf('setupMobileStatusBar();'));
  });

  it('skips android idle prefetch but keeps press prefetch', () => {
    expect(fastNav).toContain('function isAndroidLikeWebView()');
    expect(fastNav).toContain('if (isAndroidLikeWebView())');
    expect(fastNav).toContain("addEventListener('pointerdown'");
    expect(fastNav).toContain("addEventListener('touchstart'");
    expect(fastNav).toContain('warmCriticalAssets()');
    expect(theme).toContain('function isAndroidLikeWebView()');
    expect(theme).toMatch(/function prefetchBottomNavPages\(\) \{\s*\/\* 安卓 \/ 鸿蒙/);
  });

  it('auth-boot stays small and exposes sync APIs', () => {
    expect(boot.length).toBeLessThan(16 * 1024);
    expect(boot).toContain('function getToken()');
    expect(boot).toContain('function isPublicPage()');
    expect(boot).toContain('window.authFetch');
    expect(boot).toContain('window.buildLoginPageUrl');
    expect(boot).toContain('markViewportChromeClasses()');
    expect(boot).not.toContain('setupMobileStatusBar');
    expect(boot).not.toContain('conversion-guide.js');
    expect(assemble).toContain('auth-boot.js');
    expect(assemble).not.toMatch(/OBFUSCATE_REL[\s\S]*auth-boot\.js/);
    const core = readFileSync(join(frontend, 'public/js/app/core.js'), 'utf8');
    expect(core).toContain('fn.apply(this, arguments)');
  });

  it('C-end pages load boot sync and auth.js defer', () => {
    const pages = htmlPages().filter((name) => {
      const html = readFileSync(join(frontend, name), 'utf8');
      return html.includes('/js/auth.js');
    });
    expect(pages.length).toBeGreaterThan(40);
    pages.forEach((name) => {
      const html = readFileSync(join(frontend, name), 'utf8');
      expect(html, name).toContain('auth-boot.js?v=20260828-android-load');
      expect(html, name).toMatch(/auth\.js\?v=20260828-android-load" defer/);
      const bootAt = html.indexOf('auth-boot.js');
      const authAt = html.indexOf('auth.js?v=20260828-android-load');
      expect(bootAt, name).toBeGreaterThan(-1);
      expect(authAt, name).toBeGreaterThan(bootAt);
    });
  });

  it('keeps first-screen image paths and pixel size after compression', () => {
    const ahead = statSync(join(frontend, 'public/img/home/ahead.png'));
    const header = statSync(join(frontend, 'public/img/home/apk-home-header-bg.png'));
    const e1 = statSync(join(frontend, 'public/img/mine/e1_01@sm.png'));
    expect(ahead.size).toBeLessThan(60000);
    expect(header.size).toBeLessThan(160000);
    expect(e1.size).toBeLessThan(160000);
    const shouye = readFileSync(join(frontend, 'shouye.html'), 'utf8');
    expect(shouye).toContain('/img/home/ahead.png');
    expect(shouye).toContain('width="1284" height="167"');
    expect(shouye).toContain("fetchpriority=\"high\"");
    expect(readFileSync(join(frontend, 'mine.html'), 'utf8')).toContain('/img/mine/e1_01@sm.png');
  });
});

describe('auth-boot sync APIs', () => {
  beforeAll(() => {
    window.localStorage.clear();
    eval(boot);
  });

  it('exposes token helpers before auth.js', () => {
    expect(typeof window.authGetToken).toBe('function');
    expect(typeof window.authFetch).toBe('function');
    expect(typeof window.isPublicPage).toBe('function');
    expect(typeof window.buildLoginPageUrl).toBe('function');
    expect(window.sanitizeLoginNext('mine.html')).toBe('mine.html');
    expect(window.sanitizeLoginNext('purchase.html')).toBe('');
  });
});
