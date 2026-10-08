'use strict';

/**
 * 同库双域名：注册站点归因（与推广渠道 sales_promo_channel 正交）。
 * - getjob68：新主站 getjob68.club
 * - lkj：旧站 lkj.qiyun888.top / 旧入口 IP
 * - unknown：无法识别
 */

var SITE_GETJOB68 = 'getjob68';
var SITE_LKJ = 'lkj';
var SITE_UNKNOWN = 'unknown';
var SITE_ALL = 'all';

var LABEL = {
  getjob68: '新站 getjob68',
  lkj: '旧站 lkj',
  unknown: '未知站点'
};

function envText(name) {
  return String(process.env[name] || '').trim();
}

/** 北京日历切换日 YYYY-MM-DD；该日之前注册一律算 lkj */
function siteCutoverYmd() {
  var raw = envText('SITE_CUTOVER_YMD') || '2026-10-08';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '2026-10-08';
  return raw;
}

function normalizeHost(raw) {
  var h = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase()
    .split(',')[0]
    .trim();
  if (!h) return '';
  /* 去掉端口 */
  if (h.indexOf(':') >= 0 && h.indexOf(']') < 0) {
    h = h.split(':')[0];
  }
  return h.replace(/\.$/, '');
}

function requestHost(req) {
  if (!req || !req.headers) return '';
  return normalizeHost(req.headers['x-forwarded-host'] || req.headers.host || '');
}

function siteKeyFromHost(host) {
  var h = normalizeHost(host);
  if (!h) return SITE_UNKNOWN;
  if (h === 'getjob68.club' || h === 'www.getjob68.club' || /(^|\.)getjob68\.club$/.test(h)) {
    return SITE_GETJOB68;
  }
  if (
    h === 'lkj.qiyun888.top' ||
    h === 'www.lkj.qiyun888.top' ||
    /(^|\.)lkj\.qiyun888\.top$/.test(h) ||
    h === '103.106.188.166'
  ) {
    return SITE_LKJ;
  }
  return SITE_UNKNOWN;
}

/** 旧域名管理后台：强制只能看 lkj */
function isLegacyAdminHost(host) {
  return siteKeyFromHost(host) === SITE_LKJ;
}

function normalizeSiteFilter(raw) {
  var s = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase();
  if (!s || s === SITE_ALL || s === '*') return SITE_ALL;
  if (s === SITE_GETJOB68 || s === 'new' || s === 'main') return SITE_GETJOB68;
  if (s === SITE_LKJ || s === 'legacy' || s === 'old') return SITE_LKJ;
  if (s === SITE_UNKNOWN) return SITE_UNKNOWN;
  return SITE_ALL;
}

/**
 * 管理端站点范围：旧域名 Host 强制 lkj；新站默认全部，可按 query.site 筛选。
 * @returns {{ site: string, locked: boolean, host: string, label: string, allow_filter: boolean }}
 */
function resolveAdminSiteScope(req, querySite) {
  var host = requestHost(req);
  var locked = isLegacyAdminHost(host);
  if (locked) {
    return {
      site: SITE_LKJ,
      locked: true,
      host: host,
      label: LABEL[SITE_LKJ],
      allow_filter: false
    };
  }
  var site = normalizeSiteFilter(querySite);
  return {
    site: site,
    locked: false,
    host: host,
    label: site === SITE_ALL ? '全部站点' : LABEL[site] || site,
    allow_filter: true
  };
}

function siteLabel(site) {
  var s = String(site || '').trim().toLowerCase();
  return LABEL[s] || (s ? s : '—');
}

/**
 * 追加 users.register_site 条件。site=all 时不追加。
 * @param {string[]} whereClauses
 * @param {any[]} params
 * @param {string} site SITE_* or all
 * @param {string} [alias='users']
 */
function appendRegisterSiteFilter(whereClauses, params, site, alias) {
  var s = normalizeSiteFilter(site);
  if (s === SITE_ALL) return;
  var col = (alias || 'users') + '.register_site';
  if (s === SITE_UNKNOWN) {
    whereClauses.push(
      '(' + col + " IS NULL OR TRIM(IFNULL(" + col + ", '')) = '' OR " + col + " = 'unknown')"
    );
    return;
  }
  whereClauses.push(col + ' = ?');
  params.push(s);
}

/**
 * 新站 getjob68 注册用户仅最高管理员（username=admin）可见。
 * 子管理员 / 全量运营账号列表与明细均不可见（与 abc URL-only 专属可见同级）。
 */
function isGetjob68ViewerAdmin(admin) {
  var u = String((admin && admin.username) || '')
    .trim()
    .toLowerCase();
  return u === 'admin';
}

function appendExcludeGetjob68UnlessViewer(whereClauses, params, admin, alias) {
  if (!whereClauses || !admin) return;
  if (isGetjob68ViewerAdmin(admin)) return;
  var col = (alias || 'users') + '.register_site';
  whereClauses.push("(IFNULL(" + col + ", '') <> '" + SITE_GETJOB68 + "')");
}

function siteFromRequest(req) {
  var host = requestHost(req);
  return {
    host: host,
    site: siteKeyFromHost(host)
  };
}

/**
 * 新站支付价与渠道脱钩：不默认套用任何推广渠道价。
 * 价目见 sku_catalog_prices_getjob68_json。
 */
function defaultChannelPricesIdForSite(site) {
  return '';
}

module.exports = {
  SITE_GETJOB68: SITE_GETJOB68,
  SITE_LKJ: SITE_LKJ,
  SITE_UNKNOWN: SITE_UNKNOWN,
  SITE_ALL: SITE_ALL,
  siteCutoverYmd: siteCutoverYmd,
  normalizeHost: normalizeHost,
  requestHost: requestHost,
  siteKeyFromHost: siteKeyFromHost,
  isLegacyAdminHost: isLegacyAdminHost,
  normalizeSiteFilter: normalizeSiteFilter,
  resolveAdminSiteScope: resolveAdminSiteScope,
  siteLabel: siteLabel,
  appendRegisterSiteFilter: appendRegisterSiteFilter,
  isGetjob68ViewerAdmin: isGetjob68ViewerAdmin,
  appendExcludeGetjob68UnlessViewer: appendExcludeGetjob68UnlessViewer,
  siteFromRequest: siteFromRequest,
  defaultChannelPricesIdForSite: defaultChannelPricesIdForSite
};
