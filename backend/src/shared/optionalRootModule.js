/**
 * 软加载 backend 根目录可选模块：缺失时返回 stub，避免整站因监控类文件漏拷而起不来。
 * 仅吞 MODULE_NOT_FOUND；其它错误仍抛出。
 */
'use strict';

function createNoopPurchaseUxMonitor() {
  return {
    recordFromTrack: function () {},
    schedulePurchaseUxMonitor: function () {
      console.warn('[purchase-ux] disabled (module missing or failed to load)');
    },
    evaluateAlert: function () {
      return { shouldAlert: false, reason: 'stub' };
    },
    isAlertTrackAction: function () {
      return false;
    },
    ALERT_EVENT_KEYS: []
  };
}

/**
 * @param {string} modulePath require 路径（相对调用方）
 * @param {object} stub 缺失时返回的对象
 * @param {string} [label] 日志名
 */
function requireOptional(modulePath, stub, label) {
  try {
    return require(modulePath);
  } catch (e) {
    if (e && e.code === 'MODULE_NOT_FOUND') {
      console.error(
        '[boot] optional module missing, using stub:',
        label || modulePath,
        String((e && e.message) || e)
      );
      return stub;
    }
    throw e;
  }
}

function requireOptionalPurchaseUxMonitor() {
  return requireOptional(
    '../../purchaseUxMonitor',
    createNoopPurchaseUxMonitor(),
    'purchaseUxMonitor'
  );
}

module.exports = {
  requireOptional: requireOptional,
  createNoopPurchaseUxMonitor: createNoopPurchaseUxMonitor,
  requireOptionalPurchaseUxMonitor: requireOptionalPurchaseUxMonitor
};
