import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iPhone 13 Pro Max 收入纳税明细白顶栏', () => {
  it('白顶栏页用实底白 StatusBar，避免透明色落成黑条', () => {
    const start = auth.indexOf('iOS 白顶栏页：深色状态栏文字');
    const end = auth.indexOf('function applyImmersiveNotchWhitePageChrome()');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const chrome = auth.slice(start, end);
    expect(chrome).toContain("color: '#ffffff'");
    expect(chrome).toContain("shell_bg: '#ffffff'");
    expect(chrome).toContain("style: 'default'");
    expect(chrome).not.toContain("color: '#00000000'");
    expect(chrome).toContain('setTimeout(reapplyDark, 800)');
    expect(chrome).toContain('13PM');
  });

  it('明细页缓存戳与 iOS 顶白底盾牌在位', () => {
    expect(shuimingResult).toContain('auth.js?v=20260908-ios-white-top');
    expect(shuimingResult).toContain('html.platform-ios body.page-shuiming-result::before');
    expect(shuimingResult).toContain('428');
  });
});
