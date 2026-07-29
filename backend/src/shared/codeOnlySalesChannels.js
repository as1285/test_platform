/**
 * 代理「仅 C 方案」渠道：无支付宝 / 价格 / 其它自助支付，只保留激活码（+ 联系客服）。
 * 渠道名展示：专门A方案 → ID special_a
 */
'use strict';

var CODE_ONLY_SALES_CHANNELS = {
  special_a: true
};

function isCodeOnlySalesChannel(salesCh) {
  var ch = String(salesCh || '')
    .trim()
    .toLowerCase();
  if (!ch) return false;
  return !!CODE_ONLY_SALES_CHANNELS[ch];
}

function listCodeOnlySalesChannels() {
  return Object.keys(CODE_ONLY_SALES_CHANNELS);
}

module.exports = {
  CODE_ONLY_SALES_CHANNELS: CODE_ONLY_SALES_CHANNELS,
  isCodeOnlySalesChannel: isCodeOnlySalesChannel,
  listCodeOnlySalesChannels: listCodeOnlySalesChannels
};
