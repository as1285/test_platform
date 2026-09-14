import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

describe('Mate 60 Pro homepage top inset', () => {
  it('first-paint CSS tightens Mate 60 search bar inset', () => {
    expect(shouye).toContain('app-android-huawei-mate60');
    expect(shouye).toContain('--shouye-status-inset: 12px');
    expect(shouye).toContain('html.app-android-huawei-mate60.app-top-safe-shell body.page-shouye .search-bar-wrapper');
    expect(shouye).toContain('padding-top: 12px !important');
    expect(shouye).toContain('html.app-android-huawei-mate60.app-top-safe-shell body.page-shouye .sy-apk-ahead');
    expect(shouye).toContain('margin-top: -8px !important');
    expect(shouye).toMatch(/auth\.js\?v=20260914-a93s-mine/);
  });

  it('auth.js overrides the Android 40px home inset on Mate 60', () => {
    expect(auth).toContain('html.app-android-huawei-mate60.app-top-safe-shell body.page-shouye{');
    expect(auth).toContain('--shouye-status-inset:12px !important');
    expect(auth).toContain('body.page-shouye .search-bar-wrapper{padding-top:12px !important;}');
    expect(auth).toContain('.sy-apk-ahead{margin-top:-8px !important;}');
    const generic = auth.lastIndexOf(
      'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye{--shouye-status-inset:40px'
    );
    const mate60 = auth.lastIndexOf('--shouye-status-inset:12px !important');
    expect(generic).toBeGreaterThan(-1);
    expect(mate60).toBeGreaterThan(generic);
  });
});
