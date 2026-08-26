/**
 * 管理台「机型」页：把 UI 兼容目录与 user_devices 对账。
 */
const { getPool } = require('../shared/db');
const catalog = require('./uiCompatCatalog');

function parseDetail(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  var s = String(raw).trim();
  if (!s) return null;
  try {
    var o = JSON.parse(s);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch (e) {
    return null;
  }
}

function deviceBlob(row) {
  var d = parseDetail(row && row.device_detail_json);
  var parts = [row && row.user_agent_short];
  if (d) {
    parts.push(d.user_agent, d.ua, d.model, d.device_model, d.brand, d.manufacturer, d.platform);
  }
  return parts
    .filter(function (x) {
      return x != null && String(x).trim() !== '';
    })
    .join(' ');
}

function classifyOs(blob) {
  var s = String(blob || '');
  if (/iPhone|iPad|iPod/i.test(s)) return 'ios';
  if (/Android|HarmonyOS|OpenHarmony|ArkWeb|HMSCore|HUAWEI|Huawei|HONOR|Harmony/i.test(s)) {
    return 'android';
  }
  return 'other';
}

function liveModelLabel(blob, os, detail) {
  if (detail) {
    var model = String(detail.model || detail.device_model || '').trim();
    var brand = String(detail.brand || detail.manufacturer || '').trim();
    if (model) return brand && brand.toLowerCase() !== model.toLowerCase() ? brand + ' ' + model : model;
  }
  var ua = String(blob || '');
  if (os === 'ios') {
    if (/iPad/i.test(ua)) return 'iPad';
    return 'iPhone';
  }
  var dm = ua.match(/Android\s+[\d._]+;\s*([^);]+)/i);
  if (dm) {
    var extracted = dm[1].replace(/\s+Build\/.*$/i, '').trim();
    if (extracted && !/^[a-z]{2}(?:-[a-z]{2})?$/i.test(extracted) && !/^wv$/i.test(extracted)) {
      return extracted;
    }
  }
  if (os === 'android') return 'Android';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'Mac';
  return '未知机型';
}

function slugLabel(s) {
  return (
    String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 80) || 'unknown'
  );
}

function emptyUserSet() {
  return Object.create(null);
}

function addUser(set, username) {
  var u = String(username || '').trim();
  if (!u) return;
  set[u] = 1;
}

function countUsers(set) {
  return Object.keys(set).length;
}

function serializeIssue(issue) {
  return {
    page: issue.page,
    page_label: catalog.pageLabel(issue.page),
    title: issue.title,
    summary: issue.summary,
    since: issue.since || ''
  };
}

function matchSpecificModels(blob) {
  var hit = [];
  var models = catalog.listCatalogModels();
  for (var i = 0; i < models.length; i++) {
    var m = models[i];
    if (m.common) continue;
    if (catalog.modelMatchesBlob(m, blob)) hit.push(m);
  }
  return hit;
}

