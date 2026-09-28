/**
 * 核心功能调查文件校验 + 取 explain。
 * 浏览器：window.SurveyCatalog
 * Node 单测：require('./validate')
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SurveyCatalog = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var SENTIMENTS = { expensive: 1, fair: 1, cheap: 1 };
  var SATISFACTION = { good: 1, ok: 1, bad: 1 };
  var REQUIRED_KEYS = ['id', 'title', 'page', 'phase', 'trigger', 'price', 'usage', 'concerns'];

  function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
  }

  function isPositiveIntArray(arr) {
    return Array.isArray(arr) && arr.length > 0 && arr.every(function (n) {
      return typeof n === 'number' && n > 0 && Math.floor(n) === n;
    });
  }

  function optionIds(list, allowed) {
    if (!Array.isArray(list) || !list.length) return '选项不能为空';
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (!o || !isNonEmptyString(o.id) || !isNonEmptyString(o.label)) {
        return '选项须有 id / label';
      }
      if (allowed && !allowed[o.id]) return '非法选项 id: ' + o.id;
      if (seen[o.id]) return '重复选项 id: ' + o.id;
      seen[o.id] = 1;
    }
    return null;
  }

  function validateFeature(doc) {
    var errors = [];
    if (!doc || typeof doc !== 'object') return ['文档不是对象'];
    REQUIRED_KEYS.forEach(function (k) {
      if (doc[k] == null) errors.push('缺少字段 ' + k);
    });
    if (!isNonEmptyString(doc.id)) errors.push('id 须非空');
    if (!isNonEmptyString(doc.title)) errors.push('title 须非空');
    if (!isNonEmptyString(doc.page)) errors.push('page 须非空');
    if (doc.phase !== 1 && doc.phase !== 2 && doc.phase !== 3) {
      errors.push('phase 须为 1 / 2 / 3');
    }
    if (!doc.trigger || !doc.trigger.type) errors.push('trigger.type 必填');
    if (doc.trigger && !doc.trigger.once_per_user) {
      errors.push('须 once_per_user，避免重复打扰');
    }

    var price = doc.price || {};
    if (price.enabled) {
      var pErr = optionIds(price.options, SENTIMENTS);
      if (pErr) errors.push('price.options: ' + pErr);
      if (!isPositiveIntArray(price.chips_expensive)) {
        errors.push('chips_expensive 须为正整数数组');
      }
      if (!isPositiveIntArray(price.chips_cheap)) {
        errors.push('chips_cheap 须为正整数数组');
      }
    }

    var usage = doc.usage || {};
    var sErr = optionIds(usage.satisfaction, SATISFACTION);
    if (sErr) errors.push('usage.satisfaction: ' + sErr);
    var iErr = optionIds(usage.improve);
    if (iErr) errors.push('usage.improve: ' + iErr);

    if (!Array.isArray(doc.concerns) || doc.concerns.length < 2) {
      errors.push('concerns 至少 2 条');
    } else {
      var seen = {};
      doc.concerns.forEach(function (c, idx) {
        if (!c || !isNonEmptyString(c.id) || !isNonEmptyString(c.label)) {
          errors.push('concerns[' + idx + '] 须有 id / label');
          return;
        }
        if (seen[c.id]) errors.push('重复 concern id: ' + c.id);
        seen[c.id] = 1;
        if (!isNonEmptyString(c.explain) || c.explain.trim().length < 20) {
          errors.push('concerns.' + c.id + ' 的 explain 须诚实且不少于约 20 字');
        }
        if (/正式证明|官方出具|等同于税务局|等同于银行流水/.test(c.explain)) {
          errors.push('concerns.' + c.id + ' 的 explain 不得把演示说成官方材料');
        }
      });
    }

    if (doc.suggestion && doc.suggestion.enabled) {
      if (doc.suggestion.max > 500) errors.push('suggestion.max 不得超过 500');
    }
    return errors;
  }

  function getExplain(doc, concernId) {
    if (!doc || !Array.isArray(doc.concerns)) return '';
    for (var i = 0; i < doc.concerns.length; i++) {
      if (doc.concerns[i].id === concernId) return String(doc.concerns[i].explain || '').trim();
    }
    return '';
  }

  function validateIndex(index, featuresById) {
    var errors = [];
    if (!index || !Array.isArray(index.features) || !index.features.length) {
      return ['index.features 不能为空'];
    }
    var seen = {};
    index.features.forEach(function (f) {
      if (!f.id || seen[f.id]) errors.push('index 重复或空 id: ' + (f.id || ''));
      seen[f.id] = 1;
      if (!featuresById || !featuresById[f.id]) {
        errors.push('缺少调查文件: ' + f.id);
      }
    });
    return errors;
  }

  return {
    validateFeature: validateFeature,
    getExplain: getExplain,
    validateIndex: validateIndex,
    SENTIMENTS: SENTIMENTS,
    SATISFACTION: SATISFACTION
  };
});
