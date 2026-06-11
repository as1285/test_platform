/**
 * Capture mobile screenshots for install page showcase.
 * Run from backend: node scripts/capture-install-showcase.cjs [baseUrl] [user] [pass]
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const outDir =
  process.env.SHOWCASE_OUT_DIR ||
  '/var/lib/docker/volumes/test_platform_uploads_static/_data';

const baseUrl = (process.argv[2] || 'http://127.0.0.1').replace(/\/$/, '');
const username = process.argv[3] || '1';
const password = process.argv[4] || '1';

const files = {
  install_showcase_img_1: 'install_showcase_img_1.png',
  install_showcase_img_2: 'install_showcase_img_2.png',
  install_showcase_img_3: 'install_showcase_img_3.png'
};

async function apiLogin(page) {
  const res = await page.evaluate(async (u, p) => {
    const r = await fetch('api/auth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username: u, password: p })
    });
    return r.json();
  }, username, password);
  if (!res || res.code !== 200 || !res.data || !res.data.token) {
    throw new Error('Login failed: ' + (res && res.msg ? res.msg : 'unknown'));
  }
  await page.evaluate((data) => {
    localStorage.setItem('token', data.token);
    if (data.username != null) localStorage.setItem('username', String(data.username));
    if (data.account_active != null) {
      localStorage.setItem('account_active', String(data.account_active));
    }
  }, res.data);
}

async function pickTaxRecordId(page) {
  const res = await page.evaluate(async () => {
    const r = await fetch('api/tax.php?action=records', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    });
    return r.json();
  });
  const list = res && res.data && Array.isArray(res.data.records) ? res.data.records : [];
  if (!list.length) return null;
  const rec = list[0];
  return { id: rec.id, year: rec.year || new Date().getFullYear() };
}

async function shot(page, url, outPath, waitMs, fullPage) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, waitMs || 1500));
  await page.screenshot({ path: outPath, type: 'png', fullPage: !!fullPage });
}

async function main() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });

  await page.goto(baseUrl + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await apiLogin(page);

  const rec = await pickTaxRecordId(page);
  const xiangqingUrl =
    rec != null
      ? baseUrl +
        '/xiangqing.html?id=' +
        encodeURIComponent(rec.id) +
        '&year=' +
        encodeURIComponent(String(rec.year))
      : baseUrl + '/shuiming_result.html';

  const targets = [
    { key: 'install_showcase_img_1', url: xiangqingUrl, wait: 1800, fullPage: true },
    { key: 'install_showcase_img_2', url: baseUrl + '/shenbao_jilu.html', wait: 1800, fullPage: true },
    { key: 'install_showcase_img_3', url: baseUrl + '/consult.html', wait: 2500, fullPage: false }
  ];

  for (const t of targets) {
    const outPath = path.join(outDir, files[t.key]);
    console.log('Capture', t.url, '->', outPath);
    await shot(page, t.url, outPath, t.wait, t.fullPage);
  }

  await browser.close();
  console.log('Done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
