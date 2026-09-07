/**
 * 组装生产静态站点（无 Vite）：content-hash 核心壳 + minify/混淆以提高复制成本。
 * 用法：node scripts/assemble-site.mjs（npm run build / assemble）
 *
 * 流程概要：
 * 1. 清空并重建 site/（部署产物；源码在 frontend 根 HTML、public/js、css）
 * 2. 拷贝 HTML/资源；public/js → site/js
 * 3. minify 全站 JS/CSS；OBFUSCATE_REL 内脚本再混淆（auth / conversion-guide 仅 minify）
 * 4. app/{ui,nav,core}.js + app-shell.css → content-hash + manifest.json
 * 5. 注入 site-config.js、forensic-mark.js；优先页注入哈希壳
 * 6. 压缩内联脚本、剥离 HTML 注释
 *
 * 切勿手改 site/：下次 build 会覆盖。
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const DIST = path.join(ROOT, 'dist');

const PRIORITY_PAGES = ['mine.html', 'shouye.html', 'consult.html', 'install_guide.html'];

/** content-hash 的壳资源；注入到 PRIORITY_PAGES 的 TAX_APP_SHELL_* 占位 */
const APP_ASSETS = [
  { siteSrc: 'js/app/ui.js', outDir: 'js/app', base: 'ui' },
  { siteSrc: 'js/app/nav.js', outDir: 'js/app', base: 'nav' },
  { siteSrc: 'js/app/core.js', outDir: 'js/app', base: 'core' },
  { siteSrc: 'css/app-shell.css', outDir: 'css', base: 'app-shell', ext: '.css' }
];

/** 混淆关键业务脚本（不改 window 全局名）；体积大的管理端只做 minify。
 * auth.js / auth-boot.js / conversion-guide.js 为登录后关键路径，强混淆易在部分环境运行期崩溃，仅 minify。
 * page-loading.js 同理：支付返回靠 visibilitychange 摘转圈，强混淆+字符串切割易在 WebView 出问题。
 */
const OBFUSCATE_REL = new Set([
  'js/app/ui.js',
  'js/app/nav.js',
  'js/app/core.js',
  'js/theme-loader.js',
  'js/fast-nav.js',
  'js/tab-shell.js',
  'js/tab-shell-escape.js',
  'js/watermark.js',
  'js/forensic-mark.js',
  'js/browser-install-prompt.js',
  'js/toast-duration.js',
  'js/back-arrow.js'
]);

const OBFUSCATOR_OPTS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.35,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.85,
  splitStrings: true,
  splitStringsChunkLength: 6,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  target: 'browser'
};

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) copyDir(from, to);
    else copyFile(from, to);
  }
}

function hashBuf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
}

function walkFiles(dir, pred, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkFiles(full, pred, out);
    else if (pred(full, name)) out.push(full);
  }
  return out;
}

function relPosix(abs) {
  return path.relative(SITE, abs).split(path.sep).join('/');
}

function shouldSkipJs(name) {
  return name.endsWith('.min.js') || name.endsWith('.json');
}

async function minifyJs(code, fileLabel) {
  // 管理端主脚本与懒加载模块通过同名全局函数互相覆盖（如 chat.js → loadAdminChatConversations）。
  // minifyIdentifiers 会把主脚本内的调用改成局部短名，导致懒加载无法覆盖，页面一直停在「进入本页后加载…」。
  const keepIds =
    fileLabel === 'js/admin_panel.js' ||
    fileLabel.startsWith('js/admin/') ||
    fileLabel.includes('admin_panel') ||
    fileLabel.includes('/admin/');
  const r = await esbuild.transform(code, {
    loader: 'js',
    minify: true,
    minifyIdentifiers: !keepIds,
    minifySyntax: true,
    minifyWhitespace: true,
    legalComments: 'none',
    sourcemap: false,
    target: ['es2018']
  });
  if (r.warnings && r.warnings.length) {
    console.warn('[protect] esbuild warn', fileLabel, r.warnings[0].text);
  }
  return r.code;
}

async function minifyCss(code) {
  const r = await esbuild.transform(code, {
    loader: 'css',
    minify: true,
    legalComments: 'none',
    sourcemap: false
  });
  return r.code;
}

function obfuscateJs(code, fileLabel) {
  try {
    return JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTS).getObfuscatedCode();
  } catch (e) {
    console.warn('[protect] obfuscate skip', fileLabel, e && e.message ? e.message : e);
    return code;
  }
}

async function protectJsFile(abs) {
  const name = path.basename(abs);
  if (shouldSkipJs(name)) return;
  const rel = relPosix(abs);
  let code = fs.readFileSync(abs, 'utf8');
  if (!code.trim()) return;
  code = await minifyJs(code, rel);
  if (OBFUSCATE_REL.has(rel)) {
    code = obfuscateJs(code, rel);
  }
  const stamp = `/*! geshui ${hashBuf(Buffer.from(code)).slice(0, 8)} */\n`;
  fs.writeFileSync(abs, stamp + code);
}

