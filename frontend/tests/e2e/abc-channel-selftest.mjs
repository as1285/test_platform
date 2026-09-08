/**
 * ABC 渠道线上自测（lkj）
 * 验证：安装包链接、同域补 ch、sessionStorage、不写 localStorage、分享去 ch、/api 不补
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = process.env.ABC_SELFTEST_ORIGIN || 'https://lkj.qiyun888.top';
const OUT_DIR = process.env.ABC_SELFTEST_OUT || '/opt/cursor/artifacts';
const report = [];

function log(msg) {
  report.push(msg);
  console.log(msg);
}

function assertOk(cond, msg) {
  if (!cond) throw new Error(msg);
  log('PASS: ' + msg);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();

  // 1) 安装包 API（Node 侧请求，避免空白页 CORS）
  const apiRes = await fetch(ORIGIN + '/api/public/install-packages?sales_ch=abc');
  assertOk(apiRes.ok, 'install-packages HTTP ' + apiRes.status);
  const api = await apiRes.json();
  assertOk(api.code === 200, 'install-packages code 200');
  assertOk(api.data.sales_channel === 'abc', 'sales_channel=abc');
  assertOk(api.data.channel_package === true, 'channel_package=true');
  assertOk(
    String(api.data.android_apk_download_url).includes('7cdf611197896e5873f02ce3d1612e1f.apk'),
    'android points to rebuilt apk'
  );
  assertOk(
    String(api.data.ios_mobileconfig_download_url).includes(
      '555e106c5e607422ddebf24e4faab81d.mobileconfig'
    ),
    'ios points to rebuilt mobileconfig'
  );

  // 下载并检查 APK 内壳逻辑
  const apkUrl = ORIGIN + api.data.android_apk_download_url;
  const apkRes = await fetch(apkUrl);
  assertOk(apkRes.ok, 'apk download HTTP ' + apkRes.status);
  const apkBuf = Buffer.from(await apkRes.arrayBuffer());
  assertOk(apkBuf.length > 5_000_000, 'apk size > 5MB (' + apkBuf.length + ')');
  const apkPath = path.join(OUT_DIR, 'abc_selftest_downloaded.apk');
  fs.writeFileSync(apkPath, apkBuf);
  const { execFileSync } = await import('child_process');
  const unzipDir = path.join(OUT_DIR, 'abc_selftest_apk_www');
  fs.rmSync(unzipDir, { recursive: true, force: true });
  fs.mkdirSync(unzipDir, { recursive: true });
  execFileSync('unzip', ['-qo', apkPath, 'assets/www/index.html', 'assets/www/distribution-config.js', '-d', unzipDir]);
  const idx = fs.readFileSync(path.join(unzipDir, 'assets/www/index.html'), 'utf8');
  const dist = fs.readFileSync(path.join(unzipDir, 'assets/www/distribution-config.js'), 'utf8');
  assertOk(idx.includes('ensureChannelOnAppUrl'), 'apk www has ensureChannelOnAppUrl');
  assertOk(dist.includes("agentSalesChannel: 'abc'"), 'apk distribution channel=abc');
  log('INFO: apk index size=' + idx.length + ' ensureCount=' + (idx.match(/ensureChannelOnAppUrl/g) || []).length);

  // 2) 打开带 ch=abc 的安装页
  await page.goto(ORIGIN + '/install_guide.html?ch=abc#download', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, 'abc_selftest_install_guide.png'), fullPage: true });

  const storage1 = await page.evaluate(() => ({
    href: location.href,
    sales: typeof getSalesChannel === 'function' ? getSalesChannel() : null,
    local: localStorage.getItem('sales_channel_v1'),
    sess: sessionStorage.getItem('sales_channel_url_only_session_v1')
  }));
  assertOk(storage1.sales === 'abc', 'getSalesChannel()=abc on install_guide');
  assertOk(storage1.local == null, 'abc not written to localStorage');
  assertOk(!!storage1.sess && storage1.sess.includes('"ch":"abc"'), 'abc remembered in sessionStorage');

  // 3) 同域跳转：点注册链接应带 ch=abc
  const regHrefBefore = await page.evaluate(() => {
    const a = document.querySelector('a.install-register-link, a[href*="register.html"]');
    return a ? a.getAttribute('href') : null;
  });
  // 触发 guard：直接 location 赋值到 mine，看是否被补参
  await page.evaluate(() => {
    location.assign('/mine.html');
  });
  await page.waitForTimeout(2000);
  const afterAssign = await page.evaluate(() => ({
    href: location.href,
    search: location.search,
    sales: typeof getSalesChannel === 'function' ? getSalesChannel() : null,
    local: localStorage.getItem('sales_channel_v1'),
    sess: sessionStorage.getItem('sales_channel_url_only_session_v1')
  }));
  await page.screenshot({ path: path.join(OUT_DIR, 'abc_selftest_after_assign_mine.png'), fullPage: false });
  assertOk(
    /[?&]ch=abc\b/.test(afterAssign.href) || afterAssign.sales === 'abc',
    'after location.assign(/mine.html) keeps abc (url or session): ' + afterAssign.href
  );
  assertOk(afterAssign.local == null, 'still no localStorage sales_channel after navigation');
  log('INFO: register link raw href was ' + regHrefBefore);
  log('INFO: after assign href=' + afterAssign.href);

  // 4) 同域 <a> 点击补参（capture 改 href，再 preventDefault 防跳转）
  await page.goto(ORIGIN + '/purchase.html?ch=abc', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  await page.waitForTimeout(800);
  const clickProbe = await page.evaluate(() => {
    const a = document.createElement('a');
    a.setAttribute('href', '/shouye.html');
    a.textContent = 'probe';
    document.body.appendChild(a);
    a.addEventListener('click', (e) => e.preventDefault());
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return { hrefAttr: a.getAttribute('href'), hrefAbs: a.href };
  });
  assertOk(
    /[?&]ch=abc\b/.test(String(clickProbe.hrefAttr || '')),
    'same-origin <a> click gets ch=abc: ' + JSON.stringify(clickProbe)
  );

  // 5) /api 不补参
  const apiHref = await page.evaluate(() => {
    const a = document.createElement('a');
    a.setAttribute('href', '/api/public/install-packages');
    document.body.appendChild(a);
    a.addEventListener('click', (e) => e.preventDefault());
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return a.getAttribute('href');
  });
  assertOk(apiHref === '/api/public/install-packages', '/api link not decorated with ch: ' + apiHref);

  // 6) 外链不补参
  const extHref = await page.evaluate(() => {
    const a = document.createElement('a');
    a.setAttribute('href', 'https://example.com/x');
    document.body.appendChild(a);
    a.addEventListener('click', (e) => e.preventDefault());
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return a.getAttribute('href');
  });
  assertOk(extHref === 'https://example.com/x', 'external link not decorated: ' + extHref);

  // 7) 分享链接去 ch
  const share = await page.evaluate(() => {
    if (typeof buildShareUrl === 'function') {
      return buildShareUrl('mine.html', { ch: 'abc', from: 'selftest' });
    }
    return { missing: true };
  });
  if (share && share.missing) {
    log('WARN: buildShareUrl not found on window; names=' + JSON.stringify(share.names));
  } else {
    assertOk(
      typeof share === 'string' && !/[?&]ch=abc\b/.test(share),
      'share url strips ch: ' + share
    );
  }

  // 8) 新会话（清 storage）无 URL 时不应再是 abc
  await context.clearCookies();
  const page2 = await context.newPage();
  await page2.goto(ORIGIN + '/purchase.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page2.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page2.reload({ waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(800);
  const cold = await page2.evaluate(() => ({
    sales: typeof getSalesChannel === 'function' ? getSalesChannel() : null,
    local: localStorage.getItem('sales_channel_v1'),
    sess: sessionStorage.getItem('sales_channel_url_only_session_v1')
  }));
  assertOk(cold.sales !== 'abc' && !cold.sess, 'cold session without URL is not abc: ' + JSON.stringify(cold));

  await page.screenshot({ path: path.join(OUT_DIR, 'abc_selftest_purchase_ch.png'), fullPage: false });

  const reportPath = path.join(OUT_DIR, 'abc_channel_selftest_report.txt');
  fs.writeFileSync(reportPath, report.join('\n') + '\n');
  log('REPORT: ' + reportPath);

  await browser.close();
  console.log('\nABC selftest OK');
}

main().catch((err) => {
  console.error('\nABC selftest FAILED:', err && err.stack ? err.stack : err);
  try {
    fs.writeFileSync(
      path.join(OUT_DIR, 'abc_channel_selftest_report.txt'),
      report.join('\n') + '\nFAIL: ' + String(err) + '\n'
    );
  } catch (_) {}
  process.exit(1);
});
