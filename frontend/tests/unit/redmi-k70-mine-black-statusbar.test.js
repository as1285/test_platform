import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

describe('红米 K70「我的」页状态栏对齐官方个税 App（纯黑底+白图标）', () => {
  it('applyMinePageChrome 安卓沉浸机顶距 40px + 头图黑垫，不再 padding-top:0 盖黑条', () => {
    const start = auth.indexOf('function applyMinePageChrome');
    const end = auth.indexOf('function applyDaibanBanchaPageChrome');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const fn = auth.slice(start, end);
    // 安卓统一顶 40px，压过族清零
    expect(fn).toContain(
      "html.app-android-client.app-top-safe-shell{--app-shell-statusbar-top:40px !important;"
    );
    expect(fn).toContain('html.app-android-redmi-k70.app-top-safe-shell,');
    // 头图下推：padding 用顶距变量，底色纯黑（勿再 padding-top:0）
    expect(fn).toContain(
      'padding-top:var(--app-shell-statusbar-top,40px) !important;'
    );
    expect(fn).toContain('background:#000000 !important;');
    expect(fn).not.toContain(
      'html.app-android-client.app-top-safe-shell body.page-mine .mine-e1-canvas{padding-top:0 !important;}'
    );
    // JS 再钉一次顶距 + 走黑状态栏
    expect(fn).toContain("setProperty('--app-shell-statusbar-top', '40px', 'important')");
    expect(fn).toContain('applyImmersiveBlueStatusBar(mineBlue');
    // Ace2V 外置黑条仍清零，避免双空
    expect(fn).toContain('html.app-android-oneplus-ace2v.app-top-safe-shell{--app-shell-statusbar-top:0px !important;');
  });

  it('黑底状态栏由 applyImmersiveBlueStatusBar 统一（安卓 #000000）', () => {
    const start = auth.indexOf('function applyImmersiveBlueStatusBar');
    const end = auth.indexOf('function applyMinePageChrome');
    const fn = auth.slice(start, end);
    expect(fn).toContain("color: '#000000'");
    expect(fn).toContain("upsertMeta('theme-color', '#000000')");
    expect(fn).toContain("setStatusBarStyleMeta('black')");
  });
});

describe('mine.html 不再把 K70 顶距清零', () => {
  const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');
  it('K70 首屏钉 40px 黑条，静态 CSS 为 40px 而非 0', () => {
    expect(mine).toContain('redmiK70MineFirstPaint');
    expect(mine).toContain('linear-gradient(#000000 0px,#000000 40px,#f5f6fa 40px)');
    expect(mine).toContain('html.app-android-redmi-k70 body.page-mine');
    // 旧清零写法不得再出现在同一规则块
    expect(mine).not.toMatch(
      /html\.app-android-redmi-k70 body\.page-mine[^{]*\{[\s\S]*?--app-shell-statusbar-top:\s*0px/
    );
  });
});
