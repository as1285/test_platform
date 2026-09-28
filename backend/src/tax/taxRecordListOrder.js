/**
 * 同月个税记录列表顺序：越小越靠上。
 * 未调过序时 list_order 均为 0，回退到「奖金在后、再按 id」。
 */

function isBonusSubtype(subtype) {
  return String(subtype || '').trim() === '全年一次性奖金收入';
}

function compareSameMonth(a, b) {
  var ao = Number(a && a.list_order) || 0;
  var bo = Number(b && b.list_order) || 0;
  if (ao !== bo) return ao - bo;
  var ab = isBonusSubtype(a && a.income_subtype) ? 1 : 0;
  var bb = isBonusSubtype(b && b.income_subtype) ? 1 : 0;
  if (ab !== bb) return ab - bb;
  return String(a && a.id != null ? a.id : '').localeCompare(String(b && b.id != null ? b.id : ''));
}

/**
 * 在同一年月份组内把 id 上移或下移一格，返回要写入的 list_order。
 */
function planMonthReorder(rows, id, direction) {
  var dir = String(direction || '').toLowerCase();
  if (dir !== 'up' && dir !== 'down') {
    return { ok: false, msg: 'direction 须为 up 或 down' };
  }
  var sorted = (rows || []).slice().sort(compareSameMonth);
  var idx = -1;
  var want = String(id);
  for (var i = 0; i < sorted.length; i++) {
    if (String(sorted[i].id) === want) {
      idx = i;
      break;
    }
  }
  if (idx < 0) {
    return { ok: false, msg: '记录不存在' };
  }
  var swapWith = dir === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= sorted.length) {
    return { ok: false, msg: dir === 'up' ? '已经是同月第一条' : '已经是同月最后一条' };
  }
  var tmp = sorted[idx];
  sorted[idx] = sorted[swapWith];
  sorted[swapWith] = tmp;
  return {
    ok: true,
    updates: sorted.map(function (r, i) {
      return { id: String(r.id), list_order: i };
    })
  };
}

module.exports = {
  isBonusSubtype: isBonusSubtype,
  compareSameMonth: compareSameMonth,
  planMonthReorder: planMonthReorder
};
