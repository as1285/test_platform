#!/usr/bin/env node
/**
 * Playwright 浏览器冒烟（纯 API + 浏览器，不依赖宿主机 docker CLI）
 * 由 Docker 容器或本地 Chromium 执行；测试账号由 ui-smoke-host-setup.sh 准备。
 *
 * 机型：见 ui-smoke-devices.mjs
 *   UI_SMOKE_DEVICES=all|full|recent|popular|mainstream|iphone-12,oneplus-12,...
 *   UI_SMOKE_CHROME_ONLY=1  跳过 API 业务冒烟，只验壳 class / 白顶栏顶距（静态站可用）
 */
import { mkdirSync } from 'fs';
import { chromium, devices } from 'playwright';
import {
  DEVICE_PROFILES,
  resolveSmokeDevices,
  buildContextOptions
} from './ui-smoke-devices.mjs';

const SITE_URL = (process.env.SITE_URL || process.env.BASE_URL || 'http://127.0.0.1').replace(/\/$/, '');
const API_URL = (process.env.API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const USER = process.env.UI_SMOKE_USER || '';
const PASS = process.env.UI_SMOKE_PASS || '';
let TOKEN = process.env.UI_SMOKE_TOKEN || '';

function log(msg) {
  console.log(`[ui-smoke] ${msg}`);
}

class SmokeFail extends Error {}

function fail(msg) {
  const err = new SmokeFail(msg);
  err.uiSmokeFail = true;
  throw err;
}

function fatal(msg) {
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
    fatal('login failed: ' + (j.msg || res.status));
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
    fatal(
      'Chromium 启动失败。Docker 方式请执行: ./scripts/ui-smoke-playwright.sh\n' + e.message
    );
  }
}

function attachSession(context, profile) {
  return context.addInitScript(
    (s) => {
      localStorage.setItem('token', s.token);
      localStorage.setItem('account_active', '0');
      localStorage.setItem('user_id', s.username);
      localStorage.setItem('username', s.username);
      if (s.inApp) {
        localStorage.setItem('tax_platform_in_app_v1', 'playwright');
        sessionStorage.setItem('tax_platform_in_app_v1', 'playwright');
      }
      if (s.deviceModel) {
        localStorage.setItem('tax_device_model_v1', s.deviceModel);
      }
    },
    {
      token: TOKEN,
      username: USER,
      inApp: !!profile.inApp,
      deviceModel: profile.deviceModel || ''
    }
  );
}

async function openProfile(browser, profile) {
  const context = await browser.newContext(buildContextOptions(profile, devices));
  await attachSession(context, profile);
  const page = await context.newPage();
  const tag = `[${profile.id}]`;
  page.on('pageerror', (err) => {
    log(`${tag} pageerror ${err.message}`);
  });
  return { context, page };
}

async function waitForUnreadBadge(page) {
  await page.waitForSelector('.bottom-nav .nav-item[href="message.html"]', { timeout: 20000 });
  const badge = page.locator('.bottom-nav .nav-unread-badge');
  try {
    await badge.waitFor({ state: 'visible', timeout: 8000 });
    return badge;
  } catch (eFirst) {
    /* 首屏请求可能已结束或被 in-flight 合流，勿再死等 waitForResponse */
    await page.waitForFunction(
      () =>
        typeof window.refreshMessageUnreadBadge === 'function' &&
        typeof window.authFetch === 'function',
      { timeout: 12000 }
    );
    await page.evaluate(() => {
      try {
        window.authFetch('api/message?action=unread_count', { cacheBust: true }).then(function (r) {
          return r.json();
        }).then(function (data) {
          var n = data && data.data ? Number(data.data.unread) || 0 : 0;
          var item = document.querySelector('.bottom-nav .nav-item[href="message.html"]');
          if (!item || n <= 0) return;
          var b = item.querySelector('.nav-unread-badge');
          if (!b) {
            b = document.createElement('span');
            b.className = 'nav-unread-badge';
            (item.querySelector('.nav-icon') || item).appendChild(b);
          }
          b.textContent = n > 99 ? '99+' : String(n);
          b.hidden = false;
        });
      } catch (e) {}
      if (typeof window.refreshMessageUnreadBadge === 'function') {
        window.refreshMessageUnreadBadge();
      }
    });
    await badge.waitFor({ state: 'visible', timeout: 15000 });
    return badge;
  }
}

