import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /SHARK[\s_-]*PRS-A0|\bPRS-A0\b/i;
const NAME_RE = /(?:Black\s*Shark|BlackShark|黑鲨)[\s_-]*4S\b/i;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const pages = {
  shouye: readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8'),
  daiban: readFileSync(resolve(__dirname, '../../daiban.html'), 'utf8'),
  bancha: readFileSync(resolve(__dirname, '../../bancha.html'), 'utf8'),
  message: readFileSync(resolve(__dirname, '../../message.html'), 'utf8'),
  mine: readFileSync(resolve(__dirname, '../../mine.html'), 'utf8'),
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8')
};

describe('黑鲨 4S 白顶栏顶部黑框', () => {
  it('matches SHARK PRS-A0 and 黑鲨4S, not 4 / 5', () => {
    ['SHARK PRS-A0', 'PRS-A0', 'Black Shark 4S', '黑鲨4S'].forEach((id) => {
      expect(MODEL_RE.test(id) || NAME_RE.test(id), id).toBe(true);
    });
    expect(NAME_RE.test('黑鲨4')).toBe(false);
    expect(NAME_RE.test('Black Shark 5')).toBe(false);
    expect(MODEL_RE.test('SHARK KSR-A0')).toBe(false);
    expect(MODEL_RE.test('SHARK PAR-A0')).toBe(false);
  });

  it('paints a 40px black status bar on every page, including the blue home', () => {
    expect(auth).toContain('function isBlackShark4SClient()');
    expect(auth).toContain('app-android-blackshark-4s');
    expect(auth).toMatch(
      /html\.app-android-blackshark-4s\.app-top-safe-shell::before\{[^}]*background:#000/
    );
    expect(auth).toContain('html.app-android-blackshark-4s{color-scheme:dark !important;}');
    expect(auth).toContain(
      'html.app-android-blackshark-4s.app-android-client.app-top-safe-shell body.page-shouye::before{background-color:#000 !important;background-image:none !important;height:40px !important;z-index:180 !important;}'
    );
    expect(auth).not.toMatch(
      /html\.app-android-blackshark-4s[^\{]{0,160}z-index:2147483000/
    );
    const whiteFn = auth.slice(
      auth.indexOf('function applyImmersiveNotchWhitePageChrome'),
      auth.indexOf('function isInsideTabShellEmbed')
    );
    expect(whiteFn).toContain('isBlackShark4SClient()');
    expect(whiteFn).toContain("color: '#000000'");
    expect(whiteFn).toContain("style: 'light'");
    const blueFn = auth.slice(
      auth.indexOf('function applyImmersiveBlueStatusBar'),
      auth.indexOf('function applyMinePageChrome')
    );
    expect(blueFn).toContain('isBlackShark4SClient()');
    expect(blueFn).toContain("color: '#000000'");
    expect(blueFn).toContain('overlays: true');
  });

  it('first-paints home and the other tabs so the status bar is black before auth.js', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(html, name).toContain('SHARK[\\s_-]*PRS-A0');
      expect(html, name).toContain('app-android-blackshark-4s');
      expect(html, name).toMatch(/app-android-blackshark-4s[\s\S]{0,900}#000/);
    });
  });
});
