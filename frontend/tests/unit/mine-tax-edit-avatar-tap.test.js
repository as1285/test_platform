import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const guideSrc = readFileSync(
  resolve(__dirname, '../../public/js/conversion-guide.js'),
  'utf8'
);
const authSrc = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const mineHtml = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');

function loadGuide() {
  window.__cgCapturePrivacyBound = false;
  delete window.ConversionGuide;
  window.trackUserAction = vi.fn();
  window.fetch = vi.fn(() => Promise.reject(new Error('offline')));
  // eslint-disable-next-line no-eval
  eval(guideSrc);
  return window.ConversionGuide;
}

function fireTouch(el, type, opts = {}) {
  const touch = {
    clientX: opts.x ?? 100,
    clientY: opts.y ?? 100,
    identifier: 1,
    target: el
  };
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'touches', {
    value: type === 'touchend' || type === 'touchcancel' ? [] : [touch]
  });
  Object.defineProperty(ev, 'changedTouches', { value: [touch] });
  el.dispatchEvent(ev);
  return ev;
}

function fireShortTap(el, opts = {}) {
  fireTouch(el, 'touchstart', opts);
  fireTouch(el, 'touchend', opts);
}

/** 模拟 Android 轻触抖动：touchmove 位移小于取消阈值 */
function fireJitterTap(el) {
  fireTouch(el, 'touchstart', { x: 100, y: 100 });
  fireTouch(el, 'touchmove', { x: 106, y: 104 });
  fireTouch(el, 'touchend', { x: 106, y: 104 });
}

