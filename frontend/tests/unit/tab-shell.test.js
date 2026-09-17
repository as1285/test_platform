import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const tabShell = readFileSync(resolve(__dirname, '../../public/js/tab-shell.js'), 'utf8');
const tabShellEscape = readFileSync(resolve(__dirname, '../../public/js/tab-shell-escape.js'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const authBoot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const nav = readFileSync(resolve(__dirname, '../../public/js/app/nav.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const loginHtml = readFileSync(resolve(__dirname, '../../login.html'), 'utf8');
const mineHtml = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');

describe('tab shell (bottom nav cache)', () => {
  it('tab-shell.js intercepts tab navigation via iframe cache', () => {
    expect(tabShell).toContain('tab_embed=1');
    expect(tabShell).toContain('tab-shell-native');
    expect(tabShell).toContain('tab-shell-iframe');
    expect(tabShell).toContain('preventDefault');
    expect(tabShell).toContain('TaxAppTabShell');
    expect(tabShell).toContain('warmOtherTabs');
    expect(tabShell).toContain('isAndroidLike');
    expect(tabShell).toContain('baseDelay');
    expect(tabShell).toContain('android ? 6500 : 600');
    expect(tabShell).toContain('android ? 1800 : 500');
    expect(tabShell).toContain('isAndroidLike() ? 5500 : 1200');
  });

  it('tab-shell hides bottom nav on tax sub-pages in iframe', () => {
    expect(tabShell).toContain('data-tab-shell-subpage');
    expect(tabShell).toContain('shuiming_result.html');
    expect(tabShell).toContain('tab-shell-subpage');
  });

  it('tab-shell-escape.js breaks out of tab iframe for tax detail pages', () => {
    expect(tabShellEscape).toContain('tab-shell-iframe');
    expect(tabShellEscape).toContain('shuiming_result');
    expect(tabShellEscape).toContain('top.location.replace');
    expect(tabShellEscape).toContain('purchase');
  });

  it('login/register escape the tab iframe and assign top-level location', () => {
    expect(tabShellEscape).toContain('login');
    expect(tabShellEscape).toContain('register');
    expect(tabShellEscape).toContain('face_login');
    expect(tabShellEscape).toContain('assignTopLocation');
    expect(tabShell).toContain('promoteIframeIfLeftAssignedTab');
    expect(tabShell).toContain("file === 'login.html'");
    expect(tabShell).toContain("file === 'purchase.html'");
    expect(loginHtml).toContain('tab-shell-escape.js?v=20260906-login-top');
    expect(loginHtml).toContain('assignTopLocation');
    expect(mineHtml).toContain('login.html?next=mine.html');
    expect(mineHtml).toContain('target="_top"');
  });

  it('shuiming_result.html loads tab-shell-escape and hides bottom nav', () => {
    expect(shuimingResult).toContain('tab-shell-escape.js');
    expect(shuimingResult).toContain('page-shuiming-result .bottom-nav');
  });

  it('auth.js injects tab-shell on primary tab pages', () => {
    expect(auth).toContain('injectTabShell');
    expect(auth).toContain('/js/tab-shell.js');
    expect(auth).toContain("get('tab_embed') === '1'");
  });

  it('auth-boot hides bottom nav in embed mode', () => {
    expect(authBoot).toContain('tab-embed-mode');
    expect(authBoot).toContain('tab_embed');
    expect(authBoot).toContain('tab-shell-iframe');
    expect(authBoot).toContain('stripEmbedBottomNav');
    expect(authBoot).toContain('parentIsTabShellHost');
    expect(authBoot).toContain('app-ios-iphone16pro');
    expect(authBoot).toContain('MutationObserver');
  });

  it('auth.js skips pin/inject when inside tab-shell iframe', () => {
    expect(auth).toContain('tab-shell-iframe');
    expect(auth).toContain('tab-embed-mode');
    expect(auth).toContain('isInsideTabShellEmbed');
    expect(auth).toContain('stripTabEmbedBottomNavNodes');
  });

  it('14 Pro Max 切 Tab 舞台跟头图蓝，不铺白顶', () => {
    expect(tabShell).toContain('paint14pmStage');
    expect(tabShell).toContain("mine: '#1677ff'");
    expect(tabShell).toContain(
      'html.app-ios-iphone14promax[data-tab-shell="1"] #tab-shell-stage.tab-shell-stage-active{background:#1677ff}'
    );
    expect(auth).toContain('tab-shell.js?v=20260916-android-warm');
  });

  it('tab-shell host scrubs iframe bottom nav (iOS frameElement null)', () => {
    expect(tabShell).toContain('scrubIframeBottomNav');
    expect(tabShell).toContain('scrubAllIframeBottomNavs');
    expect(tabShell).toContain('data-tab-embed-host-scrub');
    expect(tabShell).toContain('app-ios-iphone16pro');
  });

  it('nav.js supports hydrateBottomNavByKey for shell', () => {
    expect(nav).toContain('hydrateBottomNavByKey');
  });
});
