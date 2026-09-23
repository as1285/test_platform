import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');

describe('荣耀 X20 顶部黑状态栏', () => {
  it('只认 NTN-AN20 / 荣耀 X20，排除 SE 与 Plus', () => {
    expect(auth).toContain('function isHonorX20Client()');
    expect(auth).toContain('NTN-AN20');
    expect(auth).toContain('X20[\\s_-]*(?:SE|Plus|Pro)');
    expect(shouye).toContain('NTN-AN20');
    expect(shouye).toContain('honorX20BlackBarFirstPaint');
  });

  it('系统栏黑底白字，页内 32px 黑垫，不画时间电量', () => {
    expect(auth).toContain('app-android-honor-x20');
    expect(auth).toContain("color: '#000000'");
    expect(auth).toContain('overlays: true');
    expect(auth).toContain('height:32px !important;background:#000 !important');
    expect(auth).toContain('body.page-shouye::before{height:32px !important;background-color:#000 !important;background-image:none !important;}');
    expect(auth).not.toContain('honor-x20-clock');
    expect(shouye).toContain('auth.js?v=20260923-honor-x20');
  });
});
