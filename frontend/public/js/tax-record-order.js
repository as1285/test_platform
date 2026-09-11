/**
 * 同月个税记录调序：判断能否上移/下移（列表已按服务端顺序）。
 */
(function (root) {
  function monthKey(r) {
    return String(r && r.year != null ? r.year : '') + '-' + String(r && r.month != null ? r.month : '');
  }

  function groupIndex(records, id) {
    var list = records || [];
    var want = String(id);
    var target = null;
    var i;
    for (i = 0; i < list.length; i++) {
      if (String(list[i].id) === want) {
        target = list[i];
        break;
      }
    }
    if (!target) {
      return { group: [], index: -1, record: null };
    }
    var key = monthKey(target);
    var group = [];
    for (i = 0; i < list.length; i++) {
      if (monthKey(list[i]) === key) {
        group.push(list[i]);
      }
    }
    var index = -1;
    for (i = 0; i < group.length; i++) {
      if (String(group[i].id) === want) {
        index = i;
        break;
      }
    }
    return { group: group, index: index, record: target };
  }

  function moveFlags(records, id) {
    var g = groupIndex(records, id);
    return {
      canUp: g.index > 0,
      canDown: g.index >= 0 && g.index < g.group.length - 1,
      sameMonthCount: g.group.length
    };
  }

  function monthsWithDupes(records) {
    var count = {};
    var list = records || [];
    for (var i = 0; i < list.length; i++) {
      var k = monthKey(list[i]);
      count[k] = (count[k] || 0) + 1;
    }
    return Object.keys(count).filter(function (k) {
      return count[k] > 1;
    });
  }

  root.TaxRecordOrder = {
    monthKey: monthKey,
    moveFlags: moveFlags,
    monthsWithDupes: monthsWithDupes
  };
})(typeof window !== 'undefined' ? window : globalThis);