async function protectCssFile(abs) {
  let code = fs.readFileSync(abs, 'utf8');
  if (!code.trim()) return;
  code = await minifyCss(code);
  fs.writeFileSync(abs, code);
}

async function protectAssets() {
  // === minify + 可选混淆 site/ 下 JS/CSS ===

  const jsFiles = walkFiles(path.join(SITE, 'js'), (full, name) => name.endsWith('.js'));
  for (const abs of jsFiles) {
    await protectJsFile(abs);
  }
  const cssFiles = walkFiles(path.join(SITE, 'css'), (full, name) => name.endsWith('.css'));
  for (const abs of cssFiles) {
    await protectCssFile(abs);
  }
  console.log('[protect] js', jsFiles.length, 'css', cssFiles.length);
  assertCoreJsProtected();
}

/** 核心业务脚本必须带压缩戳；避免镜像里再漏出 auth.js / admin_panel.js 原文 */
const CORE_PROTECT_REL = [
  'js/auth.js',
  'js/auth-boot.js',
  'js/admin_panel.js',
  'js/admin_auth.js',
  'js/consult-core.js'
];

function assertCoreJsProtected() {
  for (const rel of CORE_PROTECT_REL) {
    const abs = path.join(SITE, rel);
    if (!fs.existsSync(abs)) {
      throw new Error('[protect] missing ' + rel);
    }
    const head = fs.readFileSync(abs, 'utf8').slice(0, 32);
    if (head.indexOf('/*! geshui ') !== 0) {
      throw new Error('[protect] expected minify stamp on ' + rel);
    }
  }
}

/** 压缩页内无 src 的 script（跳过 JSON-LD / 已 type=module 且过长失败则保留） */
async function minifyInlineScripts(html, pageLabel) {
  const re = /<script(\b[^>]*)>([\s\S]*?)<\/script>/gi;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(html))) {
    out += html.slice(last, m.index);
    const attrs = m[1] || '';
    const body = m[2] || '';
    last = m.index + m[0].length;
    const attrsL = attrs.toLowerCase();
    if (
      /\bsrc\s*=/.test(attrsL) ||
      /type\s*=\s*["']?(module|importmap|application\/(ld\+)?json)/i.test(attrs) ||
      !body.trim()
    ) {
      out += m[0];
      continue;
    }
    try {
      const min = await minifyJs(body, pageLabel + '#inline');
      out += `<script${attrs}>${min}</script>`;
    } catch (e) {
      console.warn('[protect] inline skip', pageLabel, e && e.message ? e.message : e);
      out += m[0];
    }
  }
  out += html.slice(last);
  return out;
}

function stripHtmlComments(html) {
  return html.replace(/<!--(?!\s*TAX_APP_SHELL)[\s\S]*?-->/g, '');
}

function shellSnippet(manifest) {
  const css = manifest['app-shell.css'];
  const ui = manifest['ui.js'];
  const nav = manifest['nav.js'];
  const core = manifest['core.js'];
  return [
    `<link rel="stylesheet" href="/${css}">`,
    `<script src="/${ui}"></script>`,
    `<script src="/${nav}"></script>`,
    `<script src="/${core}"></script>`
  ].join('\n    ');
}

/** 插到最后一个真实闭合标签前。内联 JS 字符串里的同名标签不能当锚点（开通页 document.write 曾因此把脚本插坏）。 */
function insertBeforeLastCloseTag(html, tag, insert) {
  const lower = html.toLowerCase();
  const idx = lower.lastIndexOf(tag.toLowerCase());
  if (idx < 0) return html + insert;
  return html.slice(0, idx) + insert + html.slice(idx);
}

function injectSiteConfig(html) {
  if (/\/js\/site-config\.js/i.test(html)) return html;
  const tag = '<script src="/js/site-config.js"></script>';
  const bootRe = /(<script[^>]*\/js\/auth-boot\.js[^>]*><\/script>)/i;
  if (bootRe.test(html)) {
    return html.replace(bootRe, `${tag}\n    $1`);
  }
  const authRe = /(<script[^>]*\/js\/auth\.js[^>]*><\/script>)/i;
  if (authRe.test(html)) {
    return html.replace(authRe, `${tag}\n    $1`);
  }
  return insertBeforeLastCloseTag(html, '</head>', `    ${tag}\n`);
}

function injectForensicMark(html) {
  if (/\/js\/forensic-mark\.js/i.test(html)) return html;
  const tag = '<script src="/js/forensic-mark.js" defer></script>';
  const lower = html.toLowerCase();
  if (lower.lastIndexOf('</body>') >= 0) {
    return insertBeforeLastCloseTag(html, '</body>', `    ${tag}\n`);
  }
  return html + '\n' + tag + '\n';
}

