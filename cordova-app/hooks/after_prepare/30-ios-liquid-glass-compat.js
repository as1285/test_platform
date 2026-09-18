#!/usr/bin/env node
/**
 * iOS 26/27 Liquid Glass：
 * 1) Info.plist 写入 UIDesignRequiresCompatibility（iOS 27 SDK 会忽略此键）
 * 2) MainViewController 关掉 WKWebView.scrollView.topEdgeEffect，否则顶栏一直发糊
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

var EDGE_METHOD =
  '- (void)taxHideIos26ScrollEdgeEffect {\n' +
  '    if (@available(iOS 26.0, *)) {\n' +
  '        id wv = [self valueForKey:@"webView"];\n' +
  '        id sv = [wv valueForKey:@"scrollView"];\n' +
  '        id top = [sv valueForKey:@"topEdgeEffect"];\n' +
  '        if ([top respondsToSelector:@selector(setHidden:)]) {\n' +
  '            [top setHidden:@YES];\n' +
  '        }\n' +
  '        id bottom = [sv valueForKey:@"bottomEdgeEffect"];\n' +
  '        if ([bottom respondsToSelector:@selector(setHidden:)]) {\n' +
  '            [bottom setHidden:@YES];\n' +
  '        }\n' +
  '    }\n' +
  '}\n';

function patchViewController(file) {
  var src = fs.readFileSync(file, 'utf8');
  if (src.indexOf('taxHideIos26ScrollEdgeEffect') >= 0) {
    return false;
  }
  if (/- \(void\)viewDidLoad\s*\{/.test(src)) {
    src = src.replace(
      /(- \(void\)viewDidLoad\s*\{)/,
      '$1\n    [self taxHideIos26ScrollEdgeEffect];'
    );
  }
  if (!/- \(void\)viewDidAppear:/.test(src)) {
    src = src.replace(
      /\n@end\s*$/,
      '\n- (void)viewDidAppear:(BOOL)animated {\n' +
        '    [super viewDidAppear:animated];\n' +
        '    [self taxHideIos26ScrollEdgeEffect];\n' +
        '}\n@end\n'
    );
  } else if (src.indexOf('[self taxHideIos26ScrollEdgeEffect]') < 0) {
    src = src.replace(
      /(- \(void\)viewDidAppear:\(BOOL\)animated\s*\{)/,
      '$1\n    [self taxHideIos26ScrollEdgeEffect];'
    );
  }
  if (!/\n@end\s*$/.test(src)) {
    return false;
  }
  src = src.replace(/\n@end\s*$/, '\n' + EDGE_METHOD + '\n@end\n');
  fs.writeFileSync(file, src, 'utf8');
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
    if (/Info\.plist$/i.test(name) || name === 'MainViewController.m') {
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
  files.forEach(function (file) {
    if (/Info\.plist$/i.test(file)) {
      patchPlist(file);
    } else if (/MainViewController\.m$/.test(file)) {
      patchViewController(file);
    }
  });
}

run.patchPlist = patchPlist;
run.patchViewController = patchViewController;
module.exports = run;

if (require.main === module) {
  run({ opts: { projectRoot: path.join(__dirname, '..', '..'), platforms: ['ios'] } });
}
