import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const UA_RE = /iPhone\s*14\s*Pro\s*Max|iPhone15,3\b/;
const SCREEN_RE =
  /sides\.shortSide >= 428 &&[\s\S]*sides\.shortSide <= 432 &&[\s\S]*sides\.longSide >= 928 &&[\s\S]*sides\.longSide <= 936/;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const navCss = readFileSync(resolve(__dirname, '../../css/nav.css'), 'utf8');
const pages = {
  shouye: readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8'),
  daiban: readFileSync(resolve(__dirname, '../../daiban.html'), 'utf8'),
  bancha: readFileSync(resolve(__dirname, '../../bancha.html'), 'utf8'),
  message: readFileSync(resolve(__dirname, '../../message.html'), 'utf8'),
  mine: readFileSync(resolve(__dirname, '../../mine.html'), 'utf8')
};

describe('iPhone 14 Pro Max 正版贴底毛玻璃底栏', () => {
  it('按型号 iPhone15,3 / 14 Pro Max 与 430×932 识别', () => {
    expect(auth).toContain('function isIPhone14ProMaxClient()');
    expect(auth).toContain("classList.add('app-ios-iphone14promax')");
    expect(UA_RE.test(auth)).toBe(true);
    expect(SCREEN_RE.test(auth)).toBe(true);
    expect(auth).toContain('iPhone\\s*14\\s*Pro\\s*Max|iPhone15,3\\b');
    expect(auth).toContain('rgba(255,255,255,0.52)');
  });

  it('14/15 Pro Max 用半透明贴底，13 Pro Max 仍实心白', () => {
    expect(navCss).toContain('html.app-ios-client.app-ios-iphone14promax');
    expect(navCss).toContain('rgba(255, 255, 255, 0.52)');
    expect(navCss).toContain('saturate(180%) blur(26px)');
    expect(navCss).toContain('bottom: 0 !important');
    expect(auth).toContain("padding-bottom', 'max(8px, env(safe-area-inset-bottom, 34px))'");
  });

  it('首页与各 Tab 首绘 14 Pro Max，避免先闪悬浮胶囊', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(html, name).toContain('app-ios-iphone14promax');
      expect(html, name).toContain('iPhone15,3');
      expect(html, name).toMatch(/auth\.js\?v=2026090/);
    });
    expect(pages.shouye).toContain('nav.css?v=20260909-iphone14pm-dock');
  });
});
