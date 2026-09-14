import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');

describe('小米 13 Ultra 我的页三宫格胶囊', () => {
  it('识别 2304FPN6 / 13 Ultra，并钉画布 rpx', () => {
    expect(auth).toContain('function isXiaomi13UltraClient()');
    expect(auth).toContain('function xiaomi13UltraMineE1LockCss()');
    expect(auth).toContain('function pinXiaomi13UltraMineE1Layout()');
    expect(auth).toContain('data-xiaomi13ultra-mine-e1-lock');
    expect(auth).toContain("var xiaomi13ultra =");
    expect(auth).toMatch(/acepro \|\| reno10 \|\| hinova9se \|\| xiaomi13ultra/);
    expect(auth).toContain('pinXiaomi13UltraMineE1Layout()');
    expect(auth).toContain('aspect-ratio:750 / 1180');
    expect(auth).toContain('background-size:100% auto !important');
  });

  it('不走 HyperOS 2 的 100% 100% 压扁锁', () => {
    expect(auth).toMatch(
      /function isHyperOs2MineE1SmClient\(\) \{\s*[\s\S]{0,720}app-android-xiaomi-13ultra/
    );
    expect(auth).toContain(
      ':not(.app-android-redmi-k70):not(.app-android-xiaomi-13ultra)'
    );
    expect(auth).toMatch(
      /function pinXiaomi14ProMineE1Layout\(\) \{[\s\S]{0,900}pinXiaomi13UltraMineE1Layout\(\)/
    );
    expect(auth).toMatch(
      /function paintXiaomi14ProMineE1\(src\) \{[\s\S]{0,500}app-android-xiaomi-13ultra/
    );
    expect(auth).toContain("canvas13.style.setProperty('background-size', '100% auto', 'important')");
    expect(auth).toContain("canvas13.style.setProperty('aspect-ratio', '750 / 1180', 'important')");
    expect(boot).toContain(
      ':not(.app-android-redmi-k70):not(.app-android-xiaomi-13ultra):not(.app-android-oppo-reno10) body.page-mine .mine-e1-canvas'
    );
    expect(mine).toContain(
      ':not(.app-android-redmi-k70):not(.app-android-xiaomi-13ultra):not(.app-android-oppo-reno10) body.page-mine .mine-e1-canvas'
    );
  });

  it('首屏即打 13ultra class，画布按宽度定高、叠层 top 锁 0', () => {
    expect(mine).toContain('data-xiaomi13ultra-mine-e1-firstpaint');
    expect(mine).toContain("classList.add('app-android-xiaomi-13ultra')");
    expect(mine).toContain('aspect-ratio:750/1180');
    expect(mine).toContain('aspect-ratio: 750 / 1180');
    expect(mine).toContain(':not(.app-android-xiaomi-13ultra):not(.app-android-mine-e1-plainimg)');
    expect(mine).toContain('background-size:100% auto!important');
    expect(boot).toContain('2304FPN6|(?:Xiaomi|Mi|小米)[\\s_-]*13[\\s_-]*Ultra');
    expect(boot).toContain('data-xiaomi13ultra-mine-e1-firstpaint');
    expect(boot).toContain('background-size:100% auto!important');
    expect(mine).toContain('auth-boot.js?v=20260914-a93s-mine');
    expect(mine).toContain('auth.js?v=20260914-a93s-mine');
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
      /html\.app-android-xiaomi-13ultra[\s\S]{0,1600}\.mine-e1-layer[\s\S]{0,200}top:\s*0\s*!important/
    );
  });
});