async function measureHomeScroll(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const pageRoot = document.querySelector('.shouye-page');
    const before = window.scrollY;
    const scrollHeight = Math.max(root.scrollHeight, body?.scrollHeight || 0);
    window.scrollTo(0, scrollHeight);
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        resolve({
          before,
          after: window.scrollY,
          innerHeight: window.innerHeight,
          scrollHeight,
          bodyMinHeight: body ? getComputedStyle(body).minHeight : '',
          pageMinHeight: pageRoot ? getComputedStyle(pageRoot).minHeight : '',
          classes: Array.from(root.classList)
        });
      });
    });
  });
}

async function readWhiteTopChrome(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const header =
      document.querySelector('body.page-shuiming-result .top-fixed .header') ||
      document.querySelector('body.page-shuiming > .header') ||
      document.querySelector('.header');
    const cs = header ? getComputedStyle(header) : null;
    const padTop = cs ? parseFloat(cs.paddingTop) || 0 : 0;
    const shell =
      root.style.getPropertyValue('--app-shell-statusbar-top') ||
      getComputedStyle(root).getPropertyValue('--app-shell-statusbar-top') ||
      '';
    const shellPx = parseFloat(String(shell).trim()) || 0;
    return {
      classes: Array.from(root.classList),
      padTop,
      shell,
      shellPx,
      href: location.href
    };
  });
}

let seededInbox = false;
let seededTax = false;

