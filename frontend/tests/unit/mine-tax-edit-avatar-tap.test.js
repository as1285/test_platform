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

function fireShortTap(el) {
  el.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
}

describe('mine tax-edit avatar tap (iOS double-bind)', () => {
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
    expect(guideSrc).toContain("var hit = document.getElementById('mineAvatarEditHit')");
    expect(guideSrc).toMatch(
      /var hit = document\.getElementById\('mineAvatarEditHit'\);\s*if \(hit\) \{\s*bindAvatarTaxEditToggle\(hit\);\s*return;/
    );
    expect(guideSrc).not.toMatch(
      /bindAvatarTaxEditToggle\(document\.getElementById\('headerImg'\)\);\s*bindAvatarTaxEditToggle\(document\.getElementById\('mineAvatarEditHit'\)\)/
    );
    expect(guideSrc).toContain("再点 ' + left + ' 次");
    expect(authSrc).toContain('conversion-guide.js?v=20260905-no-home-refund');
    expect(mineHtml).toContain('html.app-ios-client body.page-mine .mine-avatar-edit-hit');
    expect(mineHtml).toContain('width: calc(220 * var(--mine-rpx))');
    expect(mineHtml).toMatch(/auth\.js\?v=20260905-no-home-refund/);
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
  });

  it('falls back to #headerImg when hit area is absent', () => {
    document.body.innerHTML = '<img id="headerImg" alt="">';
    loadGuide();
    expect(document.getElementById('headerImg').getAttribute('data-cg-tax-edit-toggle')).toBe(
      '1'
    );
  });

  it('double-fire within debounce window counts as one tap; five spaced taps toggle once', () => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<img id="headerImg" alt="">' +
      '<button type="button" id="mineAvatarEditHit" class="mine-avatar-edit-hit"></button>';
    const cg = loadGuide();
    cg.setTaxEditMode(true);
    expect(cg.isTaxEditModeOn()).toBe(true);

    const hit = document.getElementById('mineAvatarEditHit');
    for (let i = 0; i < 5; i += 1) {
      fireShortTap(hit);
      /* 模拟 iOS 同一次触摸的二次计数（旧双绑 / touch+click） */
      fireShortTap(hit);
      vi.advanceTimersByTime(350);
    }

    expect(cg.isTaxEditModeOn()).toBe(false);

    /* 再 5 次应重新开启，证明不是卡在关不掉/开不开 */
    for (let i = 0; i < 5; i += 1) {
      fireShortTap(hit);
      fireShortTap(hit);
      vi.advanceTimersByTime(350);
    }
    expect(cg.isTaxEditModeOn()).toBe(true);
  });
});
