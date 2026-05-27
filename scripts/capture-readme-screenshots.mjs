/**
 * 生成 README 用截图，写入 docs/images/。
 * 用法（需已部署本地站点且账号可登录）：
 *   SCREENSHOT_USERNAME=手机号 SCREENSHOT_PASSWORD=密码 node scripts/capture-readme-screenshots.mjs
 *
 * Linux 服务器需安装中文字体，否则截图会出现方框乱码：
 *   sudo apt-get install -y fonts-noto-cjk fonts-noto-cjk-extra
 */
import { chromium, devices } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'docs', 'images');
const baseUrl = process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1';
const apiUrl = process.env.SCREENSHOT_API_URL || 'http://127.0.0.1:3000';

const CJK_FONT_STACK =
  '"Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", "WenQuanYi Micro Hei", "Microsoft YaHei", "PingFang SC", sans-serif';

const shots = [
  { file: 'shot-home.png', url: baseUrl + '/shouye.html' },
  { file: 'shot-mine.png', url: baseUrl + '/mine.html' },
  { file: 'shot-income.png', url: baseUrl + '/shuiming_result.html' },
  { file: 'shot-tax.png', url: baseUrl + '/consult.html' }
];

async function fetchLoginSession() {
  const username = process.env.SCREENSHOT_USERNAME || '';
  const password = process.env.SCREENSHOT_PASSWORD || '';
  if (!username || !password) {
    throw new Error('请设置环境变量 SCREENSHOT_USERNAME 与 SCREENSHOT_PASSWORD');
  }
  const res = await fetch(apiUrl + '/api/auth.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', username, password })
  });
  const j = await res.json();
  if (j.code !== 200 || !j.data || !j.data.token) {
    throw new Error(j.msg || '登录失败，无法生成截图');
  }
  return {
    token: j.data.token,
    account_active: j.data.account_active ? '1' : '0',
    username: j.data.username || username
  };
}

const session = await fetchLoginSession();

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 12'],
  locale: 'zh-CN',
  extraHTTPHeaders: {
    'Accept-Language': 'zh-CN,zh;q=0.9'
  }
});

await context.addInitScript(
  (s) => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('account_active', s.account_active);
    localStorage.setItem('username', s.username);
    /* 避免自定义字体配置导致中文缺字 */
    localStorage.removeItem('h5_user_font_tax_pages');
    localStorage.removeItem('h5_user_font_fab_manual_hidden');
    localStorage.removeItem('h5_user_font_capture_auto_hide');
    var style = document.createElement('style');
    style.setAttribute('data-readme-cjk-font', '1');
    style.textContent =
      'html, body, button, input, select, textarea { font-family: ' +
      s.fontStack +
      ' !important; -webkit-font-smoothing: antialiased; }';
    document.documentElement.appendChild(style);
  },
  { ...session, fontStack: CJK_FONT_STACK }
);

for (const shot of shots) {
  const page = await context.newPage();
  await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    return document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  });
  const alertOk = page.locator('#consultStrongAlertOk');
  if (await alertOk.count()) {
    await alertOk.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.screenshot({
    path: path.join(outDir, shot.file),
    fullPage: false
  });
  await page.close();
  console.log('OK', shot.file);
}

await browser.close();
