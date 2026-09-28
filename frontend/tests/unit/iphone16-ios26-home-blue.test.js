import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');

describe('iPhone 16 / iOS 26 首页顶蓝', () => {
  it('iOS 26 的 393×852 打上首页收紧标记', () => {
    expect(auth).toContain("classList.add('app-ios26-island-home')");
    expect(auth).toContain('getIOSMajorVersion() === 26 && isIPhone393x852Viewport()');
    expect(shouye).toContain("classList.add('app-ios26-island-home')");
  });

  it('首页搜索不再叠 59px，并裁掉 ahead 自带蓝边', () => {
    expect(auth).toContain(
      'html.app-ios26-island-home.app-ios-client.app-top-safe-shell body.page-shouye .search-bar-wrapper{padding-top:0 !important;}'
    );
    expect(auth).toContain(
      'html.app-ios26-island-home body.page-shouye .sy-apk-ahead{margin-top:-14px !important;}'
    );
    expect(shouye).toContain('html.app-ios26-island-home.app-ios-liquid-glass.app-ios-client.app-top-safe-shell body.page-shouye .search-bar-wrapper');
    expect(shouye).toContain('padding-top: 0 !important;');
    expect(shouye).toContain('margin-top: -14px !important;');
  });
});