function injectShell(html, snippet) {
  const markerStart = '<!-- TAX_APP_SHELL_START -->';
  const markerEnd = '<!-- TAX_APP_SHELL_END -->';
  if (html.includes(markerStart) && html.includes(markerEnd)) {
    const re = /<!-- TAX_APP_SHELL_START -->[\s\S]*?<!-- TAX_APP_SHELL_END -->/;
    return html.replace(re, `${markerStart}\n    ${snippet}\n    ${markerEnd}`);
  }
  const authRe = /(<script[^>]*\/js\/auth\.js[^>]*><\/script>)/i;
  if (authRe.test(html)) {
    return html.replace(
      authRe,
      `$1\n    ${markerStart}\n    ${snippet}\n    ${markerEnd}`
    );
  }
  return insertBeforeLastCloseTag(
    html,
    '</head>',
    `    ${markerStart}\n    ${snippet}\n    ${markerEnd}\n`
  );
}

function addShellBodyClass(html) {
  if (/class="[^"]*\btax-app-shell\b/.test(html)) return html;
  return html.replace(/<body([^>]*)class="([^"]*)"/i, '<body$1class="$2 tax-app-shell"').replace(
    /<body(?![^>]*class=)/i,
    '<body class="tax-app-shell"'
  );
}

async function main() {
  rmrf(SITE);
  ensureDir(SITE);

  if (fs.existsSync(DIST)) {
    copyDir(DIST, SITE);
  }

  const rootFiles = fs.readdirSync(ROOT);
  for (const name of rootFiles) {
    if (name === 'site' || name === 'dist' || name === 'node_modules' || name === 'src') continue;
    const full = path.join(ROOT, name);
    const st = fs.statSync(full);
    if (st.isFile()) {
      if (
        /\.(html|png|jpg|jpeg|webp|gif|svg|ico|txt|mp4|webm|css)$/i.test(name) ||
        name.endsWith('.mobileconfig')
      ) {
        if (name === '个人.mobileconfig') {
          copyFile(full, path.join(SITE, 'personal.mobileconfig'));
        } else {
          copyFile(full, path.join(SITE, name));
        }
      }
    }
  }

  copyDir(path.join(ROOT, 'css'), path.join(SITE, 'css'));
  copyDir(path.join(ROOT, 'public', 'js'), path.join(SITE, 'js'));
  copyDir(path.join(ROOT, 'public', 'img'), path.join(SITE, 'img'));
  copyDir(path.join(ROOT, 'caidan'), path.join(SITE, 'caidan'));
  copyDir(path.join(ROOT, 'bank_icons'), path.join(SITE, 'bank_icons'));
  /* iOS 主屏 / 描述文件 WebClip 启动图（apple-touch-startup-image） */
  copyDir(path.join(ROOT, 'splash'), path.join(SITE, 'splash'));

  // 先压缩/混淆，再打 content-hash（hash 对已保护内容）
  await protectAssets();

  const manifest = {};
  for (const asset of APP_ASSETS) {
    const abs = path.join(SITE, asset.siteSrc);
    const buf = fs.readFileSync(abs);
    const h = hashBuf(buf);
    const ext = asset.ext || path.extname(asset.siteSrc);
    const outName = `${asset.base}.${h}${ext}`;
    const outRel = path.posix.join(asset.outDir.replace(/\\/g, '/'), outName);
    const outAbs = path.join(SITE, outRel);
    ensureDir(path.dirname(outAbs));
    fs.writeFileSync(outAbs, buf);
    manifest[`${asset.base}${ext}`] = outRel.replace(/\\/g, '/');
  }

  ensureDir(path.join(SITE, 'js', 'app'));
  fs.writeFileSync(
    path.join(SITE, 'js', 'app', 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        protected: true,
        files: manifest
      },
      null,
      2
    )
  );

  const snippet = shellSnippet(manifest);
  const htmlFiles = walkFiles(SITE, (full, name) => name.endsWith('.html'));
  for (const abs of htmlFiles) {
    const page = path.basename(abs);
    let html = fs.readFileSync(abs, 'utf8');
    html = injectSiteConfig(html);
    html = injectForensicMark(html);
    if (PRIORITY_PAGES.includes(page)) {
      html = addShellBodyClass(html);
      html = injectShell(html, snippet);
    }
    html = await minifyInlineScripts(html, page);
    html = stripHtmlComments(html);
    fs.writeFileSync(abs, html);
    if (PRIORITY_PAGES.includes(page)) {
      console.log('[assemble-site] wired', page);
    }
  }

  console.log('[assemble-site] OK ->', SITE);
  console.log('[assemble-site] manifest', manifest);
}

const invokedAsScript =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedAsScript) {
  main().catch((err) => {
    console.error('[assemble-site] FAILED', err);
    process.exit(1);
  });
}

export {
  insertBeforeLastCloseTag,
  injectSiteConfig,
  injectForensicMark,
  injectShell
};
