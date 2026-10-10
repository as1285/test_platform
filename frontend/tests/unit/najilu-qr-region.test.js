import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const moduleCode = readFileSync(
  resolve(__dirname, '../../public/js/admin/modules/najilu-qr.js'),
  'utf8'
);

describe('完税二维码默认提取框', () => {
  beforeEach(() => {
    delete window.AdminModules;
    // eslint-disable-next-line no-eval
    eval(moduleCode);
  });

  it('整块模式在二维码四周扩边并重点增加验证码下方空间', () => {
    const mod = window.AdminModules['najilu-qr'];
    const region = mod._regionFromQrBox(
      { x: 800, y: 40, width: 180, height: 180 },
      'block',
      1240,
      1754
    );

    expect(region.sw).toBe(223);
    expect(region.sh).toBe(343);
    expect(region.sx).toBe(779);
    expect(region.sy).toBe(31);
    expect(region.sx).toBeLessThan(800);
    expect(region.sy + region.sh).toBeGreaterThan(40 + 180 * (310 / 185));
  });

  it('固定坐标兜底框同步扩大且不会越出图片', () => {
    const mod = window.AdminModules['najilu-qr'];
    expect(mod._regionForMode('block', 1240, 1754)).toEqual({
      sx: 961,
      sy: 33,
      sw: 229,
      sh: 352
    });

    const edge = mod._regionFromQrBox(
      { x: 1100, y: 40, width: 180, height: 180 },
      'block',
      1240,
      1754
    );
    expect(edge.sx + edge.sw).toBe(1240);
  });

  it('已裁好的码图不再按完整证书右上角回退，避免裁出白图', () => {
    const mod = window.AdminModules['najilu-qr'];
    expect(mod._looksLikeQrPatch(474, 519)).toBe(true);
    expect(mod._looksLikeQrPatch(87, 136)).toBe(true);
    expect(mod._looksLikeQrPatch(1240, 1754)).toBe(false);
    const region = mod._locateQrRegion({ naturalWidth: 474, naturalHeight: 519 }, 'block');
    expect(region).toEqual({ sx: 0, sy: 0, sw: 474, sh: 519 });
  });
});

const userModuleCode = readFileSync(
  resolve(__dirname, '../../public/js/najilu-qr-user.js'),
  'utf8'
);

describe('C 端完税二维码未付费水印', () => {
  beforeEach(() => {
    delete window.NajiluQrUser;
    // eslint-disable-next-line no-eval
    eval(userModuleCode);
  });

  it('导出水印绘制，缺画布时不抛错', () => {
    const user = window.NajiluQrUser;
    expect(typeof user._drawDemoWatermark).toBe('function');
    expect(function () {
      user._drawDemoWatermark(null, 100, 100);
    }).not.toThrow();
  });

  it('账号已锁定验证码时不会被旧开具记录盖回去', () => {
    expect(userModuleCode).toContain('账号已锁定验证码时不要被旧开具记录盖回去');
    expect(userModuleCode).toContain('accountOverride.query_code');
  });

  it('与管理端使用同一套提取框', () => {
    const user = window.NajiluQrUser;
    expect(user._regionForMode('block', 1240, 1754)).toEqual({
      sx: 961,
      sy: 33,
      sw: 229,
      sh: 352
    });
    expect(user._looksLikeQrPatch(474, 519)).toBe(true);
    expect(user._looksLikeQrPatch(1240, 1754)).toBe(false);
  });
});

describe('C 端完税二维码使用说明', () => {
  const html = readFileSync(resolve(__dirname, '../../najilu_qr.html'), 'utf8');

  it('页内有分步用法和常见问题', () => {
    expect(html).toContain('id="cardNajiluQrGuide"');
    expect(html).toContain('怎么用（约 1 分钟）');
    expect(html).toContain('准备一张完整完税证明图');
    expect(html).toContain('去纳税记录开具里重新生成');
    expect(html).toContain('id="cardNajiluQrFaq"');
    expect(html).toContain('必须先付款才能用吗');
    expect(html).toContain('自动识别框偏了怎么办');
    expect(html).toContain('替换完成后可用官方 APP 扫码查验');
    expect(html).toContain('替换完成后能扫码查验吗');
  });
});

