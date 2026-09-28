import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const config = readFileSync(resolve(__dirname, '../../../cordova-app/config.xml'), 'utf8');
const shell = readFileSync(resolve(__dirname, '../../../cordova-app/www/index.html'), 'utf8');
const hookPath = resolve(
  __dirname,
  '../../../cordova-app/hooks/after_prepare/30-ios-liquid-glass-compat.js'
);
const hook = require(hookPath);

describe('Cordova iOS Liquid Glass 彻底退出', () => {
  it('config.xml 写入 UIDesignRequiresCompatibility 并挂 after_prepare hook', () => {
    expect(config).toContain('UIDesignRequiresCompatibility');
    expect(config).toContain('hooks/after_prepare/30-ios-liquid-glass-compat.js');
    expect(config).toMatch(
      /<config-file target="\*-Info\.plist" parent="UIDesignRequiresCompatibility">[\s\S]*?<true \/>/
    );
  });

  it('hook 给 MainViewController 关掉 iOS 26 顶部边缘模糊', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ios-edge-'));
    const file = join(dir, 'MainViewController.m');
    writeFileSync(
      file,
      '@implementation MainViewController\n- (void)viewDidLoad {\n    [super viewDidLoad];\n}\n@end\n'
    );
    expect(hook.patchViewController(file)).toBe(true);
    const once = readFileSync(file, 'utf8');
    expect(once).toContain('taxHideIos26ScrollEdgeEffect');
    expect(once).toContain('topEdgeEffect');
    expect(once).toContain('setValue:@YES forKey:@"hidden"');
    expect(hook.patchViewController(file)).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe(once);
    rmSync(dir, { recursive: true, force: true });
  });

  it('hook 给 CDVWebViewEngine 在 updateSettings 里关 topEdgeEffect', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ios-engine-'));
    const file = join(dir, 'CDVWebViewEngine.m');
    writeFileSync(
      file,
      '@implementation CDVWebViewEngine\n- (void)updateSettings:(id)settings\n{\n    WKWebView* wkWebView = (WKWebView*)_engineWebView;\n    wkWebView.allowsLinkPreview = YES;\n}\n@end\n'
    );
    expect(hook.patchWebViewEngine(file)).toBe(true);
    const once = readFileSync(file, 'utf8');
    expect(once).toContain('topEdgeEffect');
    expect(once).toContain('setValue:@YES forKey:@"hidden"');
    expect(hook.patchWebViewEngine(file)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('hook 给 Info.plist 补兼容开关，已有则不重复', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ios-glass-'));
    const file = join(dir, 'Info.plist');
    writeFileSync(
      file,
      '<?xml version="1.0"?>\n<plist><dict>\n    <key>CFBundleName</key>\n    <string>个人所得税</string>\n</dict>\n</plist>\n'
    );
    expect(hook.patchPlist(file)).toBe(true);
    const once = readFileSync(file, 'utf8');
    expect(once).toContain('<key>UIDesignRequiresCompatibility</key>');
    expect(once).toContain('<true/>');
    expect(hook.patchPlist(file)).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe(once);
    rmSync(dir, { recursive: true, force: true });
  });

  it('壳层排队 status-bar，不再在 StatusBar 未就绪时丢消息', () => {
    expect(shell).toContain('var pendingStatusBar = null');
    expect(shell).toContain('function applyStatusBarFromH5');
    expect(shell).toContain('function paintParentStatusPlate');
    expect(shell).toContain('id="iosStatusPlate"');
    expect(shell).toContain('#iosStatusPlate');
    expect(shell).toContain('applyStatusBarFromH5(d)');
    expect(shell).not.toMatch(
      /if \(!d \|\| d\.source !== 'tax-h5' \|\| d\.type !== 'status-bar'\) \{\s*return;\s*\}\s*if \(!window\.StatusBar\) \{\s*return;/
    );
  });

  it('白顶页父文档铺实底白垫，透明色强制改 #ffffff', () => {
    expect(shell).toContain("plate.style.background = '#ffffff'");
    expect(shell).toContain("barColor = '#ffffff'");
    expect(shell).toContain("style === 'default' || d.style === 'dark'");
  });

  it('UI 冒烟只验 H5 实底，并写明测不到系统毛玻璃', () => {
    const smoke = readFileSync(
      resolve(__dirname, '../e2e/ui-smoke-browser.mjs'),
      'utf8'
    );
    expect(smoke).toContain('async function assertIosWhiteTopOpaque');
    expect(smoke).toContain('Chromium cannot see iOS Liquid Glass');
    expect(smoke).toContain('await assertIosWhiteTopOpaque(page, profile, tag)');
    expect(smoke).toContain('webclipStandalone');
    expect(smoke).toContain('iosWebClipOuter');
  });
});
