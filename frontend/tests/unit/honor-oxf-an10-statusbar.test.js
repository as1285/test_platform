import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const login = readFileSync(resolve(__dirname, '../../login.html'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');

describe('荣耀 V30 Pro（OXF-AN10）顶部系统栏', () => {
  it('识别 OXF-AN10，且不把 HUAWEI 字样当成鸿蒙外置栏', () => {
    expect(auth).toContain('function isHonorV30ProClient()');
    expect(auth).toContain('OXF-AN10|HUAWEIOXF-AN10|HONOROXF-AN10');
    expect(auth).toContain('if (isHonorV30ProClient()) return false;');
    expect(auth).toContain('if (isHonorV30ProClient()) {\n      return false;');
  });

  it('登录顶栏按沉浸式留 40px，不用外置栏的 15px', () => {
    expect(auth).toContain("classList.add('app-android-honor-oxf')");
    expect(auth).toContain("classList.add('app-android-immersive-white-top')");
    expect(auth).toContain("setProperty('--app-shell-statusbar-top', '40px')");
    expect(auth).toContain(
      'html.app-android-honor-oxf.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}'
    );
    expect(auth).toContain(
      'html.app-android-honor-oxf.app-android-client.app-top-safe-shell.app-android-immersive-white-top body.page-login .header{min-height:auto !important;padding-top:55px !important;}'
    );
    expect(auth).toContain(':not(.app-android-honor-oxf)');
    expect(login).toContain('app-android-honor-oxf');
    expect(login).toContain('padding-top: 55px !important;');
    expect(login).toContain('auth.js?v=20261010-smoke-hoist-k70');
    expect(shouye).toContain('OXF-AN10');
    expect(shouye).toContain('app-android-honor-oxf');
  });
});
