import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');

const K70_STD_MODEL = /23113RKC6[CG]|2311DRK48[CGI]/i;
const K70_STD_NAME = /(?:Redmi|Xiaomi|REDMI)[\s_-]*K70(?![\s_-]*(?:至尊|Ultra|Pro))/i;
const K70_ULTRA =
  /2407FPN8E[GR]|2407FRK8EC|XIG06|A402XM|(?:Redmi|Xiaomi|REDMI)[\s_-]*K70[\s_-]*(?:至尊|Ultra)/i;

describe('红米 K70 标准版全页黑状态栏', () => {
  it('识别 K70 标准版，不把至尊 / K80 / 真机 Pixel 算进来', () => {
    expect(K70_STD_MODEL.test('23113RKC6C')).toBe(true);
    expect(K70_STD_MODEL.test('23113RKC6G')).toBe(true);
    expect(K70_STD_NAME.test('Redmi K70')).toBe(true);
    expect(K70_ULTRA.test('2407FPN8EG')).toBe(true);
    expect(K70_ULTRA.test('Redmi K70 Ultra')).toBe(true);
    expect(K70_ULTRA.test('23113RKC6C')).toBe(false);
    expect(K70_STD_NAME.test('Redmi K70 Ultra')).toBe(false);
    expect(K70_STD_MODEL.test('Pixel 7')).toBe(false);
  });

  it('mine.html 首屏只留 40px 顶距，禁止 body::before 盖系统字', () => {
    expect(mine).toContain('function paintMineBlackStatusFirst');
    expect(mine).toContain('tax_device_model_v1');
    expect(mine).toContain("classList.add('app-android-redmi-k70')");
    expect(mine).toContain("classList.remove('app-mine-black-status')");
    expect(mine).toContain("classList.remove('app-android-immersive-white-top')");
    expect(mine).toContain('data-k70-std-mine-firstpaint');
    expect(mine).toContain(
      'html.app-android-redmi-k70:not(.app-android-redmi-k70-ultra) body.page-mine::before{display:none'
    );
    expect(mine).toContain(
      'html.app-android-redmi-k70:not(.app-android-redmi-k70-ultra) body.page-mine .mine-e1-canvas{padding-top:40px'
    );
    expect(mine).toContain('sdk_gphone|Android SDK|goldfish|ranchu');
    expect(mine).toContain('Windows|Macintosh|X11');
  });

  it('auth.js 全页黑条，标准版不再走 underlap', () => {
    expect(auth).toContain('function isRedmiK70StandardClient()');
    expect(auth).toContain('function resolveMineStatusMode()');
    const modeFn = auth.slice(
      auth.indexOf('function resolveMineStatusMode()'),
      auth.indexOf('function shouldApplyMineBlackStatus()')
    );
    expect(modeFn).toContain('isRedmiK70StandardClient()');
    expect(modeFn).toContain("if (isMineUnderlapPreviewBlob(clientUaBlob()))");
    expect(modeFn).toContain('isRedmiK70UltraClient() || isRedmiK70StandardClient()');
    const start = auth.indexOf('function applyImmersiveBlueStatusBar');
    const end = auth.indexOf('function applyMinePageChrome');
    const fn = auth.slice(start, end);
    expect(fn).toContain('isRedmiK70StandardClient()');
    expect(fn).toContain("color: '#000000'");
    expect(fn).toContain('overlays: false');
    expect(fn).toContain('reapplyK70Light');
    expect(auth).toContain(
      'html.app-android-redmi-k70.app-android-client.app-top-safe-shell:not(.app-android-redmi-k70-ultra) body.page-mine::before{display:none'
    );
    expect(auth).toContain(
      'html.app-android-redmi-k70.app-top-safe-shell:not(.app-android-redmi-k70-ultra):has(body.page-shuiming)::before'
    );
    expect(auth).toContain('var redmiK70StdClient');
  });

  it('白顶页与首页首屏打上标准版 class，且不走沉浸白顶', () => {
    [shuiming, shuimingResult, shouye].forEach((html) => {
      expect(html).toContain("classList.add('app-android-redmi-k70')");
      expect(html).toContain("classList.remove('app-android-immersive-white-top')");
    });
  });

  it('auth-boot 对 K70 标准版不再返回 underlap-black', () => {
    expect(boot).toContain('function resolveMineStatusMode()');
    const modeFn = boot.slice(
      boot.indexOf('function resolveMineStatusMode()'),
      boot.indexOf('function getToken()')
    );
    expect(modeFn).toContain('isRedmiK70StandardModelBlob(ua)');
    expect(modeFn).toContain("return '';");
    expect(boot).toContain("resolveMineStatusMode() === 'underlap-black'");
    expect(boot).toContain(':not(.app-mine-black-status):not(.app-android-redmi-k70)');
  });
});
