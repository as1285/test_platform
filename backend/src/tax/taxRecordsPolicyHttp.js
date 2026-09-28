/**
 * 个税记录策略公开接口：咨询页读取是否允许同月多条。
 */
'use strict';

const { getPoolOrNull } = require('../shared/db');
const policy = require('./taxRecordsPolicy');

async function loadTaxRecordsPolicy() {
  var out = policy.defaultTaxRecordsPolicy();
  var pool = getPoolOrNull();
  if (!pool) return out;
  try {
    const [rows] = await pool.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [policy.SETTING_KEY_TAX_RECORDS_POLICY]
    );
    if (rows.length && rows[0].setting_value) {
      out = policy.normalizeTaxRecordsPolicy(JSON.parse(String(rows[0].setting_value)));
    }
  } catch (e) {
    /* 未配置或表未就绪时用默认关闭 */
  }
  return out;
}

async function handlePublicTaxRecordsPolicy(req, res) {
  try {
    var data = await loadTaxRecordsPolicy();
    return res.json({ code: 200, data: data });
  } catch (e) {
    console.error('[tax-records-policy] public', e);
    return res.json({ code: 200, data: policy.defaultTaxRecordsPolicy() });
  }
}

function getHandlers() {
  return { handlePublicTaxRecordsPolicy: handlePublicTaxRecordsPolicy };
}

module.exports = {
  loadTaxRecordsPolicy: loadTaxRecordsPolicy,
  handlePublicTaxRecordsPolicy: handlePublicTaxRecordsPolicy,
  getHandlers: getHandlers
};
