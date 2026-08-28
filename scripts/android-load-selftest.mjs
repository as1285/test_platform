/**
 * 安卓加载优化运行时自检（Playwright + Android UA）
 * 用法：node scripts/android-load-selftest.mjs
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'frontend/package.json'));
const { chromium } = require('playwright');

const BASE = process.env.SITE_URL || 'http://127.0.0.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log('[android-load-selftest] ok', label);
}
function fail(label, detail) {
  failed += 1;
  console.error('[android-load-selftest] FAIL', label, detail || '');
}

async function open(browser, ua) {
  return browser.newContext({
    userAgent: ua,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
}

function collectPrefetch(page, bag) {
  page.on('request', (req) => {
    const u = req.url();
    const type = req.resourceType();
    if (type === 'document') return;
    if (/\/(daiban|bancha|message|mine|shouye|consult)\.html/i.test(u)) {
      bag.push(u);
    }
  });
}

async function pageInfo(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const header = document.querySelector(
      '.search-bar-wrapper, .shouye-header, .mine-e1-canvas, .daiban-header, .bancha-header, .header'
    );
    return {
      href: location.href,
      title: document.title,
      classes: Array.from(document.documentElement.classList),
      authFetch: typeof window.authFetch,
      authGetToken: typeof window.authGetToken,
      mark: typeof window.markViewportChromeClasses,
      deferred: !!window.__authDeferredChromeScheduled,
      shouyeChrome: !!document.querySelector('style[data-shouye-chrome]'),
      shouyeBarRgb: getComputedStyle(document.documentElement).getPropertyValue('--shouye-top-bar-rgb'),
      shellStyle: !!document.querySelector('style[data-app-top-safe-shell], style[data-app-bottom-nav-lock]'),
      mineChrome: !!document.querySelector('style[data-mine-chrome]'),
      tabChrome: !!document.querySelector('style[data-daiban-bancha-chrome]'),
      conversionGuide: !!document.querySelector('script[data-conversion-guide]'),
      prefetchLinks: Array.from(document.querySelectorAll('link[rel="prefetch"]')).map(
        (el) => el.getAttribute('href') || ''
      ),
      hasNav: !!nav,
      navBox: nav ? nav.getBoundingClientRect() : null,
      headerBox: header ? header.getBoundingClientRect() : null
    };
  });
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const android = await open(browser, ANDROID_UA);
    const page = await android.newPage();
    const otherTabGets = [];
    collectPrefetch(page, otherTabGets);

    await page.goto(BASE + '/shouye.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(250);
    const earlySy = await pageInfo(page);
    await page.waitForFunction(
      () =>
        !!document.querySelector('style[data-app-bottom-nav-lock], style[data-app-top-safe-shell]') &&
        String(
          document.documentElement.style.getPropertyValue('--shouye-top-bar-rgb') ||
            getComputedStyle(document.documentElement).getPropertyValue('--shouye-top-bar-rgb')
        ).indexOf('79') >= 0,
      { timeout: 4000 }
    ).catch(() => {});
    const sy = await pageInfo(page);
    console.log('[android-load-selftest] shouye info', JSON.stringify({
      shellStyle: sy.shellStyle,
      rgb: sy.shouyeBarRgb,
      deferred: sy.deferred
    }));
    if (sy.classes.includes('app-android-client') && sy.classes.includes('app-top-safe-shell')) {
      ok('android shouye chrome classes');
    } else fail('android shouye chrome classes', sy.classes.join(' '));
    if (sy.authFetch === 'function' && sy.authGetToken === 'function') ok('android shouye boot APIs');
    else fail('android shouye boot APIs');
    if (
      (sy.shellStyle || sy.deferred) &&
      (String(sy.shouyeBarRgb).indexOf('79') >= 0 || sy.headerBox)
    ) {
      ok('android shouye OEM style injected');
    } else {
      fail(
        'android shouye OEM style injected',
        JSON.stringify({
          shellStyle: sy.shellStyle,
          rgb: sy.shouyeBarRgb,
          deferred: sy.deferred
        })
      );
    }
    if (sy.hasNav && sy.navBox && sy.navBox.height >= 48 && sy.navBox.bottom >= 820) {
      ok('android shouye bottom nav');
    } else fail('android shouye bottom nav', JSON.stringify(sy.navBox));
    if (sy.headerBox && sy.headerBox.top <= 2 && sy.headerBox.width >= 300) ok('android shouye header');
    else fail('android shouye header', JSON.stringify(sy.headerBox));
    if (!sy.prefetchLinks.length && !otherTabGets.length) ok('android shouye no idle prefetch');
    else fail('android shouye no idle prefetch', sy.prefetchLinks.concat(otherTabGets).join(','));
    if (!earlySy.conversionGuide) ok('android shouye conversion-guide not on first paint');
    else fail('android shouye conversion-guide not on first paint');

    otherTabGets.length = 0;
    await page.goto(BASE + '/mine.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(900);
    const mine = await pageInfo(page);
    if (mine.classes.includes('app-android-client') && mine.hasNav && mine.mineChrome) {
      ok('android mine chrome + nav');
    } else fail('android mine chrome + nav', JSON.stringify(mine));
    if (!mine.prefetchLinks.length && !otherTabGets.length) ok('android mine no idle prefetch');
    else fail('android mine no idle prefetch', mine.prefetchLinks.concat(otherTabGets).join(','));

    await page.goto(BASE + '/bancha.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(900);
    const bancha = await pageInfo(page);
    if (bancha.href.includes('bancha.html') && bancha.hasNav && bancha.tabChrome) {
      ok('android bancha chrome');
    } else fail('android bancha chrome', JSON.stringify(bancha));

    await page.goto(BASE + '/daiban.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(400);
    const daiban = await pageInfo(page);
    if (/login\.html/.test(daiban.href) && /next=daiban\.html/.test(daiban.href)) {
      ok('android daiban guest redirects via auth-boot');
    } else fail('android daiban guest redirects via auth-boot', daiban.href);

    await page.goto(BASE + '/message.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(300);
    const msg = await pageInfo(page);
    if (/login\.html/.test(msg.href)) ok('android message guest redirects');
    else fail('android message guest redirects', msg.href);

    await page.goto(BASE + '/consult.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(300);
    const consult = await pageInfo(page);
    if (/login\.html/.test(consult.href)) ok('android consult guest redirects');
    else fail('android consult guest redirects', consult.href);

    await page.goto(BASE + '/shouye.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      var mask = document.querySelector('.browser-install-prompt-root');
      if (mask && mask.parentNode) mask.parentNode.removeChild(mask);
    });
    const mineTab = page.locator('.bottom-nav a[href*="mine.html"]');
    await mineTab.click({ force: true, timeout: 8000 });
    await page.waitForTimeout(900);
    const afterMine = await pageInfo(page);
    if (/mine\.html/.test(afterMine.href) && afterMine.hasNav && afterMine.classes.includes('app-android-client')) {
      ok('android tab shouye -> mine');
    } else fail('android tab shouye -> mine', afterMine.href);

    await android.close();

    const ios = await open(browser, IOS_UA);
    const ipage = await ios.newPage();
    await ipage.goto(BASE + '/shouye.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await ipage.waitForTimeout(1400);
    const iosInfo = await pageInfo(ipage);
    if (iosInfo.classes.includes('app-ios-client') && iosInfo.classes.includes('app-top-safe-shell')) {
      ok('ios shouye chrome classes');
    } else fail('ios shouye chrome classes', iosInfo.classes.join(' '));
    if (iosInfo.prefetchLinks.length >= 3) ok('ios still prefetches other tabs');
    else fail('ios still prefetches other tabs', iosInfo.prefetchLinks.join(','));
    await ios.close();
  } finally {
    await browser.close();
  }

  console.log('[android-load-selftest] done passed=' + passed + ' failed=' + failed);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('[android-load-selftest] ERROR', err && err.stack ? err.stack : err);
  process.exit(1);
});
