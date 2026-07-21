/**
 * 组装生产静态站点：content-hash 核心壳资源，并收拢 Dockerfile COPY。
 * 用法：node scripts/assemble-site.mjs（由 npm run build 调用）
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const DIST = path.join(ROOT, 'dist');

const PRIORITY_PAGES = ['mine.html', 'shouye.html', 'consult.html', 'install_guide.html'];

const APP_ASSETS = [
  { src: 'public/js/app/ui.js', outDir: 'js/app', base: 'ui' },
  { src: 'public/js/app/nav.js', outDir: 'js/app', base: 'nav' },
  { src: 'public/js/app/core.js', outDir: 'js/app', base: 'core' },
  { src: 'css/app-shell.css', outDir: 'css', base: 'app-shell', ext: '.css' }
];

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
  // 插在 auth.js 之后
  const authRe = /(<script[^>]*\/js\/auth\.js[^>]*><\/script>)/i;
  if (authRe.test(html)) {
    return html.replace(
      authRe,
      `$1\n    ${markerStart}\n    ${snippet}\n    ${markerEnd}`
    );
  }
  // 退化为 </head> 前
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

function main() {
  rmrf(SITE);
  ensureDir(SITE);

  if (fs.existsSync(DIST)) {
    copyDir(DIST, SITE);
  }

  // 静态根资源
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
  copyDir(path.join(ROOT, 'caidan'), path.join(SITE, 'caidan'));
  copyDir(path.join(ROOT, 'bank_icons'), path.join(SITE, 'bank_icons'));

  // index 双份：login.html 兼容
  const indexHtml = path.join(SITE, 'index.html');
  if (fs.existsSync(indexHtml)) {
    copyFile(indexHtml, path.join(SITE, 'login.html'));
  }

  const manifest = {};
  for (const asset of APP_ASSETS) {
    const abs = path.join(ROOT, asset.src);
    const buf = fs.readFileSync(abs);
    const h = hashBuf(buf);
    const ext = asset.ext || path.extname(asset.src);
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
    JSON.stringify({ generatedAt: new Date().toISOString(), files: manifest }, null, 2)
  );

  const snippet = shellSnippet(manifest);
  for (const page of PRIORITY_PAGES) {
    const abs = path.join(SITE, page);
    if (!fs.existsSync(abs)) {
      console.warn('[assemble-site] missing priority page', page);
      continue;
    }
    let html = fs.readFileSync(abs, 'utf8');
    html = addShellBodyClass(html);
    html = injectShell(html, snippet);
    fs.writeFileSync(abs, html);
    console.log('[assemble-site] wired', page);
  }

  // 源站未 hash 的壳文件也保留，便于非核心页渐进接入
  copyFile(path.join(ROOT, 'public/js/app/ui.js'), path.join(SITE, 'js/app/ui.js'));
  copyFile(path.join(ROOT, 'public/js/app/nav.js'), path.join(SITE, 'js/app/nav.js'));
  copyFile(path.join(ROOT, 'public/js/app/core.js'), path.join(SITE, 'js/app/core.js'));
  copyFile(path.join(ROOT, 'css/app-shell.css'), path.join(SITE, 'css/app-shell.css'));

  console.log('[assemble-site] OK ->', SITE);
  console.log('[assemble-site] manifest', manifest);
}

main();
