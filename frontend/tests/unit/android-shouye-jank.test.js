import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');

describe('安卓首页首屏不再被 100vw / 阻塞脚本拖住', () => {
  it('rpx 按画布宽度，并裁掉横向溢出', () => {
    expect(shouye).toContain('--sy-rpx: calc(100% / 750)');
    expect(shouye).not.toMatch(/body\.page-shouye\s*\{[^}]*--sy-rpx:\s*calc\(100vw \/ 750\)/);
    expect(shouye).toContain('html.app-android-client body.page-shouye');
    expect(shouye).toContain('overflow-x: hidden');
    expect(shouye).toContain("setProperty('--sy-rpx', wSy / 750 + 'px')");
  });

  it('首屏图预加载，home-services 改为 defer，auth.js 降低优先级', () => {
    expect(shouye).toContain('preload" as="image" href="/img/home/a1.png');
    expect(shouye).toContain('preload" as="image" href="/img/home/a32.png');
    expect(shouye).toContain('preload" as="image" href="/img/home/ahead.png');
    expect(shouye).toMatch(/home-services\.js\?v=20260908-apk-icons" defer/);
    expect(shouye).toContain('auth.js?v=20260914-s15-black" defer fetchpriority="low"');
    expect(shouye).toContain('src="/img/home/a32.png?v=20260901-home-compress"');
    expect(shouye).toContain("addEventListener('DOMContentLoaded', syncHomeKeyServices)");
    expect(shouye).toContain('v=20260916-shouye-jank');
  });
});