/** 纯函数：目录 + 设备行 → 机型页报表（单测用） */
function buildDeviceCompatReport(rows) {
  var pages = catalog.listPageDefs();
  var models = catalog.listCatalogModels();
  var stats = catalog.catalogStats();

  var usersIos = emptyUserSet();
  var usersAndroid = emptyUserSet();
  var usersOther = emptyUserSet();
  var usersAll = emptyUserSet();
  var usersMatched = emptyUserSet();

  var deviceCounts = { ios: 0, android: 0, other: 0, total: 0 };

  var modelState = Object.create(null);
  models.forEach(function (m) {
    modelState[m.id] = {
      def: m,
      users: emptyUserSet(),
      device_count: 0,
      pageUsers: Object.create(null)
    };
    pages.forEach(function (p) {
      modelState[m.id].pageUsers[p.key] = emptyUserSet();
    });
  });

  var unmatchedMap = Object.create(null);

  (rows || []).forEach(function (row) {
    var blob = deviceBlob(row);
    var detail = parseDetail(row && row.device_detail_json);
    var os = classifyOs(blob);
    var username = row && row.username;
    addUser(usersAll, username);
    if (os === 'ios') {
      addUser(usersIos, username);
      deviceCounts.ios += 1;
    } else if (os === 'android') {
      addUser(usersAndroid, username);
      deviceCounts.android += 1;
    } else {
      addUser(usersOther, username);
      deviceCounts.other += 1;
    }
    deviceCounts.total += 1;

    var hits = matchSpecificModels(blob);
    if (os === 'ios' && modelState['ios-common']) {
      addUser(modelState['ios-common'].users, username);
      modelState['ios-common'].device_count += 1;
    }
    if (os === 'android' && modelState['android-common']) {
      addUser(modelState['android-common'].users, username);
      modelState['android-common'].device_count += 1;
    }

    if (hits.length) {
      addUser(usersMatched, username);
      hits.forEach(function (m) {
        var st = modelState[m.id];
        if (!st) return;
        addUser(st.users, username);
        st.device_count += 1;
        (m.issues || []).forEach(function (issue) {
          if (st.pageUsers[issue.page]) addUser(st.pageUsers[issue.page], username);
        });
      });
    } else if (os === 'ios' || os === 'android') {
      var label = liveModelLabel(blob, os, detail);
      var key = os + ':' + slugLabel(label);
      if (!unmatchedMap[key]) {
        unmatchedMap[key] = {
          key: key,
          os_key: os,
          label: label,
          users: emptyUserSet(),
          device_count: 0
        };
      }
      addUser(unmatchedMap[key].users, username);
      unmatchedMap[key].device_count += 1;
    }
  });

  var pageCompare = pages.map(function (p) {
    var iosIssues = 0;
    var androidIssues = 0;
    models.forEach(function (m) {
      var onPage = (m.issues || []).filter(function (it) {
        return it.page === p.key;
      });
      if (!onPage.length) return;
      if (m.platform === 'ios') iosIssues += onPage.length;
      if (m.platform === 'android') androidIssues += onPage.length;
    });
    return {
      page: p.key,
      label: p.label,
      ios_issues: iosIssues,
      android_issues: androidIssues,
      /* 页面对比按系统人数：Safari 常无型号码，精确匹配会把苹果侧刷成 0 */
      ios_users: iosIssues > 0 ? countUsers(usersIos) : 0,
      android_users: androidIssues > 0 ? countUsers(usersAndroid) : 0
    };
  });

  var modelRows = models.map(function (m) {
    var st = modelState[m.id];
    var issues = (m.issues || []).map(serializeIssue);
    var pageSet = Object.create(null);
    issues.forEach(function (it) {
      pageSet[it.page] = 1;
    });
    return {
      id: m.id,
      platform: m.platform,
      family: m.family,
      label: m.label,
      common: !!m.common,
      user_count: countUsers(st.users),
      device_count: st.device_count,
      issue_count: issues.length,
      pages: Object.keys(pageSet),
      issues: issues
    };
  });

  var unmatched = Object.keys(unmatchedMap)
    .map(function (k) {
      var u = unmatchedMap[k];
      return {
        key: u.key,
        os_key: u.os_key,
        label: u.label,
        user_count: countUsers(u.users),
        device_count: u.device_count
      };
    })
    .sort(function (a, b) {
      return b.user_count - a.user_count || b.device_count - a.device_count;
    })
    .slice(0, 40);

  return {
    range_label: '2026-05 ~ 2026-08',
    summary: {
      users_total: countUsers(usersAll),
      users_ios: countUsers(usersIos),
      users_android: countUsers(usersAndroid),
      users_other: countUsers(usersOther),
      devices_total: deviceCounts.total,
      devices_ios: deviceCounts.ios,
      devices_android: deviceCounts.android,
      catalog_models: stats.catalog_models,
      catalog_issues: stats.catalog_issues,
      matched_users: countUsers(usersMatched),
      unmatched_models: unmatched.length
    },
    pages: pages,
    page_compare: pageCompare,
    models: modelRows,
    unmatched: unmatched
  };
}

async function handleAdminAnalyticsDevices(req, res) {
  try {
    var pool = getPool();
    const [rows] = await pool.query(
      'SELECT username, user_agent_short, device_detail_json FROM user_devices'
    );
    return res.json({ code: 200, data: buildDeviceCompatReport(rows || []) });
  } catch (e) {
    console.error('[analytics/devices]', e);
    return res.status(500).json({ code: 500, msg: String(e.message || e) });
  }
}

function getHandlers() {
  return { handleAdminAnalyticsDevices: handleAdminAnalyticsDevices };
}

module.exports = {
  getHandlers: getHandlers,
  buildDeviceCompatReport: buildDeviceCompatReport,
  classifyOs: classifyOs,
  deviceBlob: deviceBlob
};
