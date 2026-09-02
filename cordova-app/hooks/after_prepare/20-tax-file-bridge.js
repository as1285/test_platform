#!/usr/bin/env node
/**
 * 把离职/在职证明本地下载桥接到 Android WebView（DownloadListener + TaxNativeSave）。
 */
var fs = require('fs');
var path = require('path');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function ensureMainActivityHook(mainPath) {
  if (!fs.existsSync(mainPath)) return;
  var src = fs.readFileSync(mainPath, 'utf8');
  if (src.indexOf('attachTaxFileHelpers') >= 0) return;
  if (src.indexOf('loadUrl(launchUrl);') < 0) return;
  src = src.replace(
    'loadUrl(launchUrl);',
    'loadUrl(launchUrl);\n        attachTaxFileHelpers();'
  );
  var helper =
    '\n    private void attachTaxFileHelpers() {\n' +
    '        if (appView == null) return;\n' +
    '        android.view.View v = appView.getView();\n' +
    '        if (!(v instanceof android.webkit.WebView)) return;\n' +
    '        final android.webkit.WebView wv = (android.webkit.WebView) v;\n' +
    '        wv.addJavascriptInterface(new TaxFileBridge(this), "TaxNativeSave");\n' +
    '        wv.setDownloadListener(new android.webkit.DownloadListener() {\n' +
    '            @Override\n' +
    '            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {\n' +
    '                TaxFileBridge.enqueueDownload(MainActivity.this, url, userAgent, contentDisposition, mimeType);\n' +
    '            }\n' +
    '        });\n' +
    '    }\n';
  src = src.replace(/\n}\s*$/, helper + '}\n');
  fs.writeFileSync(mainPath, src, 'utf8');
}

module.exports = function (ctx) {
  if (!ctx.opts.platforms || ctx.opts.platforms.indexOf('android') === -1) {
    return;
  }
  var root = ctx.opts.projectRoot;
  var srcJava = path.join(root, 'native', 'android', 'TaxFileBridge.java');
  var destJava = path.join(
    root,
    'platforms',
    'android',
    'app',
    'src',
    'main',
    'java',
    'com',
    'testplatform',
    'app',
    'TaxFileBridge.java'
  );
  if (fs.existsSync(srcJava)) {
    copyFile(srcJava, destJava);
  }
  ensureMainActivityHook(
    path.join(
      root,
      'platforms',
      'android',
      'app',
      'src',
      'main',
      'java',
      'com',
      'testplatform',
      'app',
      'MainActivity.java'
    )
  );
};
