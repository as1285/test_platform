import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const cordova = readFileSync(resolve(__dirname, '../../../cordova-app/www/index.html'), 'utf8');

const MODEL_RE = /PHW110|CPH2531|CPH2525/i;

describe('OPPO Reno10 5G mine / home ColorOS 15', () => {
  it('matches Reno10 5G model codes and not Reno10 Pro', () => {
    ['PHW110', 'CPH2531', 'CPH2525'].forEach((id) => {
      expect(MODEL_RE.test(id), id).toBe(true);
    });
    expect(MODEL_RE.test('PHV110')).toBe(false);
    expect(MODEL_RE.test('PHU110')).toBe(false);
  });

  it('locks Reno10 off the 100vw @sm crop like Ace Pro', () => {
    expect(auth).toContain('function reno10MineE1LockCss()');
    expect(auth).toContain('function pinReno10MineE1Layout()');
    expect(auth).toContain('data-reno10-mine-e1-lock');
    expect(auth).toContain("classList.contains('app-android-oppo-reno10')");
    expect(auth).toContain(':not(.app-android-oppo-reno10) body.page-mine');
    expect(mine).toContain('data-reno10-mine-e1-firstpaint');
    expect(mine).toContain('html.app-android-oppo-reno10 body.page-mine .mine-e1-canvas');
    expect(mine).toContain('aspect-ratio: 1284 / 2127');
    expect(boot).toContain('data-reno10-mine-e1-firstpaint');
    expect(boot).toContain("classList.add('app-android-oppo-reno10')");
    expect(boot).toMatch(/if \(reno10\) \{[\s\S]*?return;/);
  });

  it('does not keep Reno10 on the 40px mine bleed group', () => {
    const bleedGroup = mine.slice(
      mine.indexOf('html.app-android-oneplus-13 body.page-mine,'),
      mine.indexOf('html.app-huawei-mine-noclip:not(.app-android-huawei-mate60):not(.app-android-huawei-p40pro) body.page-mine {')
    );
    expect(bleedGroup).toContain('ace2pro');
    expect(bleedGroup).not.toContain('oppo-reno10');
  });

  it('first-paints homepage Reno10 immersive 40px', () => {
    expect(shouye).toContain("classList.add('app-android-oppo-reno10')");
    expect(shouye).toContain("classList.add('app-android-immersive-white-top')");
    expect(shouye).toContain("'--app-shell-statusbar-top', '40px'");
  });

  it('ColorOS shell delays iframe mount to avoid file:// Application Error', () => {
    expect(cordova).toContain('function isColorOsShell()');
    expect(cordova).toContain('function mountAppWhenShellReady()');
    expect(cordova).toContain('file:///android_asset/www/index.html');
    expect(cordova).toContain('mountAppWhenShellReady()');
  });
});
