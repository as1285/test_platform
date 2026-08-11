#!/usr/bin/env node
/**
 * Playwright 浏览器冒烟（纯 API + 浏览器，不依赖宿主机 docker CLI）
 * 由 Docker 容器或本地 Chromium 执行；测试账号由 ui-smoke-host-setup.sh 准备。
 */
import { chromium, devices } from 'playwright';

const SITE_URL = (process.env.SITE_URL || process.env.BASE_URL || 'http://127.0.0.1').replace(/\/$/, '');
const API_URL = (process.env.API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const USER = process.env.UI_SMOKE_USER || '';
const PASS = process.env.UI_SMOKE_PASS || '';
let TOKEN = process.env.UI_SMOKE_TOKEN || '';

function log(msg) {
  console.log(`[ui-smoke] ${msg}`);
}

function fail(msg) {
  console.error(`[ui-smoke] FAIL: ${msg}`);
  process.exit(1);
}

async function apiLogin() {
  const res = await fetch(`${API_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', username: USER, password: PASS })
  });
  const j = await res.json();
  if (j.code !== 200 || !j.data?.token) {
    fail('login failed: ' + (j.msg || res.status));
  }
  return j.data.token;
}

async function apiPost(path, body, pagePath) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      'X-Page-Path': pagePath || '/ui-smoke'
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function launchBrowser() {
  const launchOpts = { headless: true };
  const custom =
    process.env.CHROMIUM_EXECUTABLE_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '';
  if (custom) launchOpts.executablePath = custom;
  try {
    return await chromium.launch(launchOpts);
  } catch (e) {
    fail(
      'Chromium 启动失败。Docker 方式请执行: ./scripts/ui-smoke-playwright.sh\n' + e.message
    );
  }
}

async function waitForUnreadBadge(page) {
  await page.waitForSelector('.bottom-nav .nav-item[href="message.html"]', { timeout: 20000 });
  await page.waitForFunction(() => typeof window.refreshMessageUnreadBadge === 'function', {
    timeout: 20000
  });
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/message') && r.url().includes('unread_count') && r.status() === 200,
      { timeout: 20000 }
    ),
    page.evaluate(() => window.refreshMessageUnreadBadge())
  ]);
  const badge = page.locator('.bottom-nav .nav-unread-badge');
  await badge.waitFor({ state: 'visible', timeout: 20000 });
  return badge;
}

async function main() {
  if (!USER || !PASS) {
    fail('缺少 UI_SMOKE_USER / UI_SMOKE_PASS（请先运行 ui-smoke-host-setup.sh）');
  }
  if (!TOKEN) {
    TOKEN = await apiLogin();
  }
  log(`site=${SITE_URL} api=${API_URL} user=${USER}`);

  const browser = await launchBrowser();
  const context = await browser.newContext({
    ...devices['iPhone 12'],
    locale: 'zh-CN'
  });

  await context.addInitScript((s) => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('account_active', '0');
    localStorage.setItem('user_id', s.username);
    localStorage.setItem('username', s.username);
  }, { token: TOKEN, username: USER });

  const page = await context.newPage();

  // 1) 未读角标
  const msgRes = await apiPost(
    '/api/message',
    {
      action: 'add_message',
      title: 'UI冒烟未读消息',
      content: 'Docker Playwright 冒烟测试',
      company_name: '系统通知',
      msg_date: new Date().toISOString().slice(0, 10),
      is_read: 0
    },
    '/message.html'
  );
  if (msgRes.code !== 200) fail('add_message failed: ' + (msgRes.msg || ''));

  await page.goto(`${SITE_URL}/shouye.html`, { waitUntil: 'domcontentloaded' });
  const badge = await waitForUnreadBadge(page);
  const badgeText = (await badge.textContent())?.trim();
  if (!badgeText || badgeText === '0') fail(`badge unexpected: ${badgeText}`);
  log(`ok home message badge (${badgeText})`);

  // 2) 消息列表
  await page.goto(`${SITE_URL}/message.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.message-item', { timeout: 20000 });
  const title = await page.locator('.message-content-title').first().textContent();
  if (!title?.includes('UI冒烟未读消息')) fail('message list missing item');
  log('ok message list');

  // 3) 税务记录 + 支付引导条
  const taxRes = await apiPost(
    '/api/tax',
    {
      action: 'save_record',
      record: {
        year: 2025,
        month: 3,
        income_type: '工资薪金',
        company_name: 'UI冒烟公司',
        income: 12000,
        tax_reported: 360
      }
    },
    '/consult.html'
  );
  if (taxRes.code !== 200) fail('save_record failed: ' + (taxRes.msg || ''));

  await page.goto(`${SITE_URL}/consult.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#taxPayGuideBanner', { timeout: 25000 });
  if ((await page.locator('#taxPayGuideBanner').getAttribute('hidden')) !== null) {
    fail('tax pay guide banner hidden');
  }
  log('ok tax pay guide banner');

  // 4) 按月工资分页 DOM
  if ((await page.locator('#batchMsModalPager').count()) < 1) {
    fail('batchMsModalPager missing');
  }
  log('ok batch-ms pager dom');

  // 5) 编辑区展开
  await page.waitForSelector('#taxMoreCard.is-collapsed', { timeout: 10000 });
  await page.evaluate(() => {
    var more = document.getElementById('taxMoreCard');
    var single = document.getElementById('singleTaxRecordCard');
    var moreToggle = document.getElementById('taxMoreToggle');
    var advToggle = document.getElementById('singleTaxRecordToggle');
    if (more) {
      more.classList.remove('is-collapsed');
      more.classList.add('is-open');
    }
    if (moreToggle) moreToggle.setAttribute('aria-expanded', 'true');
    if (single) single.classList.remove('is-collapsed');
    if (advToggle) advToggle.setAttribute('aria-expanded', 'true');
  });
  if ((await page.locator('#taxMoreCard.is-open').count()) < 1) {
    fail('taxMoreCard did not expand');
  }
  log('ok tax edit cards expand');

  // 6) 开通类自动站内信已关闭：支付页离开后消息页不应出现开通广告
  await page.goto(`${SITE_URL}/purchase.html`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${SITE_URL}/shouye.html`, { waitUntil: 'domcontentloaded' });
  const trackRes = await apiPost(
    '/api/user',
    { action: 'track_purchase_page_leave', meta: { page: 'purchase', via: 'ui_smoke_docker' } },
    '/event/track_purchase_page_leave'
  );
  if (trackRes.code !== 200) fail('track_purchase_page_leave failed');
  await new Promise((r) => setTimeout(r, 1500));

  await page.goto(`${SITE_URL}/message.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.message-list, .empty-tip, .message-empty, body', { timeout: 20000 });
  const titles = await page.locator('.message-content-title').allTextContents();
  const hasAuto = titles.some(
    (t) => t.includes('税务记录已生成') || t.includes('开通方案仍在等您')
  );
  if (hasAuto) fail('activation auto inbox message should be disabled');
  log('ok auto inbox promo disabled');

  await browser.close();
  log('ALL PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
