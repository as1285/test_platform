import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const helperPath = resolve(__dirname, '../../public/js/clipboard-copy.js');
const purchaseHtml = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');
const refundHtml = readFileSync(resolve(__dirname, '../../refund_ad.html'), 'utf8');
const douyinHtml = readFileSync(resolve(__dirname, '../../douyin_yuefu_ad.html'), 'utf8');
const authBoot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const cordovaIndex = readFileSync(resolve(__dirname, '../../../cordova-app/www/index.html'), 'utf8');

describe('clipboard-copy helper', () => {
  beforeEach(async () => {
    vi.resetModules();
    delete globalThis.copyTextRobust;
    delete globalThis.copyTextToClipboard;
    delete globalThis.__clipboardCopy;
    delete globalThis.navigator;
    delete globalThis.cordova;
    delete globalThis.parent;
    globalThis.navigator = { userAgent: 'Mozilla/5.0' };
    globalThis.parent = globalThis;
    globalThis.document = {
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      },
      createElement: vi.fn(function (tag) {
        return {
          value: '',
          textContent: '',
          contentEditable: 'false',
          style: { cssText: '' },
          focus: vi.fn(),
          select: vi.fn(),
          setSelectionRange: vi.fn(),
          setAttribute: vi.fn(),
          parentNode: { removeChild: vi.fn() }
        };
      }),
      createRange: vi.fn(function () {
        return { selectNodeContents: vi.fn() };
      }),
      execCommand: vi.fn(function () {
        return true;
      })
    };
    globalThis.getSelection = vi.fn(function () {
      return { removeAllRanges: vi.fn(), addRange: vi.fn() };
    });
    await import(pathToFileURL(helperPath).href + '?t=' + Date.now());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports copyTextRobust that rejects empty text', async () => {
    await expect(globalThis.copyTextRobust('')).rejects.toThrow(/empty/);
  });

  it('falls back to execCommand when Clipboard API rejects', async () => {
    globalThis.navigator.clipboard = {
      writeText: vi.fn(function () {
        return Promise.reject(new Error('NotAllowedError'));
      })
    };
    await expect(globalThis.copyTextRobust('Tangdong6832')).resolves.toBeUndefined();
    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith('Tangdong6832');
    expect(globalThis.document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('uses Cordova plugin when Clipboard API and execCommand fail', async () => {
    globalThis.navigator.clipboard = {
      writeText: vi.fn(function () {
        return Promise.reject(new Error('denied'));
      })
    };
    globalThis.document.execCommand = vi.fn(function () {
      return false;
    });
    globalThis.cordova = {
      plugins: {
        clipboard: {
          copy: vi.fn(function (_text, ok) {
            ok();
          })
        }
      }
    };
    await expect(globalThis.copyTextRobust('Tangdong6832')).resolves.toBeUndefined();
    expect(globalThis.cordova.plugins.clipboard.copy).toHaveBeenCalled();
    delete globalThis.cordova;
  });

  it('uses App shell postMessage bridge when in Cordova iframe', async () => {
    globalThis.navigator.userAgent = 'TaxPlatformCordovaApp/1 Android';
    globalThis.navigator.clipboard = {
      writeText: vi.fn(function () {
        return Promise.reject(new Error('denied'));
      })
    };
    globalThis.document.execCommand = vi.fn(function () {
      return false;
    });
    const listeners = [];
    globalThis.addEventListener = vi.fn(function (type, fn) {
      if (type === 'message') listeners.push(fn);
    });
    globalThis.removeEventListener = vi.fn();
    globalThis.parent = {
      postMessage: vi.fn(function (payload) {
        expect(payload.type).toBe('clipboard-copy');
        expect(payload.text).toBe('Tangdong6832');
        setTimeout(function () {
          listeners.forEach(function (fn) {
            fn({
              data: {
                source: 'tax-shell',
                type: 'clipboard-copy-result',
                id: payload.id,
                ok: true
              }
            });
          });
        }, 0);
      })
    };
    Object.defineProperty(globalThis.parent, 'location', {
      get: function () {
        throw new Error('cross-origin');
      }
    });
    await expect(globalThis.copyTextRobust('Tangdong6832')).resolves.toBeUndefined();
    expect(globalThis.parent.postMessage).toHaveBeenCalled();
  });

  it('rejects only when all methods fail', async () => {
    globalThis.navigator.clipboard = {
      writeText: vi.fn(function () {
        return Promise.reject(new Error('denied'));
      })
    };
    globalThis.document.execCommand = vi.fn(function () {
      return false;
    });
    await expect(globalThis.copyTextRobust('Tangdong6832')).rejects.toThrow();
  });
});

describe('wechat copy pages wire shared helper', () => {
  it('purchase / refund_ad / douyin load clipboard-copy and keep selectable wechat id', () => {
    expect(purchaseHtml).toContain('/js/clipboard-copy.js');
    expect(purchaseHtml).toContain('copyTextRobust');
    expect(purchaseHtml).toContain('user-select: all');
    expect(purchaseHtml).toContain('btnCopyGjjWechat');

    expect(refundHtml).toContain('/js/clipboard-copy.js');
    expect(refundHtml).toContain('copyTextRobust');
    expect(refundHtml).toContain('user-select: all');
    expect(refundHtml).toContain('btnCopyGjjWechat');
    expect(refundHtml).toContain('填完了');
    expect(refundHtml).toContain('一键复制微信并备注');

    expect(douyinHtml).toContain('/js/clipboard-copy.js');
    expect(douyinHtml).toContain('copyTextRobust');
    expect(douyinHtml).toContain('user-select: all');
  });

  it('auth-boot injects clipboard-copy site-wide', () => {
    expect(authBoot).toContain('clipboard-copy.js');
    expect(authBoot).toContain('document.write');
  });

  it('Cordova shell allows clipboard and bridges copy postMessage', () => {
    expect(cordovaIndex).toContain('clipboard-write');
    expect(cordovaIndex).toContain('clipboard-copy');
    expect(cordovaIndex).toContain('copyTextInShell');
    expect(cordovaIndex).toContain('clipboard-copy-result');
  });

  it('does not treat Clipboard API presence as success without fallback', () => {
    expect(purchaseHtml).not.toMatch(
      /if \(navigator\.clipboard && typeof navigator\.clipboard\.writeText === 'function'\) \{\s*return navigator\.clipboard\.writeText/
    );
    expect(refundHtml).not.toMatch(
      /if \(navigator\.clipboard && typeof navigator\.clipboard\.writeText === 'function'\) \{\s*return navigator\.clipboard\.writeText/
    );
  });
});
