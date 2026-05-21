#!/usr/bin/env node
/**
 * Android 12+ 冷启动：全屏 launch_splash 作 windowBackground，透明占位图标，去掉居中小图。
 */
var fs = require('fs');
var path = require('path');

module.exports = function (ctx) {
  if (!ctx.opts.platforms || ctx.opts.platforms.indexOf('android') === -1) {
    return;
  }
  var themesPath = path.join(
    ctx.opts.projectRoot,
    'platforms',
    'android',
    'app',
    'src',
    'main',
    'res',
    'values',
    'themes.xml'
  );
  if (!fs.existsSync(themesPath)) {
    return;
  }
  var xml = fs.readFileSync(themesPath, 'utf8');

  // 移除 config.xml 误生成的无效节点
  xml = xml.replace(/\s*<Theme\.App\.SplashScreen>[\s\S]*?<\/Theme\.App\.SplashScreen>\s*/g, '\n');

  var styleRe = /(<style name="Theme\.App\.SplashScreen"[^>]*>)([\s\S]*?)(<\/style>)/;
  var m = xml.match(styleRe);
  if (!m) {
    return;
  }
  var inner = m[2];
  if (inner.indexOf('launch_splash') < 0) {
    inner +=
      '\n        <item name="android:windowBackground">@drawable/launch_splash</item>';
  }
  if (inner.indexOf('splash_icon_empty') < 0) {
    inner = inner.replace(
      /<item name="windowSplashScreenAnimatedIcon">[^<]*<\/item>/,
      '<item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon_empty</item>'
    );
    if (inner.indexOf('splash_icon_empty') < 0) {
      inner +=
        '\n        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon_empty</item>';
    }
  }
  xml = xml.replace(styleRe, m[1] + inner + m[3]);
  fs.writeFileSync(themesPath, xml, 'utf8');
};
