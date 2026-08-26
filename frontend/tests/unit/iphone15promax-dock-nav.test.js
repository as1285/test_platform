import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const UA_RE = /iPhone\s*15\s*Pro\s*Max|iPhone\s*15\s*Plus|iPhone16,2\b|iPhone15,5\b/;
const SCREEN_RE =
  /sides\.shortSide >= 428 && sides\.shortSide <= 432 && sides\.longSide >= 928 && sides\.longSide <= 936/;
const DOCK_BOTTOM = 'bottom: 0 !important';
const DOCK_SAFE = 'env(safe-area-inset-bottom';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const navCss = readFileSync(resolve(__dirname, '../../css/nav.css'), 'utf8');
// 592ae5b 起首页(shouye)撤销 iPhone15ProMax 特判，故首页不再首绘该标记；
// 其余底部 Tab 页仍首绘以避免 15 Pro Max 上的胶囊闪动。
const pages = {
  daiban: readFileSync(resolve(__dirname, '../../daiban.html'), 'utf8'),
  bancha: readFileSync(resolve(__dirname, '../../bancha.html'), 'utf8'),
  message: readFileSync(resolve(__dirname, '../../message.html'), 'utf8'),
  mine: readFileSync(resolve(__dirname, '../../mine.html'), 'utf8')
};

describe('iPhone 15 Pro Max docked bottom nav', () => {
  it('recognizes 15 Pro Max / 15 Plus by model and 430×932', () => {
    expect(auth).toContain('function isIPhone15PlusProMaxLikeClient()');
    expect(auth).toContain('function isIPhone15ProMaxDockNavClient()');
    expect(auth).toMatch(/clientUaBlob\(\)/);
    expect(UA_RE.test(auth)).toBe(true);
    expect(SCREEN_RE.test(auth)).toBe(true);
    expect(auth).toContain('isIPhone16ProMaxClient()');
  });

  it('pins a full-width docked bar instead of the 8px capsule', () => {
    expect(auth).toContain('isIPhone15ProMaxDockNavClient()');
    expect(auth).toContain("nav.style.setProperty('bottom', '0', 'important')");
    expect(auth).toContain("padding-bottom', 'max(8px, env(safe-area-inset-bottom, 34px))'");
    expect(auth).toContain('html.app-ios-client.app-ios-iphone15promax');
    expect(navCss).toContain(DOCK_BOTTOM);
    expect(navCss).toContain(DOCK_SAFE);
    expect(navCss).toContain('html.app-ios-client.app-ios-iphone15promax');
  });

  it('first-paints the docked tab pages (首页除外) so the capsule does not flash', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(html, name).toContain('app-ios-iphone15promax');
      expect(html, name).toMatch(/20260826-iphone13pm|20260823-iphone15pm/);
      expect(UA_RE.test(html), name).toBe(true);
    });
  });
});