describe('C 端完税二维码入口位置', () => {
  const consultHtml = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
  const purchaseHtml = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');
  const najiluQrHtml = readFileSync(resolve(__dirname, '../../najilu_qr.html'), 'utf8');
  const najiluHtml = readFileSync(resolve(__dirname, '../../najilu.html'), 'utf8');

  it('入口在我要咨询增值服务，不在支付页折叠区', () => {
    expect(consultHtml).toContain('id="najiluQrEntryCard"');
    expect(consultHtml).toContain('najilu_qr.html?from=consult');
    expect(consultHtml).toContain('完税二维码替换');
    expect(purchaseHtml).not.toContain('id="cardNajiluQr"');
    expect(purchaseHtml).not.toContain('btnNajiluQrEntry');
    expect(najiluQrHtml).toContain('consult.html?tab=products');
  });

  it('纳税记录开具页顶栏不再常驻替换二维码入口', () => {
    expect(najiluHtml).not.toContain('id="najiluQrReplaceLink"');
    expect(najiluHtml).not.toContain('>替换二维码</a>');
    expect(najiluHtml).toContain('.header-qr-replace');
    expect(najiluHtml).toContain('display: none !important');
    const najiluJs = readFileSync(resolve(__dirname, '../../public/js/najilu.js'), 'utf8');
    expect(najiluJs).toContain('najilu_qr.html?from=');
    expect(najiluJs).toContain('showFirstGenerateQrGuide');
    expect(najiluJs).toContain('function removeQrReplaceHeaderLink');
    expect(najiluJs).not.toContain('najilu-qr-guide-root');
  });
});

describe('完税二维码使用统计：明细默认折叠', () => {
  beforeEach(() => {
    delete window.AdminModules;
    document.body.innerHTML = '<div id="najiluQrStatsMount"></div>';
    // eslint-disable-next-line no-eval
    eval(moduleCode);
  });

  it('最近浏览和使用用户默认折叠，按日明细仍展开', () => {
    const mod = window.AdminModules['najilu-qr'];
    mod.renderStats({
      period: { label: '最近 7 天' },
      summary: {
        page_views: 1,
        page_view_users: 1,
        entry_clicks: 0,
        entry_click_users: 0,
        unlocked_users: 0,
        locked_qr_users: 0,
        paid_orders: 0,
        paid_users: 0,
        pending_orders: 0,
        gmv: '0.00',
        saves: 0,
        save_users: 0,
        saves_demo: 0,
        saves_unlocked: 0
      },
      usage_users: [
        {
          last_used_at: '2026-09-09T10:00:00.000Z',
          username: 'u2',
          real_name: '李四',
          page_views: 2,
          entry_clicks: 1
        }
      ],
      recent_views: [
        {
          created_at: '2026-09-09T10:00:00.000Z',
          username: 'u1',
          real_name: '张三',
          event_label: '页面浏览'
        }
      ],
      daily: [{ day: '2026-09-09', page_views: 1 }]
    });
    const mount = document.getElementById('najiluQrStatsMount');
    const views = mount.querySelector('.najilu-qr-recent-views-details');
    const usage = mount.querySelector('.najilu-qr-usage-users-details');
    expect(views).toBeTruthy();
    expect(views.open).toBe(false);
    expect(views.querySelector('summary').textContent).toBe('最近浏览（最多 50）');
    expect(views.textContent).toContain('u1');
    expect(usage).toBeTruthy();
    expect(usage.open).toBe(false);
    expect(usage.querySelector('summary').textContent).toBe('使用用户（1，最多 200）');
    expect(usage.textContent).toContain('u2');
    expect(mount.innerHTML).toContain('share-kpi-section-label">按日明细');
  });
});

describe('C 端完税二维码返回路径', () => {
  beforeEach(() => {
    delete window.NajiluQrUser;
    // eslint-disable-next-line no-eval
    eval(userModuleCode);
  });

  it('从纳税记录开具引导进入时返回 najilu.html，而不是裸 from 标记', () => {
    const resolve = window.NajiluQrUser._resolveBackHref;
    expect(resolve('najilu_generate')).toBe('najilu.html');
    expect(resolve('najilu')).toBe('najilu.html');
    expect(resolve('purchase')).toBe('purchase.html');
    expect(resolve('consult')).toBe('consult.html?tab=products');
    expect(resolve('')).toBe('consult.html?tab=products');
    expect(resolve('najilu_generate')).not.toBe('najilu_generate');
  });

  it('拒绝把未知标记当路径，避免返回 404', () => {
    const resolve = window.NajiluQrUser._resolveBackHref;
    expect(resolve('not-a-page')).toBe('consult.html?tab=products');
    expect(resolve('../evil.html')).toBe('consult.html?tab=products');
    expect(resolve('najilu.html')).toBe('najilu.html');
    expect(resolve('purchase.html?from=mine')).toBe('purchase.html?from=mine');
  });
});
