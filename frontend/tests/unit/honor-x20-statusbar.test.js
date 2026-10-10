import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');

describe('荣耀 X20 顶部系统栏', () => {
  it('只认 NTN-AN20 / 荣耀 X20，排除 SE 与 Plus', () => {
    expect(auth).toContain('function isHonorX20Client()');
    expect(auth).toContain('NTN-AN20');
    expect(auth).toContain('X20[\\s_-]*(?:SE|Plus|Pro)');
    expect(shouye).toContain('NTN-AN20');
    expect(shouye).toContain('honorX20BlackBarFirstPaint');
  });

  it('系统栏回退 7/20 灰根，保留 32px 顶距，不再铺黑垫', () => {
    expect(auth).toContain('app-android-honor-x20');
    expect(auth).toContain('function applyAndroidJuly20SystemBar');
    expect(auth).toContain('ANDROID_JULY20_STATUS_BG');
    expect(auth).not.toContain('height:32px !important;background:#000 !important');
    expect(auth).not.toContain(
      'body.page-shouye::before{height:32px !important;background-color:#000 !important;background-image:none !important;}'
    );
    expect(auth).not.toContain('honor-x20-clock');
    expect(shouye).toContain('auth.js?v=20261010-smoke-hoist-k70');
  });
});
