/**
 * 用户敏感字段掩码（从 legacy/monolith 抽取，便于单测）
 */
'use strict';

function maskEmailAddress(email) {
  var e = String(email || '').trim();
  var at = e.indexOf('@');
  if (at <= 0) return '***';
  var local = e.substring(0, at);
  var domain = e.substring(at + 1);
  var show = local.length <= 2 ? local.charAt(0) + '*' : local.substring(0, 2) + '***';
  return show + '@' + domain;
}

function maskBankCardNo(cardNo) {
  var d = String(cardNo || '').replace(/\D/g, '');
  if (!d) return '—';
  if (d.length < 8) return '****';
  return d.slice(0, 4) + ' **** ' + d.slice(-4);
}

function maskBankCardNoShort(cardNo) {
  var d = String(cardNo || '').replace(/\D/g, '');
  if (!d) return '—';
  if (d.length < 4) return '****';
  var tail = d.slice(-4);
  var prefix = d.slice(0, -4);
  if (d.length <= 16) {
    var parts = [];
    for (var i = 0; i < prefix.length; i += 4) {
      parts.push('****');
    }
    parts.push(tail);
    return parts.join(' ');
  }
  var groups = [];
  var j = 0;
  while (j + 4 <= prefix.length - 3) {
    groups.push('****');
    j += 4;
  }
  groups.push('***' + tail.charAt(0));
  var tailRest = tail.slice(1);
  if (tailRest) {
    groups.push(tailRest);
  }
  return groups.join(' ');
}

module.exports = {
  maskEmailAddress: maskEmailAddress,
  maskBankCardNo: maskBankCardNo,
  maskBankCardNoShort: maskBankCardNoShort
};
