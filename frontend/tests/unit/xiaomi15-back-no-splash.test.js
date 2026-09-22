import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

describe('小米 15 返回不闪启动图', () => {
  it('不注入 apple-touch-startup-image，并卸掉已有启动图', () => {
    expect(auth).toContain('if (!isXiaomi15Client())');
    expect(auth).toContain('link[rel="apple-touch-startup-image"]');
  });

  it('返回按钮优先 history.back，避免整页重载启动图', () => {
    expect(auth).toContain('function bindXiaomi15BackWithoutSplash()');
    expect(auth).toContain('bindXiaomi15BackWithoutSplash()');
    expect(auth).toMatch(/function bindXiaomi15BackWithoutSplash\(\) \{[\s\S]{0,900}window\.history\.back\(\)/);
  });
});