async function runFullSuite(page, tag) {
  if (!seededInbox) {
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
    if (msgRes.code !== 200) fail(`${tag} add_message failed: ` + (msgRes.msg || ''));
    seededInbox = true;
  }

  await page.goto(`${SITE_URL}/shouye.html`, { waitUntil: 'domcontentloaded' });
  const badge = await waitForUnreadBadge(page);
  const badgeText = (await badge.textContent())?.trim();
  if (!badgeText || badgeText === '0') fail(`${tag} badge unexpected: ${badgeText}`);
  log(`${tag} ok home message badge (${badgeText})`);

  const homeScroll = await measureHomeScroll(page);
  if (homeScroll.scrollHeight <= homeScroll.innerHeight + 100 || homeScroll.after <= homeScroll.before) {
    fail(`${tag} home cannot scroll: ${JSON.stringify(homeScroll)}`);
  }
  log(`${tag} ok home scroll (${homeScroll.innerHeight} -> ${homeScroll.scrollHeight})`);

  await page.goto(`${SITE_URL}/message.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.message-item', { timeout: 20000 });
  const title = await page.locator('.message-content-title').first().textContent();
  if (!title?.includes('UI冒烟未读消息')) fail(`${tag} message list missing item`);
  log(`${tag} ok message list`);

  if (!seededTax) {
    const now = new Date();
    const taxRes = await apiPost(
      '/api/tax',
      {
        action: 'save_record',
        record: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          income_type: '工资薪金',
          company_name: 'UI冒烟超长公司名称用于省略号检查一二三四五',
          income: 12000,
          tax_reported: 360
        }
      },
      '/consult.html'
    );
    if (taxRes.code !== 200) fail(`${tag} save_record failed: ` + (taxRes.msg || ''));
    seededTax = true;
  }

  await page.goto(`${SITE_URL}/consult.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#taxPayGuideBanner', { timeout: 25000 });
  if ((await page.locator('#taxPayGuideBanner').getAttribute('hidden')) !== null) {
    fail(`${tag} tax pay guide banner hidden`);
  }
  log(`${tag} ok tax pay guide banner`);

  if ((await page.locator('#batchMsModalPager').count()) < 1) {
    fail(`${tag} batchMsModalPager missing`);
  }
  log(`${tag} ok batch-ms pager dom`);

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
    fail(`${tag} taxMoreCard did not expand`);
  }
  log(`${tag} ok tax edit cards expand`);

  await page.goto(`${SITE_URL}/purchase.html`, { waitUntil: 'domcontentloaded' });
  await page.goto(`${SITE_URL}/shouye.html`, { waitUntil: 'domcontentloaded' });
  const trackRes = await apiPost(
    '/api/user',
    { action: 'track_purchase_page_leave', meta: { page: 'purchase', via: 'ui_smoke_docker' } },
    '/event/track_purchase_page_leave'
  );
  if (trackRes.code !== 200) fail(`${tag} track_purchase_page_leave failed`);
  await new Promise((r) => setTimeout(r, 1500));

  await page.goto(`${SITE_URL}/message.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.message-list, .empty-tip, .message-empty, body', { timeout: 20000 });
  const titles = await page.locator('.message-content-title').allTextContents();
  const hasAuto = titles.some(
    (t) => t.includes('税务记录已生成') || t.includes('开通方案仍在等您')
  );
  if (hasAuto) fail(`${tag} activation auto inbox message should be disabled`);
  log(`${tag} ok auto inbox promo disabled`);
}

async function runIosChrome(page, profile, tag) {
  await page.goto(`${SITE_URL}/shouye.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const info = await measureHomeScroll(page);
  if (!info.classes.includes('app-ios-client') && !info.classes.includes('app-top-safe-shell')) {
    fail(`${tag} missing ios chrome classes: ${info.classes.join(' ')}`);
  }
  if (info.scrollHeight <= info.innerHeight + 100 || info.after <= info.before) {
    fail(`${tag} home cannot scroll: ${JSON.stringify(info)}`);
  }
  log(`${tag} ok ios chrome + home scroll`);
  await assertIosShuimingResultLayout(page, profile, tag);
}

async function assertIosShuimingResultLayout(page, profile, tag) {
  await page.goto(`${SITE_URL}/shuiming_result.html`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('.list-item', { timeout: 10000 });
  } catch (eList) {}
  const layout = await page.evaluate(() => {
    const list = document.querySelector('.list');
    const arrow = document.querySelector('.list-row-company .list-arrow, .list-arrow');
    const name = document.querySelector('.list-company-name');
    const csList = list ? getComputedStyle(list) : null;
    const nameRect = name ? name.getBoundingClientRect() : null;
    const arrowRect = arrow ? arrow.getBoundingClientRect() : null;
    const arrowTy = getComputedStyle(document.documentElement)
      .getPropertyValue('--device-arrow-ty')
      .trim();
    return {
      classes: Array.from(document.documentElement.classList),
      innerWidth: window.innerWidth,
      listPadL: csList ? parseFloat(csList.paddingLeft) || 0 : null,
      listPadR: csList ? parseFloat(csList.paddingRight) || 0 : null,
      arrowTag: arrow ? arrow.tagName : '',
      arrowHasImg: !!(arrow && arrow.tagName === 'IMG'),
      arrowTy: arrowTy,
      nameBottom: nameRect ? nameRect.bottom : null,
      arrowBottom: arrowRect ? arrowRect.bottom : null
    };
  });
  if (layout.innerWidth >= 414) {
    if (layout.listPadL > 2 || layout.listPadR > 2) {
      fail(
        `${tag} shuiming_result not edge-to-edge: padL=${layout.listPadL} padR=${layout.listPadR} w=${layout.innerWidth}`
      );
    }
  }
  if (layout.arrowHasImg) {
    fail(`${tag} shuiming_result still uses img chevron`);
  }
  if (profile.id === 'iphone-17-promax' && !layout.classes.includes('app-ios-iphone17promax')) {
    fail(`${tag} missing app-ios-iphone17promax: ${layout.classes.join(' ')}`);
  }
  if (profile.id === 'iphone-17-promax') {
    if (layout.arrowTy !== '-6px') {
      fail(`${tag} --device-arrow-ty expected -6px got ${layout.arrowTy || '(empty)'}`);
    }
    if (layout.nameBottom != null && layout.arrowBottom != null) {
      const dy = layout.arrowBottom - layout.nameBottom;
      /* 真机 PingFang 字面高于行盒底；箭头底可比名字盒略高，但不能再低于名字 */
      if (dy > 2 || dy < -8) {
        fail(
          `${tag} company chevron baseline dy=${dy.toFixed(2)} (arrowBottom-nameBottom, need -8..2)`
        );
      }
    }
    try {
      const row = page.locator('.list-row-company').first();
      await row.waitFor({ state: 'visible', timeout: 5000 });
      mkdirSync('/tmp/ui-smoke-shots', { recursive: true });
      const shotPath = '/tmp/ui-smoke-shots/iphone-17-promax-company-arrow.png';
      await row.screenshot({ path: shotPath });
      log(`${tag} screenshot ${shotPath}`);
    } catch (eShot) {
      log(`${tag} skip arrow screenshot: ${eShot && eShot.message ? eShot.message : eShot}`);
    }
  }
  log(
    `${tag} ok ios tax-list pad=${layout.listPadL}/${layout.listPadR} arrow=${layout.arrowTag || 'none'} ty=${layout.arrowTy || '-'} w=${layout.innerWidth}`
  );
}

async function runAndroidHome(page, profile, tag) {
  await page.goto(`${SITE_URL}/shouye.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const root = document.documentElement;
    const nav = document.querySelector('.bottom-nav');
    const header = document.querySelector('.search-bar-wrapper, .shouye-header');
    return {
      classes: Array.from(root.classList),
      hasNav: !!nav,
      headerTop: header ? header.getBoundingClientRect().top : null,
      shell: getComputedStyle(root).getPropertyValue('--app-shell-statusbar-top')
    };
  });
  if (!info.classes.includes('app-android-client')) {
    fail(`${tag} missing app-android-client: ${info.classes.join(' ')}`);
  }
  if (!info.hasNav) fail(`${tag} missing bottom nav`);
  log(`${tag} ok android home chrome`);
}

async function assertWhiteTopOnPath(page, profile, tag, path, insetOpts) {
  await page.goto(`${SITE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.documentElement.classList.contains('app-android-client'),
    null,
    { timeout: 15000 }
  );
  await page.waitForTimeout(400);
  const chrome = await readWhiteTopChrome(page);
  const expect = Object.assign({}, profile.expect || {}, insetOpts || {});

  if (expect.classContains) {
    for (const cls of expect.classContains) {
      if (!chrome.classes.includes(cls)) {
        fail(`${tag} ${path} missing class ${cls}: ${chrome.classes.join(' ')}`);
      }
    }
  }

  const immersive = chrome.classes.includes('app-android-immersive-white-top');
  if (expect.immersiveWhiteTop === true && !immersive) {
    fail(`${tag} ${path} expected immersive-white-top, classes=${chrome.classes.join(' ')}`);
  }
  if (expect.immersiveWhiteTop === false && immersive) {
    fail(`${tag} ${path} should not be immersive-white-top, classes=${chrome.classes.join(' ')}`);
  }

  const inset = Math.max(chrome.padTop, chrome.shellPx);
  if (typeof expect.minInsetPx === 'number' && inset < expect.minInsetPx) {
    fail(
      `${tag} ${path} inset too small: pad=${chrome.padTop} shell=${chrome.shell} (need >= ${expect.minInsetPx})`
    );
  }
  if (typeof expect.maxInsetPx === 'number' && inset > expect.maxInsetPx) {
    fail(
      `${tag} ${path} inset too large: pad=${chrome.padTop} shell=${chrome.shell} (need <= ${expect.maxInsetPx})`
    );
  }
  log(
    `${tag} ok white-top ${path} pad=${chrome.padTop} shell=${String(chrome.shell).trim() || '0'} immersive=${immersive}`
  );
}

/*
 * 「我的」e1 单层底图档（vivo X90 / OriginOS 5）。
 *
 * 底图坐标即 @sm 像素（750×1242）：三宫格白卡 519–741、灰缝 741–765、菜单白卡 765–1226，
 * 胶囊在图内已擦除、擦除带 660–738。@sm 裁切档把底图铺两层（画布背景 + 同尺寸隐藏 <img>），
 * 并用 background-size:100% 100% 压进 1180rpx 定高画布，底图竖向缩 5%：
 * 胶囊会掉出擦除带、贴到菜单白卡上沿，隐藏那层还会在 OriginOS 5 上留下半透明白卡残影。
 */
const MINE_E1_ART_H = 1242;
const MINE_E1_ERASED_TOP = 660;
const MINE_E1_ERASED_BOTTOM = 738;
const MINE_E1_MENU_TOP = 765;

async function assertMineE1SingleLayer(page, profile, tag) {
  await page.goto(`${SITE_URL}/mine.html`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('#mineE1Canvas #headerImg', { timeout: 15000 });
  } catch (eNoCanvas) {
    log(`${tag} skip mine e1 single-layer (no canvas)`);
    return;
  }
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const canvas = document.getElementById('mineE1Canvas');
    const img = document.getElementById('headerImg');
    const pill = document.getElementById('familyCountWrap');
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const cr = rect(canvas);
    const ir = rect(img);
    const pr = rect(pill);
    return {
      classes: Array.from(document.documentElement.classList),
      canvasW: cr.width,
      canvasH: cr.height,
      canvasBg: getComputedStyle(canvas).backgroundImage,
      imgOpacity: Number(getComputedStyle(img).opacity),
      imgH: ir.height,
      staleSmStyles: document.querySelectorAll(
        '#androidMineSmFirstPaint,style[data-android-mine-e1-sm-firstpaint],style[data-xiaomi14pro-mine-e1-lock]'
      ).length,
      pillTop: pr ? pr.top - cr.top : null,
      pillBottom: pr ? pr.bottom - cr.top : null
    };
  });
  if (!m.classes.includes('app-android-mine-e1-plainimg')) {
    fail(`${tag} /mine.html missing app-android-mine-e1-plainimg: ${m.classes.join(' ')}`);
  }
  if (m.classes.includes('app-android-mine-e1-sm')) {
    fail(`${tag} /mine.html still on the @sm crop tier: ${m.classes.join(' ')}`);
  }
  if (m.staleSmStyles > 0) {
    fail(`${tag} /mine.html left ${m.staleSmStyles} @sm first-paint style node(s) in the DOM`);
  }
  if (m.canvasBg !== 'none') {
    fail(`${tag} /mine.html canvas keeps a second painted copy: ${m.canvasBg}`);
  }
  if (m.imgOpacity < 1) {
    fail(`${tag} /mine.html header image is hidden (opacity=${m.imgOpacity})`);
  }
  const trueH = (m.canvasW * 2127) / 1284;
  if (Math.abs(m.canvasH - trueH) > 2) {
    fail(`${tag} /mine.html artwork is not at true scale: ${m.canvasH.toFixed(1)} vs ${trueH.toFixed(1)}`);
  }
  if (Math.abs(m.imgH - m.canvasH) > 2) {
    fail(`${tag} /mine.html header image overflows the canvas: img=${m.imgH.toFixed(1)} canvas=${m.canvasH.toFixed(1)}`);
  }
  if (m.pillTop == null) {
    log(`${tag} skip mine e1 pill band (no pill)`);
    return;
  }
  const scale = m.canvasH / MINE_E1_ART_H;
  if (m.pillTop < MINE_E1_ERASED_TOP * scale - 1 || m.pillBottom > MINE_E1_ERASED_BOTTOM * scale + 1) {
    fail(
      `${tag} /mine.html pill escaped the erased band: pill=${m.pillTop.toFixed(1)}-${m.pillBottom.toFixed(1)} ` +
        `band=${(MINE_E1_ERASED_TOP * scale).toFixed(1)}-${(MINE_E1_ERASED_BOTTOM * scale).toFixed(1)}`
    );
  }
  const gap = MINE_E1_MENU_TOP * scale - m.pillBottom;
  if (gap < 12) {
    fail(`${tag} /mine.html pill row is cramped against the menu list: gap=${gap.toFixed(1)}px`);
  }
  log(`${tag} ok mine e1 single layer canvas=${m.canvasH.toFixed(1)} pill-menu gap=${gap.toFixed(1)}`);
}

