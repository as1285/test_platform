import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

function zxkBtnCss() {
  const start = shouye.indexOf('.sy-zxk-btns {');
  const end = shouye.indexOf('.sy-zxk-empty-bar {');
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return shouye.slice(start, end);
}

describe('首页专项附加扣除双按钮不拉长', () => {
  it('通用样式按斜切 PNG 原比例缩放，不再铺满压扁', () => {
    const css = zxkBtnCss();
    expect(css).toContain('--sy-zxk-btn-h');
    expect(css).toContain('833 / 150');
    expect(css).toContain('390 / 833');
    expect(css).toContain('513 / 833');
    expect(css).toContain('-70 / 833');
    expect(css).toContain('translateX(-50%)');
    expect(css).not.toContain('left: 4.5%');
    expect(css).not.toContain('max-height: 36px');
    expect(css).not.toContain('height: 16%');
  });

  it('荣耀 / 14 Pro Max 不再把双按钮加宽压扁', () => {
    expect(shouye).not.toMatch(
      /html\.app-android-honor-pgt-an20 \.sy-zxk-btns[\s\S]{0,180}max-height: 32px/
    );
    expect(shouye).not.toContain('left: 3.5% !important');
    expect(shouye).not.toContain('height: 34px !important');
    expect(auth).not.toContain("setProperty('left', '3.5%', 'important')");
    expect(auth).not.toContain("setProperty('height', '34px', 'important')");
    expect(auth).toContain("btns.style.removeProperty('left')");
  });
});