describe('mine tax-edit avatar tap (iOS/Android)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.body.removeAttribute('data-cg-tax-edit-ui');
    document.body.removeAttribute('data-cg-screenshot-ui');
    window.__cgCapturePrivacyBound = false;
    delete window.__cgScreenshotLongPress;
    delete window.__cgLastTouchTapAt;
    vi.stubGlobal('location', {
      href: 'http://localhost/mine.html',
      pathname: '/mine.html',
      search: '',
      assign: vi.fn(),
      replace: vi.fn()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('source prefers a single hit target and hardens physical-tap debounce', () => {
    expect(guideSrc).toContain('TAX_EDIT_PHYSICAL_TAP_GAP_MS');
    expect(guideSrc).toMatch(/TAX_EDIT_PHYSICAL_TAP_GAP_MS\s*=\s*100/);
    expect(guideSrc).toContain('MOVE_CANCEL_PX');
    expect(guideSrc).toContain("var hit = document.getElementById('mineAvatarEditHit')");
    expect(guideSrc).toMatch(
      /var hit = document\.getElementById\('mineAvatarEditHit'\);\s*if \(hit\) \{\s*bindAvatarTaxEditToggle\(hit\);\s*return;/
    );
    expect(guideSrc).not.toMatch(
      /bindAvatarTaxEditToggle\(document\.getElementById\('headerImg'\)\);\s*bindAvatarTaxEditToggle\(document\.getElementById\('mineAvatarEditHit'\)\)/
    );
    expect(guideSrc).toContain("再点 ' + left + ' 次");
    expect(guideSrc).toContain('--app-shell-statusbar-top, env(safe-area-inset-top,0px)');
    expect(authSrc).toContain('conversion-guide.js?v=20260908-no-qr-guide');
    expect(authSrc).toContain('mineNeedsCg');
    expect(authSrc).toContain('inTabEmbed && !mineNeedsCg');
    expect(mineHtml).toContain('html.app-ios-client body.page-mine .mine-avatar-edit-hit');
    expect(mineHtml).toContain('html.app-android-client body.page-mine .mine-avatar-edit-hit');
    expect(mineHtml).toContain('width: calc(220 * var(--mine-rpx))');
    expect(mineHtml).toContain('pointer-events: auto');
    expect(mineHtml).toContain('app-cordova-shell:not(.app-android-xiaomi-14pro)');
    expect(mineHtml).toMatch(/auth\.js\?v=20260909-android-aug1-blue/);
  });

  it('auth injects conversion-guide on mine even inside tab_embed', () => {
    expect(authSrc).toMatch(/mineNeedsCg\s*=\s*pageCg === 'mine\.html'/);
    expect(authSrc).toContain("if (inTabEmbed && !mineNeedsCg) return");
    /* 「我的」不再走 Android idle 延后 */
    expect(authSrc).toMatch(/if \(mineNeedsCg\) \{\s*appendCg\(\);\s*return;/);
    expect(authSrc).not.toMatch(
      /primaryTabs\s*=\s*\{[^}]*'mine\.html':\s*true/
    );
  });

  it('binds only #mineAvatarEditHit when present (headerImg stays unbound)', () => {
    document.body.innerHTML =
      '<img id="headerImg" alt="">' +
      '<button type="button" id="mineAvatarEditHit" class="mine-avatar-edit-hit"></button>';
    loadGuide();
    const hit = document.getElementById('mineAvatarEditHit');
    const img = document.getElementById('headerImg');
    expect(hit.getAttribute('data-cg-tax-edit-toggle')).toBe('1');
    expect(img.getAttribute('data-cg-tax-edit-toggle')).toBe(null);
    expect(hit.style.pointerEvents).toBe('auto');
  });

  it('falls back to #headerImg when hit area is absent', () => {
    document.body.innerHTML = '<img id="headerImg" alt="">';
    loadGuide();
    expect(document.getElementById('headerImg').getAttribute('data-cg-tax-edit-toggle')).toBe(
      '1'
    );
  });

  it('rapid taps under old 320ms gap still count; five taps toggle once each way', () => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<img id="headerImg" alt="">' +
      '<button type="button" id="mineAvatarEditHit" class="mine-avatar-edit-hit"></button>';
    const cg = loadGuide();
    cg.setTaxEditMode(true);
    expect(cg.isTaxEditModeOn()).toBe(true);

    const hit = document.getElementById('mineAvatarEditHit');
    /* 真机连点常约 150–250ms；旧 320ms 去重会吞掉一半 */
    for (let i = 0; i < 5; i += 1) {
      fireShortTap(hit);
      fireShortTap(hit); /* 同一次触摸的二次计数（touch+合成） */
      vi.advanceTimersByTime(180);
    }

    expect(cg.isTaxEditModeOn()).toBe(false);

    for (let i = 0; i < 5; i += 1) {
      fireShortTap(hit);
      fireShortTap(hit);
      vi.advanceTimersByTime(180);
    }
    expect(cg.isTaxEditModeOn()).toBe(true);
  });

  it('shows capture toast when toggling on mine page', () => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<button type="button" id="mineAvatarEditHit" class="mine-avatar-edit-hit"></button>';
    const cg = loadGuide();
    cg.setTaxEditMode(false);
    const toast = document.getElementById('cg-capture-toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toMatch(/数据编辑已关闭/);
    expect(toast.classList.contains('is-show')).toBe(true);

    cg.setTaxEditMode(true);
    expect(toast.textContent).toMatch(/数据编辑已开启/);
  });

  it('Android-style micro jitter still counts; discarded touchend leaves click fallback', () => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<button type="button" id="mineAvatarEditHit" class="mine-avatar-edit-hit"></button>';
    const cg = loadGuide();
    cg.setTaxEditMode(false);
    const hit = document.getElementById('mineAvatarEditHit');

    for (let i = 0; i < 5; i += 1) {
      fireJitterTap(hit);
      vi.advanceTimersByTime(180);
    }
    expect(cg.isTaxEditModeOn()).toBe(true);

    /* 大位移滑动：touchend 不计次，且不打 __cgLastTouchTapAt，合成 click 可兜底 */
    for (let i = 0; i < 5; i += 1) {
      delete window.__cgLastTouchTapAt;
      fireTouch(hit, 'touchstart', { x: 100, y: 100 });
      fireTouch(hit, 'touchmove', { x: 140, y: 100 });
      fireTouch(hit, 'touchend', { x: 140, y: 100 });
      expect(window.__cgLastTouchTapAt).toBeUndefined();
      hit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      vi.advanceTimersByTime(180);
    }
    expect(cg.isTaxEditModeOn()).toBe(false);
  });
});