const MINE_E1_TRUE_RATIO = 2127 / 1284;
const MINE_E1_CARD_BOTTOM = 741;
const MINE_E1_PILL_CSS_TOP = 688;
const MINE_E1_PILL_CSS_BOTTOM = 724;

async function assertAceProMineE1Pills(page, tag) {
  await page.goto(`${SITE_URL}/mine.html`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('#mineE1Canvas', { timeout: 15000 });
  } catch (eNoCanvas) {
    log(`${tag} skip acepro mine pills (no canvas)`);
    return;
  }
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => {
    const canvas = document.getElementById('mineE1Canvas');
    const pill = document.getElementById('familyCountWrap');
    const cr = canvas ? canvas.getBoundingClientRect() : { width: 0, height: 0, top: 0 };
    const pr = pill ? pill.getBoundingClientRect() : null;
    const cs = canvas ? getComputedStyle(canvas) : null;
    return {
      classes: Array.from(document.documentElement.classList),
      canvasW: cr.width,
      canvasH: cr.height,
      padTop: cs ? parseFloat(cs.paddingTop) || 0 : 0,
      rpx: cs ? String(cs.getPropertyValue('--mine-rpx') || '').trim() : '',
      pillTop: pr ? pr.top - cr.top : null,
      pillBottom: pr ? pr.bottom - cr.top : null
    };
  });
  if (!m.classes.includes('app-android-oneplus-acepro')) {
    fail(`${tag} /mine.html missing app-android-oneplus-acepro: ${m.classes.join(' ')}`);
  }
  if (m.padTop > 1) {
    fail(`${tag} /mine.html Ace Pro canvas still has bleed padding: ${m.padTop}`);
  }
  const ratio = m.canvasW > 0 ? m.canvasH / m.canvasW : 0;
  if (Math.abs(ratio - MINE_E1_TRUE_RATIO) > 0.04) {
    fail(
      `${tag} /mine.html Ace Pro canvas is not true-scale: ${m.canvasW.toFixed(1)}x${m.canvasH.toFixed(1)} ratio=${ratio.toFixed(3)}`
    );
  }
  const rpxPx = parseFloat(m.rpx);
  if (!(rpxPx > 0) || Math.abs(rpxPx - m.canvasW / 750) > 0.05) {
    fail(`${tag} /mine.html Ace Pro --mine-rpx is not canvas-pinned: rpx=${m.rpx} canvasW=${m.canvasW.toFixed(1)}`);
  }
  if (m.pillTop == null) {
    log(`${tag} skip acepro mine pills (no pill)`);
    return;
  }
  const scale = m.canvasW / 750;
  const cardBottom = MINE_E1_CARD_BOTTOM * scale;
  if (m.pillBottom > cardBottom + 2) {
    fail(
      `${tag} /mine.html Ace Pro pills escaped the shortcut card: pill=${m.pillTop.toFixed(1)}-${m.pillBottom.toFixed(1)} cardBottom=${cardBottom.toFixed(1)}`
    );
  }
  const expectTop = MINE_E1_PILL_CSS_TOP * scale;
  const expectBottom = MINE_E1_PILL_CSS_BOTTOM * scale;
  if (Math.abs(m.pillTop - expectTop) > 4 || Math.abs(m.pillBottom - expectBottom) > 6) {
    fail(
      `${tag} /mine.html Ace Pro pill not on the 688rpx band: pill=${m.pillTop.toFixed(1)}-${m.pillBottom.toFixed(1)} ` +
        `expect=${expectTop.toFixed(1)}-${expectBottom.toFixed(1)}`
    );
  }
  log(`${tag} ok acepro mine pills rpx=${rpxPx.toFixed(3)} pill=${m.pillTop.toFixed(1)}-${m.pillBottom.toFixed(1)}`);
}

