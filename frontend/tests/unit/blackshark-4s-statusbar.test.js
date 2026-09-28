import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const pages = {
  shouye: readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8'),
  daiban: readFileSync(resolve(__dirname, '../../daiban.html'), 'utf8'),
  bancha: readFileSync(resolve(__dirname, '../../bancha.html'), 'utf8'),
  message: readFileSync(resolve(__dirname, '../../message.html'), 'utf8'),
  mine: readFileSync(resolve(__dirname, '../../mine.html'), 'utf8'),
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8')
};

describe('黑鲨 4S 不再铺顶部黑框', () => {
  it('auth.js 不识别、不绘制黑鲨黑状态栏', () => {
    expect(auth).not.toContain('isBlackShark4SClient');
    expect(auth).not.toContain('app-android-blackshark-4s');
    expect(auth).not.toContain('PRS-A0');
  });

  it('各页首屏不再给黑鲨铺黑条', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(html, name).not.toContain('app-android-blackshark-4s');
      expect(html, name).not.toContain('PRS-A0');
    });
  });
});
