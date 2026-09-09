import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const UA_RE = /iPhone\s*14\s*Pro\s*Max|iPhone15,3\b/;
const SCREEN_RE =
  /sides\.shortSide >= 428 &&[\s\S]*sides\.shortSide <= 432 &&[\s\S]*sides\.longSide >= 928 &&[\s\S]*sides\.longSide <= 936/;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const navCss = readFileSync(resolve(__dirname, '../../css/nav.css'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const pages = {
  shouye,
  daiban: readFileSync(resolve(__dirname, '../../daiban.html'), 'utf8'),
  bancha: readFileSync(resolve(__dirname, '../../bancha.html'), 'utf8'),
  message: readFileSync(resolve(__dirname, '../../message.html'), 'utf8'),
  mine: readFileSync(resolve(__dirname, '../../mine.html'), 'utf8')
};

describe('iPhone 14 Pro Max 悬浮胶囊底栏', () => {
  it('按型号 iPhone15,3 / 14 Pro Max 与 430×932 识别', () => {
    expect(auth).toContain('function isIPhone14ProMaxClient()');
    expect(auth).toContain('function isIPhone14ProMaxCapsuleNavClient()');
    expect(auth).toContain("classList.add('app-ios-iphone14promax')");
    expect(UA_RE.test(auth)).toBe(true);
    expect(SCREEN_RE.test(auth)).toBe(true);
  });

  it('14 Pro Max 不走贴底 dock，改回 8px 胶囊', () => {
    expect(auth).toContain('isIPhone14ProMaxCapsuleNavClient()');
    expect(auth).toContain("setProperty('border-radius', '32px', 'important')");
    expect(auth).toContain("setProperty('bottom', '8px', 'important')");
    expect(navCss).toContain('html.app-ios-client.app-ios-iphone14promax');
    expect(navCss).toContain('border-radius: 32px !important');
    expect(navCss).toContain('left: 16px !important');
  });

  it('首页可下滑停住，只挡贴顶回弹，并垫 59px 蓝顶', () => {
    expect(shouye).toContain('allowShouyePageScroll14pm');
    expect(shouye).toContain('y <= 0 && dy > 0');
    expect(shouye).not.toContain('function pinShouyePageScroll');
    expect(shouye).toContain('overscroll-behavior-y: none');
    expect(shouye).toContain('height: 59px !important');
    expect(shouye).toContain("setProperty('--app-shell-statusbar-top', '59px')");
    expect(auth).toContain('islandBlueTopPage');
  });

  it('各 Tab 首绘 14 Pro Max，并刷新缓存', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(html, name).toContain('app-ios-iphone14promax');
      expect(html, name).toContain('iPhone15,3');
      expect(html, name).toMatch(/auth\.js\?v=20260909-ios-14pm-fix[34]/);
    });
    expect(pages.shouye).toContain('auth.js?v=20260909-ios-14pm-fix4');
    expect(pages.shouye).toContain('nav.css?v=20260909-ios-14pm-fix3');
  });
});
