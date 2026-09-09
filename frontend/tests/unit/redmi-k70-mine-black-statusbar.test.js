import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

describe('红米 K70「我的」页状态栏对齐官方个税 App（纯黑底+白图标）', () => {
  it('applyMinePageChrome 为 K70 走黑状态栏分支', () => {
    const start = auth.indexOf('function applyMinePageChrome');
    const end = auth.indexOf('function applyDaibanBanchaPageChrome');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const fn = auth.slice(start, end);
    // 检测 K70
    expect(fn).toContain("classList.contains('app-android-redmi-k70')");
    // 顶 40px 黑条：靠 --app-shell-statusbar-top 推下来
    expect(fn).toContain("setProperty('--app-shell-statusbar-top', '40px', 'important')");
    // 状态栏纯黑底 + 白图标（styleLightContent），不收缩 WebView
    expect(fn).toContain("color: '#000000'");
    expect(fn).toContain("style: 'light'");
    expect(fn).toContain("overlays: true");
    // 非 K70 仍走蓝顶沉浸
    expect(fn).toContain('applyImmersiveBlueStatusBar(mineBlue');
  });

  it('黑底状态栏 theme-color 与 meta 对齐黑色', () => {
    const start = auth.indexOf('function applyMinePageChrome');
    const end = auth.indexOf('function applyDaibanBanchaPageChrome');
    const fn = auth.slice(start, end);
    expect(fn).toContain("upsertMeta('theme-color', '#000000')");
    expect(fn).toContain("setStatusBarStyleMeta('black')");
  });
});