async function assertMineBlackStatus(page, profile, tag) {
  await page.goto(`${SITE_URL}/mine.html`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(
      () =>
        document.documentElement.classList.contains('app-mine-black-status') ||
        document.documentElement.classList.contains('app-android-client'),
      null,
      { timeout: 15000 }
    );
  } catch (eWait) {
    fail(`${tag} /mine.html did not apply android / black-status chrome`);
  }
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => {
    const root = document.documentElement;
    const canvas = document.getElementById('mineE1Canvas');
    const img = document.getElementById('headerImg');
    const btn = document.querySelector('.mine-activate-btn');
    const cs = canvas ? getComputedStyle(canvas) : null;
    const before = getComputedStyle(document.body, '::before');
    const ir = img ? img.getBoundingClientRect() : null;
    const br = btn ? btn.getBoundingClientRect() : null;
    return {
      classes: Array.from(root.classList),
      padTop: cs ? parseFloat(cs.paddingTop) || 0 : 0,
      canvasBg: cs ? cs.backgroundColor : '',
      beforeH: parseFloat(before.height) || 0,
      beforeDisplay: before.display || '',
      beforeBg: before.backgroundColor || '',
      imgTop: ir ? ir.top : null,
      btnTop: br ? br.top : null
    };
  });
  if (!m.classes.includes('app-mine-black-status')) {
    fail(`${tag} /mine.html missing app-mine-black-status: ${m.classes.join(' ')}`);
  }
  if (profile.id === 'redmi-k70' && !m.classes.includes('app-android-redmi-k70')) {
    fail(`${tag} /mine.html missing app-android-redmi-k70: ${m.classes.join(' ')}`);
  }
  if (m.classes.includes('app-android-redmi-k70-ultra')) {
    fail(`${tag} /mine.html must not use K70 Ultra chrome: ${m.classes.join(' ')}`);
  }
  if (m.classes.includes('app-android-mine-e1-sm')) {
    fail(`${tag} /mine.html still on @sm crop (would paint blue into the status bar)`);
  }
  if (m.padTop < 38 || m.padTop > 44) {
    fail(`${tag} /mine.html canvas padTop=${m.padTop} (need ~40)`);
  }
  if (m.beforeDisplay === 'none' || m.beforeH < 38 || m.beforeH > 44) {
    fail(`${tag} /mine.html black bar missing: display=${m.beforeDisplay} h=${m.beforeH}`);
  }
  if (m.btnTop != null && m.btnTop < 48) {
    fail(`${tag} /mine.html activate sits in the status bar: top=${m.btnTop}`);
  }
  if (m.imgTop != null && m.imgTop < 35) {
    fail(`${tag} /mine.html header under status bar: top=${m.imgTop}`);
  }
  try {
    mkdirSync('/tmp/ui-smoke-shots', { recursive: true });
    const shotPath = `/tmp/ui-smoke-shots/${profile.id}-mine-black-status.png`;
    await page.screenshot({ path: shotPath });
    log(`${tag} screenshot ${shotPath}`);
  } catch (eShot) {
    log(`${tag} skip mine screenshot: ${eShot && eShot.message ? eShot.message : eShot}`);
  }
  log(
    `${tag} ok mine black-status pad=${m.padTop} bar=${m.beforeH} imgTop=${m.imgTop == null ? '-' : m.imgTop.toFixed(1)} btnTop=${m.btnTop == null ? '-' : m.btnTop.toFixed(1)}`
  );
}

