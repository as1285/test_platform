import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');

const X90_RE = /V2241A|V2241EA|PD2241\b|(?:vivo[\s_-]*)?X90\b(?![\s_-]*(?:Pro|[sS]|Plus|\+))/i;

/* e1 底图 1284×2127（@sm 副本 750×1242）。360px 视口下真实高度 596px，@sm 裁切档只有 566px。 */
const E1_W = 1284;
const E1_H = 2127;
const SM_W = 750;
const SM_H = 1242;
const VIEWPORT = 360;

/*
 * 底图逐行采样（@sm 即 rpx 坐标）：
 *   三宫格白卡 519–741、灰缝 741–765、菜单白卡 765–1226、图底 1242。
 *   胶囊在图内已擦除，擦除带 660–738；CSS 单层绘制的胶囊固定 688–724。
 */
const CARD_BOTTOM = 741;
const MENU_TOP = 765;
const ERASED_PILL_TOP = 660;
const ERASED_PILL_BOTTOM = 738;
const PILL_TOP = 688;
const PILL_BOTTOM = 724;

describe('vivo X90 mine e1 single-layer paint', () => {
  it('routes X90 but not X90 Pro / Pro+ / X90s into the plain-img branch', () => {
    ['V2241A', 'V2241EA', 'PD2241', 'vivo X90', 'X90'].forEach((ua) => {
      expect(X90_RE.test(ua), ua).toBe(true);
    });
    ['vivo X90 Pro', 'X90 Pro+', 'vivo X90s', 'V2242A', 'V2227A'].forEach((ua) => {
      expect(X90_RE.test(ua), ua).toBe(false);
    });
    expect(mine).toContain('V2241A|V2241EA|PD2241\\b');
    expect(mine).toContain('window.__mineE1PlainImg = true;');
    expect(mine).toContain("document.documentElement.classList.add('app-android-mine-e1-plainimg')");
  });

  it('first-paints X90 without the @sm crop class that builds the double layer', () => {
    /* mine.html 内联脚本先立旗，auth-boot 必须在挂 @sm 裁切档之前放行 */
    const plainIdx = boot.indexOf('app-android-mine-e1-plainimg');
    const smIdx = boot.indexOf("document.documentElement.classList.add('app-android-mine-e1-sm')");
    expect(plainIdx).toBeGreaterThan(0);
    expect(smIdx).toBeGreaterThan(plainIdx);
    expect(boot).toMatch(/window\.__mineE1PlainImg \|\|[\s\S]{0,120}window\.__mineE1ForceSm = true;\s*return;/);
    const bootIdx = mine.indexOf('/js/auth-boot.js?v=');
    expect(mine.indexOf("classList.add('app-android-mine-e1-plainimg')")).toBeLessThan(bootIdx);
  });

  it('paints the artwork once: <img> stays visible and the canvas keeps no background copy', () => {
    const css = mine.slice(
      mine.indexOf('html.app-android-mine-e1-plainimg body.page-mine {'),
      mine.indexOf('/* 游客：叠字隐藏，登录钮落在信息卡中央 */')
    );
    expect(css).toContain('background-image: none !important;');
    expect(css).toContain('opacity: 1 !important;');
    expect(css).not.toContain('opacity: 0 !important;');
    expect(css).not.toContain('background-size: 100% 100%');
    expect(css).not.toContain('1180');
    expect(css).toContain('aspect-ratio: 1284 / 2127 !important;');
    expect(css).toContain('padding-bottom: calc(2127 / 1284 * 100%) !important;');
    expect(mine).toContain('if (sm && !window.__mineE1PlainImg)');
    expect(auth).toContain('function isMineE1PlainImgClient()');
    expect(auth).toMatch(
      /function paintXiaomi14ProMineE1\(src\) \{\s*try \{\s*if \(isIqooMineTailPhone\(\) \|\| isMineE1PlainImgClient\(\)\)/
    );
    expect(auth).toMatch(
      /function pinXiaomi14ProMineE1Layout\(\) \{[\s\S]{0,160}isMineE1PlainImgClient\(\)/
    );
  });

  it('keeps the plain-img tier out of the @sm crop and the generic status-bar bleed', () => {
    expect(auth).toContain('html.app-android-mine-e1-sm:not(.app-android-mine-e1-plainimg)');
    expect(auth).toContain(
      ':not(.app-android-mine-e1-sm):not(.app-android-mine-e1-plainimg) body.page-mine .mine-e1-canvas'
    );
    expect(mine).toContain('html.app-android-mine-e1-sm:not(.app-android-mine-e1-plainimg)');
    expect(auth).toContain('function mineE1PlainImgLockCss()');
    expect(auth).toContain('data-mine-e1-plainimg-lock');
    expect(auth).toContain('pinMineE1PlainImgLayout();');
    const chrome = auth.slice(auth.indexOf('androidMineE1TailCropCss() +'));
    expect(chrome.indexOf('xiaomi14ProMineE1LockCss()')).toBeLessThan(
      chrome.indexOf('mineE1PlainImgLockCss()')
    );
  });

  it('drops the crop stretch so the pill row keeps its gap to the menu list', () => {
    const trueHeight = (VIEWPORT * E1_H) / E1_W;
    const croppedHeight = (VIEWPORT * 1180) / SM_W;
    expect(Math.round(trueHeight)).toBe(596);
    expect(Math.round(croppedHeight)).toBe(566);

    const rpx = VIEWPORT / SM_W;
    /* 真实比例：胶囊整颗落在图内擦除带里，到菜单白卡还剩 41rpx ≈ 19px */
    expect(PILL_TOP).toBeGreaterThanOrEqual(ERASED_PILL_TOP);
    expect(PILL_BOTTOM).toBeLessThanOrEqual(ERASED_PILL_BOTTOM);
    expect(PILL_BOTTOM).toBeLessThan(CARD_BOTTOM);
    expect((MENU_TOP - PILL_BOTTOM) * rpx).toBeGreaterThan(18);
    /* background-size:100% 100% 压进 1180rpx 后擦除带与白卡下沿都被顶到胶囊之上 */
    const squash = 1180 / SM_H;
    expect(ERASED_PILL_BOTTOM * squash).toBeLessThan(PILL_BOTTOM);
    expect(CARD_BOTTOM * squash).toBeLessThan(PILL_BOTTOM);
  });

  it('keeps the single visible layer self-healing and its URL stable across variants', () => {
    expect(mine).toContain('if (window.__mineE1ForceSm && !window.__mineE1PlainImg) return;');
    expect(mine).toContain(
      "(base.indexOf('@sm') >= 0 ? '?v=20260901-android-mine-sm' : '?v=20260827-e1r3')"
    );
    expect(mine).toContain("if (String(hi.getAttribute('src') || '') !== url) hi.src = url;");
    expect(mine).toMatch(/auth-boot\.js\?v=20260905-vivox90-mine/);
    expect(mine).toMatch(/auth\.js\?v=20260905-vivox90-mine" defer/);
  });

  it('turns the translucent blurred nav capsule solid on the plain-img tier', () => {
    expect(auth).toContain('backdrop-filter:none !important;}');
    expect(auth).toContain('data-vivox90-mine-e1-paint');
    expect(mine).toContain('html.app-android-mine-e1-plainimg body.page-mine > .bottom-nav');
  });

  it('still serves the @sm asset so first paint reuses the preloaded URL', () => {
    expect(mine).toContain('window.__mineE1ForceSm = true;');
    expect(mine).toContain('/img/mine/e1_01@sm.png?v=20260901-android-mine-sm');
    /* @sm 与全尺寸同比例，单层 aspect-ratio 用 1284/2127 不会串位 */
    expect(Math.abs(SM_H / SM_W - E1_H / E1_W)).toBeLessThan(0.001);
  });
});
