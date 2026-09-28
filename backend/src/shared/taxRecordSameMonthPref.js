'use strict';

/**
 * 用户「允许同月多次添加」个税记录。
 * 默认关闭：批量写入后按 年|月|单位|所得子目 自动去重。
 */

function isAllowSameMonthMulti(value) {
  return value === true || value === 1 || value === '1';
}

function shouldAutoDedupeTaxRecords(pref) {
  return !isAllowSameMonthMulti(pref);
}

/** @returns {0|1|null} null 表示请求体未带该字段 */
function parseAllowSameMonthMultiBody(body) {
  if (!body || typeof body !== 'object') {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'allow_same_month_multi')) {
    return null;
  }
  return isAllowSameMonthMulti(body.allow_same_month_multi) ? 1 : 0;
}

module.exports = {
  isAllowSameMonthMulti,
  shouldAutoDedupeTaxRecords,
  parseAllowSameMonthMultiBody
};
