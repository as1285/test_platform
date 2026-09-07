/**
 * 国内友好的 IP → 城市展示（ip2region 离线库）。
 * 替代 geoip-lite：后者对大量国内 IP 只有国家、无城市。
 */
'use strict';

var IP2Region = null;
var query = null;

function getQuery() {
  if (query) return query;
  try {
    IP2Region = require('ip2region').default || require('ip2region');
    query = new IP2Region({ disableIpv6: false });
  } catch (e) {
    query = null;
  }
  return query;
}

function cleanPart(v) {
  var s = v != null ? String(v).trim() : '';
  if (!s || s === '0' || s === '内网IP') return '';
  return s;
}

/**
 * @param {string} ip
 * @returns {string}
 */
function cityLabelFromIp(ip) {
  if (!ip) return '—';
  var raw = String(ip).trim();
  if (!raw) return '—';
  if (raw === '::1' || raw === '127.0.0.1') return '本地';

  var q = getQuery();
  if (!q || typeof q.search !== 'function') return '—';

  var hit = null;
  try {
    hit = q.search(raw);
  } catch (e) {
    return '—';
  }
  if (!hit || typeof hit !== 'object') return '—';

  var city = cleanPart(hit.city);
  var province = cleanPart(hit.province);
  var country = cleanPart(hit.country);
  var isp = cleanPart(hit.isp);

  /* 纯内网 */
  if (
    (String(hit.city || '').trim() === '内网IP' || String(hit.isp || '').trim() === '内网IP') &&
    !city &&
    !province &&
    !country
  ) {
    return '本地';
  }

  if (country === '中国' || !country) {
    if (city) return city;
    if (province) return province;
    if (country === '中国') return isp ? '中国（' + isp + '）' : '中国';
    return isp || '—';
  }

  var parts = [];
  if (city) parts.push(city);
  else if (province) parts.push(province);
  if (country) parts.push(country);
  return parts.join(' · ') || '—';
}

module.exports = {
  cityLabelFromIp: cityLabelFromIp
};
