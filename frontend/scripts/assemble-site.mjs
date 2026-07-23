/**
 * 组装生产静态站点：content-hash 核心壳 + 压缩/混淆以提高复制成本。
 * 用法：node scripts/assemble-site.mjs（由 npm run build 调用）
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

const APP_ASSETS = [
  { siteSrc: 'js/app/ui.js', outDir: 'js/app', base: 'ui' },
  { siteSrc: 'js/app/nav.js', outDir: 'js/app', base: 'nav' },
  { siteSrc: 'js/app/core.js', outDir: 'js/app', base: 'core' },
  { siteSrc: 'css/app-shell.css', outDir: 'css', base: 'app-shell', ext: '.css' }
];

/** 轻度混淆（不改 window 全局名）；体积大的管理端只做 minify */
const OBFUSCATE_REL = new Set([
  'js/auth.js',
  'js/app/ui.js',
  'js/app/nav.js',
  'js/app/core.js',
  'js/theme-loader.js',
  'js/page-loading.js',
  'js/fast-nav.js',
  'js/conversion-guide.js',
  'js/watermark.js',
  'js/browser-install-prompt.js',
  'js/toast-duration.js',
  'js/back-arrow.js'
]);

const OBFUSCATOR_OPTS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.6,
  splitStrings: false,
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
  const jsFiles = walkFiles(path.join(SITE, 'js'), (full, name) => name.endsWith('.js'));
  for (const abs of jsFiles) {
    await protectJsFile(abs);
  }
  const cssFiles = walkFiles(path.join(SITE, 'css'), (full, name) => name.endsWith('.css'));
  for (const abs of cssFiles) {
    await protectCssFile(abs);
  }
  console.log('[protect] js', jsFiles.length, 'css', cssFiles.length);
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
  return html.replace(
    /<\/head>/i,
    `    ${markerStart}\n    ${snippet}\n    ${markerEnd}\n</head>`
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

  const indexHtml = path.join(SITE, 'index.html');
  if (fs.existsSync(indexHtml)) {
    copyFile(indexHtml, path.join(SITE, 'login.html'));
  }

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

main().catch((err) => {
  console.error('[assemble-site] FAILED', err);
  process.exit(1);
});
