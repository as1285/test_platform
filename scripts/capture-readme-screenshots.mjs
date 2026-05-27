/**
 * 生成 README 用截图，写入 docs/images/。
 * 用法（需已部署本地站点且账号可登录）：
 *   SCREENSHOT_USERNAME=手机号 SCREENSHOT_PASSWORD=密码 node scripts/capture-readme-screenshots.mjs
 */
import { chromium, devices } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'docs', 'images');
const baseUrl = process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1';
const apiUrl = process.env.SCREENSHOT_API_URL || 'http://127.0.0.1:3000';

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
  locale: 'zh-CN'
});

await context.addInitScript(
  (s) => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('account_active', s.account_active);
    localStorage.setItem('username', s.username);
  },
  session
);

for (const shot of shots) {
  const page = await context.newPage();
  await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
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
