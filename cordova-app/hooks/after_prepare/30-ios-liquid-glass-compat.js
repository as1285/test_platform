#!/usr/bin/env node
/**
 * iOS 26/27 Liquid Glass（社区标准解法）：
 * StackOverflow / Apple UIScrollEdgeEffect：
 *   webView.scrollView.topEdgeEffect.isHidden = true
 * UIDesignRequiresCompatibility 在 iOS 27 SDK 会被忽略，不能单靠 plist。
 * 同时 patch MainViewController + CDVWebViewEngine，避免只打一处被覆盖。
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

var EDGE_SNIPPET =
  '    if (@available(iOS 26.0, *)) {\n' +
  '        UIScrollView *sv = nil;\n' +
  '        if ([self respondsToSelector:@selector(webView)]) {\n' +
  '            id wv = [self valueForKey:@"webView"];\n' +
  '            if ([wv respondsToSelector:@selector(scrollView)]) {\n' +
  '                sv = [wv valueForKey:@"scrollView"];\n' +
  '            }\n' +
  '        }\n' +
  '        if (!sv && [self respondsToSelector:@selector(engineWebView)]) {\n' +
  '            id wv = [self valueForKey:@"engineWebView"];\n' +
  '            if ([wv respondsToSelector:@selector(scrollView)]) {\n' +
  '                sv = [wv valueForKey:@"scrollView"];\n' +
  '            }\n' +
  '        }\n' +
  '        if (sv) {\n' +
  '            id top = [sv valueForKey:@"topEdgeEffect"];\n' +
  '            if ([top respondsToSelector:@selector(setHidden:)]) {\n' +
  '                [top setValue:@YES forKey:@"hidden"];\n' +
  '            }\n' +
  '            id bottom = [sv valueForKey:@"bottomEdgeEffect"];\n' +
  '            if ([bottom respondsToSelector:@selector(setHidden:)]) {\n' +
  '                [bottom setValue:@YES forKey:@"hidden"];\n' +
  '            }\n' +
  '        }\n' +
  '    }\n';

var EDGE_METHOD =
  '- (void)taxHideIos26ScrollEdgeEffect {\n' + EDGE_SNIPPET + '}\n';

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

/** Cordova 引擎里 WKWebView 创建/更新设置后立刻关 topEdgeEffect */
function patchWebViewEngine(file) {
  var src = fs.readFileSync(file, 'utf8');
  if (src.indexOf('taxHideIos26ScrollEdgeEffect') >= 0 || src.indexOf('topEdgeEffect') >= 0) {
    return false;
  }
  var changed = false;
  var hideBlock =
    '\n    /* tax: hide iOS 26/27 Liquid Glass scroll edge blur */\n' +
    '    if (@available(iOS 26.0, *)) {\n' +
    '        UIScrollView *sv = wkWebView.scrollView;\n' +
    '        if ([sv respondsToSelector:@selector(topEdgeEffect)]) {\n' +
    '            id top = [sv valueForKey:@"topEdgeEffect"];\n' +
    '            if ([top respondsToSelector:@selector(setHidden:)]) {\n' +
    '                [top setValue:@YES forKey:@"hidden"];\n' +
    '            }\n' +
    '        }\n' +
    '        if ([sv respondsToSelector:@selector(bottomEdgeEffect)]) {\n' +
    '            id bottom = [sv valueForKey:@"bottomEdgeEffect"];\n' +
    '            if ([bottom respondsToSelector:@selector(setHidden:)]) {\n' +
    '                [bottom setValue:@YES forKey:@"hidden"];\n' +
    '            }\n' +
    '        }\n' +
    '    }\n';

  if (/- \(void\)updateSettings:/.test(src)) {
    src = src.replace(
      /(- \(void\)updateSettings:[^{]*\{)/,
      '$1' + hideBlock
    );
    changed = true;
  } else if (/WKWebView\s*\*\s*wkWebView\s*=/.test(src)) {
    src = src.replace(
      /(WKWebView\s*\*\s*wkWebView\s*=[^;]+;)/,
      '$1' + hideBlock
    );
    changed = true;
  }
  if (!changed) {
    return false;
  }
  fs.writeFileSync(file, src, 'utf8');
  return true;
}

function walk(dir, files) {
  if (!fs.existsSync(dir)) {
    return;
  }
  fs.readdirSync(dir).forEach(function (name) {
    if (name === 'Pods' || name === 'build') {
      return;
    }
    var p = path.join(dir, name);
    var st = fs.statSync(p);
    if (st.isDirectory()) {
      walk(p, files);
      return;
    }
    if (
      /Info\.plist$/i.test(name) ||
      name === 'MainViewController.m' ||
      name === 'CDVWebViewEngine.m'
    ) {
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
    } else if (/CDVWebViewEngine\.m$/.test(file)) {
      patchWebViewEngine(file);
    }
  });
}

run.patchPlist = patchPlist;
run.patchViewController = patchViewController;
run.patchWebViewEngine = patchWebViewEngine;
module.exports = run;

if (require.main === module) {
  run({ opts: { projectRoot: path.join(__dirname, '..', '..'), platforms: ['ios'] } });
}
