import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const login = readFileSync(resolve(__dirname, '../../login.html'), 'utf8');

describe('iPhone 16 Pro Max on iOS 26 login chrome', () => {
  it('does not classify 16 Pro Max as 17 Pro Max via iOS 26 + 440×956', () => {
    expect(auth).not.toMatch(
      /return getIOSMajorVersion\(\) >= 26 && isIPhone440x956Viewport\(\)/
    );
    expect(auth).toContain('MYTN3');
    expect(auth).toMatch(/function isIPhone16ProMaxClient\(\)/);
    expect(auth).toMatch(/function isIPhone17ProMaxClient\(\)/);
  });

  it('does not steal 16 Pro via iOS 26 + 402×874 heuristic', () => {
    expect(auth).not.toMatch(
      /getIOSMajorVersion\(\) >= 26 && \(isIPhone393x852Viewport\(\) \|\| isIPhone402x874Viewport\(\)\)/
    );
  });

  it('keeps standalone login page background white (only status strip blue)', () => {
    expect(auth).toMatch(/html\.app-ios-standalone-entry\{background:#ffffff/);
    expect(auth).toContain('body.page-login{background:#ffffff');
    expect(auth).toContain('iphone17promax.app-top-safe-shell');
  });

  it('login.html first-paints 16 Pro Max class', () => {
    expect(login).toContain('app-ios-iphone16promax');
    expect(login).toContain('20260902-ip16pm-login');
  });
});
