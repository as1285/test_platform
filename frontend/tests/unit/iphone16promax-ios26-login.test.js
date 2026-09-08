import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const login = readFileSync(resolve(__dirname, '../../login.html'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iPhone 16 Pro Max on iOS 26 login chrome', () => {
  it('does not classify 16 Pro Max as 17 Pro Max via iOS 26 + 440×956', () => {
    expect(auth).not.toMatch(
      /return getIOSMajorVersion\(\) >= 26 && isIPhone440x956Viewport\(\)/
    );
    expect(auth).toContain('MYTN3');
    expect(auth).toMatch(/function isIPhone16ProMaxClient\(\)/);
    expect(auth).toMatch(/function isIPhone17ProMaxClient\(\)/);
    expect(auth).toContain('function isIPhoneLargePromaxWidthViewport');
    expect(auth).toContain('function markIosPromaxWideLayout');
    expect(auth).toContain('function injectIosLargeViewportWidthCss');
    expect(auth).toContain('app-ios-promax-wide');
    expect(auth).toContain('@media screen and (min-width:414px)');
  });

  it('does not steal 16 Pro via iOS 26 + 402×874 heuristic', () => {
    expect(auth).not.toMatch(
      /getIOSMajorVersion\(\) >= 26 && \(isIPhone393x852Viewport\(\) \|\| isIPhone402x874Viewport\(\)\)/
    );
  });

  it('keeps standalone login page background white (only status strip blue)', () => {
    expect(auth).toMatch(/html\.app-ios-standalone-entry\{background:#ffffff/);
    expect(auth).toContain('html.app-ios-standalone-entry body.page-login,');
    expect(auth).toContain(
      'html.app-ios-standalone-entry body.page-face-login{background:#ffffff'
    );
    expect(auth).toContain('iphone17promax.app-top-safe-shell');
  });

  it('login.html first-paints 16 Pro Max class', () => {
    expect(login).toContain('app-ios-iphone16promax');
    expect(login).toContain('20260902-ip16pm-login');
  });

  it('shuiming_result first-paints 16 Pro Max and narrows wide layout', () => {
    expect(shuimingResult).toContain('MYTN3');
    expect(shuimingResult).toContain('app-ios-iphone16promax');
    expect(shuimingResult).toContain('app-ios-promax-wide');
    expect(shuimingResult).toContain('tax_ios_promax_wide_v1');
    expect(shuimingResult).toContain('auth.js?v=20260908-home-blue-bar');
    expect(shuimingResult).toContain('tax_device_model_v1');
    expect(shuimingResult).toMatch(/short16 >= 428/);
    expect(shuimingResult).toContain('@media screen and (min-width: 414px)');
    expect(shuimingResult).toContain('@media screen and (min-width: 428px)');
    expect(shuimingResult).toMatch(
      /html\.app-ios-promax-wide body\.page-shuiming-result \.list[^}]*padding-left:\s*0/
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-promax-wide\.platform-ios body\.page-shuiming-result \.list-company-name\s*\{[^}]*max-width:\s*20em/
    );
  });
});
