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

  it('14 Pro Max 不走贴底 dock，胶囊左右 16px 圆角 32', () => {
    expect(auth).toContain('isIPhone14ProMaxCapsuleNavClient()');
    expect(auth).toContain("setProperty('border-radius', '32px', 'important')");
    expect(auth).toContain("setProperty('bottom', 'calc(env(safe-area-inset-bottom, 34px) + 8px)', 'important')");
    expect(auth).toContain("setProperty('left', '16px', 'important')");
    expect(auth).toContain("setProperty('height', '54px', 'important')");
    expect(auth).toMatch(/--bottom-nav-clearance',\s*'calc\(54px \+ env\(safe-area-inset-bottom, 34px\) \+ 20px\)'[\s\S]{0,80}return;/);
    expect(auth).toContain('function pinIPhone14ProMaxZxkCard()');
    expect(navCss).toContain('html.app-ios-client.app-ios-iphone14promax');
    expect(navCss).toContain('border-radius: 32px !important');
    expect(navCss).toContain('left: 16px !important');
    expect(navCss).toContain('bottom: calc(env(safe-area-inset-bottom, 34px) + 8px) !important');
    expect(navCss).toContain('height: 54px !important');
  });

  it('首页可下滑停住，只挡贴顶回弹，并垫 59px 蓝顶', () => {
    expect(shouye).toContain('allowShouyePageScroll14pm');
    expect(shouye).toContain('y <= 0 && dy > 0');
    expect(shouye).not.toContain('function pinShouyePageScroll');
    expect(shouye).toContain('overscroll-behavior-y: none');
    expect(shouye).toContain('height: 59px !important');
    expect(shouye).toContain("setProperty('--app-shell-statusbar-top', '59px')");
    expect(shouye).toContain('backgroundColor = \'#4f90f3\'');
    expect(auth).toContain('islandBlueTopPage');
    expect(auth).toContain('不认 430×932 屏幕兜底');
  });

  it('各 Tab 首绘 14 Pro Max，并刷新缓存', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(html, name).toContain('app-ios-iphone14promax');
      expect(html, name).toContain('iPhone15,3');
      expect(html, name).toMatch(/auth\.js\?v=/);
    });
    expect(pages.shouye).toContain('auth.js?v=20260911-ace6-home');
    expect(pages.shouye).toContain('nav.css?v=20260910-ios-14pm-fb1');
  });

  it('14 Pro Max 各 Tab 系统栏跟页头蓝，不透黑底/浅灰留白', () => {
    expect(pages.mine).toContain("backgroundColor = '#1677ff'");
    expect(pages.mine).toContain('mine14pmTopLock');
    expect(pages.mine).toContain('html.app-ios-iphone14promax{background-color:#1677ff!important');
    expect(pages.mine).toContain("setAttribute('content', '#1677ff')");
    expect(auth).toContain('data-14pm-mine-chrome');
    expect(auth).toContain('html:not(.app-ios-iphone14promax){background-color:#f5f6fa !important;background-image:');
    expect(auth).toContain('html.app-ios-iphone14promax{background-color:#1677ff !important;background-image:none !important;');
    expect(auth).toContain('html.app-ios-iphone14promax{background-color:#2b81f2 !important;background-image:none !important;');
    expect(pages.daiban).toContain("backgroundColor = '#2b81f2'");
    expect(pages.bancha).toContain("backgroundColor = '#2b81f2'");
    expect(pages.message).toContain("backgroundColor = '#1e8fff'");
  });

  it('首页专项附加扣除白卡有 14 Pro Max 专属字号与居中', () => {
    expect(shouye).toContain('html.app-ios-iphone14promax .sy-zxk-policy');
    expect(shouye).toContain('html.app-ios-iphone14promax .sy-zxk-msg');
    expect(shouye).toContain('html.app-ios-iphone14promax .sy-zxk-btns');
    expect(shouye).toContain('PingFangSC-Semibold');
    expect(shouye).toContain('-webkit-text-fill-color: #ffffff !important');
    expect(shouye).toContain('font-weight: 700 !important');
    expect(shouye).toContain('left: 50% !important');
    expect(shouye).toContain('object-fit: fill !important');
    expect(shouye).toContain('html.app-ios-iphone14promax .sy-zxk-btn img');
    expect(shouye).toContain('display: block !important');
    expect(shouye).toMatch(/html\.app-ios-iphone14promax \.sy-zxk-policy[\s\S]*align-self: stretch !important/);
    expect(shouye).toContain('sy14pmHomeLock');
  });
});
