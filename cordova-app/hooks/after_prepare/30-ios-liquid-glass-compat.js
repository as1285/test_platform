#!/usr/bin/env node
/**
 * iOS 26 Liquid Glass：给 Info.plist 写入 UIDesignRequiresCompatibility。
 * Apple 文档：用 iOS 27 SDK 构建时系统会忽略此键，iOS 27 无法靠 plist 关毛玻璃。
 * H5 / StatusBar.overlaysWebView 盖不住系统材质；iOS 27 必须在页内处理顶栏。
 */
var fs = require('fs');
var path = require('path');

function patchPlist(file) {
  var xml = fs.readFileSync(file, 'utf8');
  if (xml.indexOf('UIDesignRequiresCompatibility') >= 0) {
    return false;
  }
  if (xml.indexOf('</plist>') < 0) {
    return false;
  }
  var next = xml.replace(
    /<\/dict>\s*<\/plist>/,
    '    <key>UIDesignRequiresCompatibility</key>\n    <true/>\n</dict>\n</plist>'
  );
  if (next === xml) {
    return false;
  }
  fs.writeFileSync(file, next, 'utf8');
  return true;
}

function walk(dir, files) {
  if (!fs.existsSync(dir)) {
    return;
  }
  fs.readdirSync(dir).forEach(function (name) {
    if (name === 'Pods' || name === 'build' || name === 'CordovaLib') {
      return;
    }
    var p = path.join(dir, name);
    var st = fs.statSync(p);
    if (st.isDirectory()) {
      walk(p, files);
      return;
    }
    if (/Info\.plist$/i.test(name)) {
      files.push(p);
    }
  });
}

function run(ctx) {
  var platforms = (ctx && ctx.opts && ctx.opts.platforms) || [];
  if (platforms.length && platforms.indexOf('ios') === -1) {
    return;
  }
  var root = (ctx && ctx.opts && ctx.opts.projectRoot) || process.cwd();
  var iosDir = path.join(root, 'platforms', 'ios');
  var files = [];
  walk(iosDir, files);
  files.forEach(patchPlist);
}

run.patchPlist = patchPlist;
module.exports = run;

if (require.main === module) {
  run({ opts: { projectRoot: path.join(__dirname, '..', '..'), platforms: ['ios'] } });
}
