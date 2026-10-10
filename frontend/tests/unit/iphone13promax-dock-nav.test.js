import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const UA_RE = /iPhone\s*13\s*Pro\s*Max|iPhone14,3\b/;
const SCREEN_RE =
  /sides\.shortSide >= 426 &&[\s\S]*sides\.shortSide <= 430 &&[\s\S]*sides\.longSide >= 922 &&[\s\S]*sides\.longSide <= 930/;
const VISUAL_GUARD = /rect\.bottom >= visibleBottom - wantGap - 4/;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const navCss = readFileSync(resolve(__dirname, '../../css/nav.css'), 'utf8');
const pages = {
  shouye: readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8'),
  daiban: readFileSync(resolve(__dirname, '../../daiban.html'), 'utf8'),
  bancha: readFileSync(resolve(__dirname, '../../bancha.html'), 'utf8'),
  message: readFileSync(resolve(__dirname, '../../message.html'), 'utf8'),
  mine: readFileSync(resolve(__dirname, '../../mine.html'), 'utf8')
};

describe('iPhone 13 Pro Max docked bottom nav', () => {
  it('recognizes 13 Pro Max by model and 428×926', () => {
    expect(auth).toContain('function isIPhone13ProMaxClient()');
    expect(auth).toContain('function isIPhone13ProMaxDockNavClient()');
    expect(auth).toContain('function isIPhone428x926Viewport()');
    expect(auth).toContain('function isIPhoneDockBottomNavClient()');
    expect(UA_RE.test(auth)).toBe(true);
    expect(SCREEN_RE.test(auth)).toBe(true);
    expect(auth).toContain('clientUaBlob()');
  });

  it('pins a full-width docked bar and does not pull it off-screen', () => {
    expect(auth).toContain("classList.add('app-ios-iphone13promax')");
    expect(auth).toContain('html.app-ios-client.app-ios-iphone13promax');
    expect(auth).toContain("padding-bottom', 'max(8px, env(safe-area-inset-bottom, 34px))'");
    expect(VISUAL_GUARD.test(auth)).toBe(true);
    expect(navCss).toContain('html.app-ios-client.app-ios-iphone13promax');
    expect(navCss).toContain('env(safe-area-inset-bottom');
  });

  it('first-paints tab pages so the clipped capsule does not flash', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(html, name).toContain('app-ios-iphone13promax');
      expect(html, name).toMatch(/auth\.js\?v=202609/);
      expect(UA_RE.test(html), name).toBe(true);
    });
  });
});
