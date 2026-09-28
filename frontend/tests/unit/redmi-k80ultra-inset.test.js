import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /25060RK16C/i;
const NAME_RE = /(?:Redmi|Xiaomi|REDMI)[\s_-]*K80[\s_-]*(?:至尊|Ultra)/i;
const PRO_RE = /24122RKC7[CG]|24127RK2CC|(?:Redmi|Xiaomi|REDMI)[\s_-]*K80[\s_-]*Pro/i;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

describe('Redmi K80 Ultra status-bar inset', () => {
  it('matches 25060RK16C and Ultra marketing name, not K80 Pro', () => {
    expect(MODEL_RE.test('25060RK16C')).toBe(true);
    expect(NAME_RE.test('REDMI K80 Ultra')).toBe(true);
    expect(NAME_RE.test('Redmi K80 至尊')).toBe(true);
    expect(NAME_RE.test('REDMI K80 Pro')).toBe(false);
    expect(NAME_RE.test('Redmi K80')).toBe(false);
    expect(PRO_RE.test('25060RK16C')).toBe(false);
    expect(PRO_RE.test('REDMI K80 Ultra')).toBe(false);
  });

  it('reads Cordova model blob and stays on immersive 40px', () => {
    expect(auth).toContain('function isAndroid25060RK16CClient()');
    expect(auth).toMatch(/isAndroid25060RK16CClient\(\)[\s\S]*clientUaBlob\(\)/);
    expect(auth).toMatch(/isXiaomiImmersiveTopClient\(\)[\s\S]*isAndroid25060RK16CClient\(\)/);
    expect(auth).toContain('app-android-redmi-k80ultra');
    expect(auth).toContain('app-android-25060rk16c');
    expect(auth).toMatch(
      /html\.app-android-redmi-k80ultra\.app-top-safe-shell[\s\S]{0,120}--app-shell-statusbar-top:40px/
    );
  });
});