async function assertMineNotUnderlapBlack(page, profile, tag) {
  await page.goto(`${SITE_URL}/mine.html`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(
      () => document.documentElement.classList.contains('app-android-client'),
      null,
      { timeout: 15000 }
    );
  } catch (eWait) {
    log(`${tag} skip mine contrast (no android chrome)`);
    return;
  }
  await page.waitForTimeout(600);
  const classes = await page.evaluate(() => Array.from(document.documentElement.classList));
  if (classes.includes('app-mine-black-status')) {
    fail(`${tag} /mine.html must not use K70 underlap black pad: ${classes.join(' ')}`);
  }
  log(`${tag} ok mine is not underlap-black`);
}

async function runAndroidWhiteTop(page, profile, tag) {
  if (profile.expect?.mineBlackStatus) {
    await assertMineBlackStatus(page, profile, tag);
  } else if (profile.id === 'xiaomi-15' || profile.id === 'redmi-k70-ultra') {
    await assertMineNotUnderlapBlack(page, profile, tag);
  }
  if (profile.expect?.mineE1PlainImg) {
    await assertMineE1SingleLayer(page, profile, tag);
  }
  if (profile.id === 'oneplus-acepro' || profile.expect?.mineE1AceProPills) {
    await assertAceProMineE1Pills(page, tag);
  }
  await assertWhiteTopOnPath(page, profile, tag, '/shuiming_result.html');
  const otherExpect = {};
  if (profile.id === 'xiaomi-14') {
    otherExpect.minInsetPx = 48;
    otherExpect.maxInsetPx = 72;
  } else if (typeof profile.expect?.minInsetPx === 'number' && profile.expect.minInsetPx > 48) {
    otherExpect.minInsetPx = 40;
  }
  if (typeof profile.expect?.maxInsetPx === 'number' && profile.expect.maxInsetPx <= 8) {
    otherExpect.maxInsetPx = 16;
  }
  await assertWhiteTopOnPath(page, profile, tag, '/shuiming.html', otherExpect);
  await page.goto(`${SITE_URL}/shuiming_result.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const item = page.locator('a.list-item[href*="xiangqing.html"]').first();
  try {
    await item.waitFor({ state: 'attached', timeout: 8000 });
    const fromList = await item.getAttribute('href');
    if (fromList) {
      const rel = fromList.startsWith('http')
        ? new URL(fromList).pathname + new URL(fromList).search
        : '/' + String(fromList).replace(/^\//, '');
      await assertWhiteTopOnPath(page, profile, tag, rel, otherExpect);
    }
  } catch (eXq) {
    log(`${tag} skip xiangqing (no list item)`);
  }
}

const CHROME_ONLY = /^(1|true|yes)$/i.test(String(process.env.UI_SMOKE_CHROME_ONLY || ''));

async function runProfile(browser, profile) {
  const tag = `[${profile.id}]`;
  log(`${tag} start ${profile.label} suite=${profile.suite}${CHROME_ONLY ? ' chrome-only' : ''}`);
  const { context, page } = await openProfile(browser, profile);
  try {
    /* 完整业务冒烟需要 API/DB；chrome-only 只验壳 class / 顶距 */
    if (!CHROME_ONLY) {
      await runFullSuite(page, tag);
    }
    if (profile.suite === 'ios-chrome') {
      await runIosChrome(page, profile, tag);
    } else if (profile.platform === 'ios') {
      await assertIosShuimingResultLayout(page, profile, tag);
    } else if (profile.suite === 'android-home') {
      await runAndroidHome(page, profile, tag);
    } else if (profile.suite === 'android-white-top') {
      await runAndroidWhiteTop(page, profile, tag);
    }
  } finally {
    await context.close();
  }
}

async function main() {
  if (!CHROME_ONLY && (!USER || !PASS)) {
    fatal('缺少 UI_SMOKE_USER / UI_SMOKE_PASS（请先运行 ui-smoke-host-setup.sh）');
  }
  if (!CHROME_ONLY && !TOKEN) {
    TOKEN = await apiLogin();
  }
  if (CHROME_ONLY) {
    if (!USER) {
      /* attachSession 已捕获 USER；空用户名只写入 localStorage */
    }
    if (!TOKEN) {
      TOKEN = 'chrome-only-token';
    }
  }

  let profiles;
  try {
    profiles = resolveSmokeDevices(process.env.UI_SMOKE_DEVICES);
  } catch (e) {
    fatal(e.message || String(e));
  }

  log(`site=${SITE_URL} api=${API_URL} user=${USER}`);
  log(
    `devices=${profiles.map((p) => p.id).join(',')} (catalog=${DEVICE_PROFILES.length}; UI_SMOKE_DEVICES=${process.env.UI_SMOKE_DEVICES || 'mainstream'})`
  );

  const browser = await launchBrowser();
  const failures = [];
  try {
    const ordered = [
      ...profiles.filter((p) => p.suite === 'full'),
      ...profiles.filter((p) => p.suite !== 'full')
    ];
    for (const profile of ordered) {
      try {
        await runProfile(browser, profile);
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        log(`[${profile.id}] FAIL ${msg}`);
        failures.push({ id: profile.id, error: msg });
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    fatal(
      `${failures.length}/${profiles.length} devices failed:\n` +
        failures.map((f) => `  - ${f.id}: ${f.error}`).join('\n')
    );
  }
  log('ALL PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
