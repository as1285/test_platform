import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const login = readFileSync(resolve(__dirname, '../../login.html'), 'utf8');

describe('login 对齐官方头像 / 其他登录划线 / 数字身份', () => {
  it('头像含柔光外晕与双色人像', () => {
    expect(login).toContain('loginAvatarGlow');
    expect(login).toContain('loginAvatarPerson');
    expect(login).toContain('官方柔光外晕');
    expect(login).not.toContain('fill="#cfe6fb"');
  });

  it('其他登录方式用短划线而非通栏长线', () => {
    expect(login).toContain('官方是短横，不是通栏长线');
    expect(login).toContain('flex: 0 0 22px');
    expect(login).not.toMatch(
      /\.other-login-divider::before,\s*\.other-login-divider::after\s*\{[^}]*flex:\s*1/
    );
  });

  it('数字身份为红色圆标双行文字', () => {
    expect(login).toContain('background: #e03a2f');
    expect(login).toContain('<b>数字</b><b>身份</b>');
  });
});
