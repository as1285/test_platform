'use strict';

/**
 * 安装统计按域名（register_site）拆分/筛选。
 * 与 users.register_site / registerSite.js 对齐：getjob68 | lkj | unknown
 */

var registerSite = require('../shared/registerSite');

/**
 * 埋点表 register_site 条件（site=all 时恒真）。
 * @returns {{ sql: string, params: any[] }}
 */
function trackSiteFilterSql(site, alias) {
  var col = (alias ? String(alias) + '.' : '') + 'register_site';
  var s = registerSite.normalizeSiteFilter(site);
  if (s === registerSite.SITE_ALL) {
    return { sql: '1=1', params: [] };
  }
  if (s === registerSite.SITE_UNKNOWN) {
    return {
      sql:
        '(' +
        col +
        " IS NULL OR TRIM(IFNULL(" +
        col +
        ", '')) = '' OR " +
        col +
        " = 'unknown')",
      params: []
    };
  }
  return { sql: col + ' = ?', params: [s] };
}

function normalizeGroupedSite(raw) {
  var s = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase();
  if (s === registerSite.SITE_GETJOB68 || s === registerSite.SITE_LKJ) return s;
  return registerSite.SITE_UNKNOWN;
}

function emptySiteBucket(site) {
  return {
    site: site,
    label: registerSite.siteLabel(site),
    page_views: 0,
    unique_visitors: 0,
    download_clicks: 0,
    download_uv: 0,
    registered: 0,
    registered_from_install: 0,
    register_rate_pct: null,
    download_rate_pct: null
  };
}

function pctText(n, d) {
  if (!d || d <= 0) return null;
  return (Math.round((n / d) * 1000) / 10).toFixed(1) + '%';
}

/**
 * 合并埋点 + 注册的 by_site 行，固定输出 getjob68 / lkj（有数才带 unknown）。
 */
function mergeBySiteRows(trackRows, regRows, regInstallRows) {
  var map = {};
  [registerSite.SITE_GETJOB68, registerSite.SITE_LKJ, registerSite.SITE_UNKNOWN].forEach(function (k) {
    map[k] = emptySiteBucket(k);
  });
  (trackRows || []).forEach(function (r) {
    var k = normalizeGroupedSite(r.site);
    var b = map[k] || emptySiteBucket(k);
    b.page_views = Number(r.page_views) || 0;
    b.unique_visitors = Number(r.unique_visitors) || 0;
    b.download_clicks = Number(r.download_clicks) || 0;
    b.download_uv = Number(r.download_uv) || 0;
    map[k] = b;
  });
  (regRows || []).forEach(function (r) {
    var k = normalizeGroupedSite(r.site);
    var b = map[k] || emptySiteBucket(k);
    b.registered = Number(r.registered) || 0;
    map[k] = b;
  });
  (regInstallRows || []).forEach(function (r) {
    var k = normalizeGroupedSite(r.site);
    var b = map[k] || emptySiteBucket(k);
    b.registered_from_install = Number(r.registered_from_install) || 0;
    map[k] = b;
  });
  var out = [];
  [registerSite.SITE_GETJOB68, registerSite.SITE_LKJ].forEach(function (k) {
    var b = map[k];
    b.download_rate_pct = pctText(b.download_uv, b.unique_visitors);
    b.register_rate_pct = pctText(b.registered_from_install, b.unique_visitors);
    out.push(b);
  });
  var unk = map[registerSite.SITE_UNKNOWN];
  if (
    unk.page_views ||
    unk.unique_visitors ||
    unk.download_uv ||
    unk.registered ||
    unk.registered_from_install
  ) {
    unk.download_rate_pct = pctText(unk.download_uv, unk.unique_visitors);
    unk.register_rate_pct = pctText(unk.registered_from_install, unk.unique_visitors);
    out.push(unk);
  }
  return out;
}

module.exports = {
  trackSiteFilterSql: trackSiteFilterSql,
  normalizeGroupedSite: normalizeGroupedSite,
  emptySiteBucket: emptySiteBucket,
  mergeBySiteRows: mergeBySiteRows,
  pctText: pctText
};
