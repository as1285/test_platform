import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');

describe('iOS home a6 card size', () => {
  // 592ae5b「首页撤销 iPhone15PM 特判」同时撤销了「全 iOS 3.1 分栏缩图标」规则，
  // 首页恢复与安卓共用的 .sy-apk-hitem 基线尺寸。此处守护该撤销不被误重新引入。
  it('首页不再对 iOS 单独缩到 3.1 列，也无 iPhone15ProMax 专属图标规则', () => {
    expect(shouye).not.toMatch(/html\.app-ios-client \.sy-apk-hitem/);
    expect(shouye).not.toMatch(/html\.app-ios-iphone15promax \.sy-apk-hitem/);
    expect(shouye).toContain('.sy-apk-hitem');
  });
});
