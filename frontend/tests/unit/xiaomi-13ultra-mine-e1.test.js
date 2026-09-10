import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');

describe('小米 13 Ultra 我的页三宫格胶囊', () => {
  it('识别 2304FPN6 / 13 Ultra，并钉画布 rpx', () => {
    expect(auth).toContain('function isXiaomi13UltraClient()');
    expect(auth).toContain('function pinXiaomi13UltraMineE1Layout()');
    expect(auth).toContain('data-xiaomi13ultra-mine-e1-lock');
    expect(auth).toContain("var xiaomi13ultra =");
    expect(auth).toMatch(/acepro \|\| hinova9se \|\| xiaomi13ultra/);
    expect(auth).toContain('pinXiaomi13UltraMineE1Layout()');
    expect(auth).toContain('aspect-ratio:750 / 1180');
  });

  it('首屏即打 13ultra class，画布按宽度定高、叠层 top 锁 0', () => {
    expect(mine).toContain('data-xiaomi13ultra-mine-e1-firstpaint');
    expect(mine).toContain("classList.add('app-android-xiaomi-13ultra')");
    expect(mine).toContain('aspect-ratio:750/1180');
    expect(mine).toContain('aspect-ratio: 750 / 1180');
    expect(mine).toContain(':not(.app-android-xiaomi-13ultra):not(.app-android-mine-e1-plainimg)');
    expect(boot).toContain('2304FPN6|(?:Xiaomi|Mi|小米)[\\s_-]*13[\\s_-]*Ultra');
    expect(boot).toContain('data-xiaomi13ultra-mine-e1-firstpaint');
    expect(mine).toContain('auth-boot.js?v=20260910-13u-pill');
    expect(mine).toContain('auth.js?v=20260910-ios-14pm-home6');
  });

  it('Cordova 40px bleed 不再套到 13 Ultra 叠层', () => {
    const bleed = mine.slice(
      mine.indexOf(
        'html.app-android-client.app-cordova-shell:not(.app-android-xiaomi-14pro):not(.app-android-xiaomi-15)'
      ),
      mine.indexOf('html.app-android-oneplus-13 body.page-mine,')
    );
    expect(bleed).toContain('app-android-xiaomi-13ultra');
    expect(mine).toMatch(
      /html\.app-android-xiaomi-13ultra[\s\S]{0,220}\.mine-e1-layer[\s\S]{0,80}top:\s*0\s*!important/
    );
  });
});
