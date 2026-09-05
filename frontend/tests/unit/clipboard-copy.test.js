import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const helperPath = resolve(__dirname, '../../public/js/clipboard-copy.js');
const purchaseHtml = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');
const refundHtml = readFileSync(resolve(__dirname, '../../refund_ad.html'), 'utf8');
const douyinHtml = readFileSync(resolve(__dirname, '../../douyin_yuefu_ad.html'), 'utf8');

describe('clipboard-copy helper', () => {
  beforeEach(async () => {
    vi.resetModules();
    delete globalThis.copyTextRobust;
    delete globalThis.copyTextToClipboard;
    delete globalThis.__clipboardCopy;
    delete globalThis.navigator;
    globalThis.navigator = {};
    globalThis.document = {
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      },
      createElement: vi.fn(function () {
        return {
          value: '',
          style: { cssText: '' },
          focus: vi.fn(),
          select: vi.fn(),
          setSelectionRange: vi.fn(),
          setAttribute: vi.fn()
        };
      }),
      execCommand: vi.fn(function () {
        return true;
      })
    };
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
    expect(purchaseHtml).toContain('公积金提取咨询');

    expect(refundHtml).toContain('/js/clipboard-copy.js');
    expect(refundHtml).toContain('copyTextRobust');
    expect(refundHtml).toContain('user-select: all');
    expect(refundHtml).toContain('btnCopyGjjWechat');

    expect(douyinHtml).toContain('/js/clipboard-copy.js');
    expect(douyinHtml).toContain('copyTextRobust');
    expect(douyinHtml).toContain('user-select: all');
  });

  it('does not treat Clipboard API presence as success without fallback', () => {
    /* 旧逻辑：存在 writeText 就直接 return，reject 时不会走 execCommand */
    expect(purchaseHtml).not.toMatch(
      /if \(navigator\.clipboard && typeof navigator\.clipboard\.writeText === 'function'\) \{\s*return navigator\.clipboard\.writeText/
    );
    expect(refundHtml).not.toMatch(
      /if \(navigator\.clipboard && typeof navigator\.clipboard\.writeText === 'function'\) \{\s*return navigator\.clipboard\.writeText/
    );
  });
});
