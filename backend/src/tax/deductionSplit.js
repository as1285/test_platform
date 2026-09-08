'use strict';

/** sum row money */
function sumRowMoney(r, field) {
  const v = r && r[field];
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

/**
 * 全年一次性奖金 / 解除劳动合同补偿等：单独计税，不得并入工资累计预扣。
 */
function isSeparateTaxIncomeSubtype(sub) {
  const s = String(sub == null ? '' : sub).trim();
  if (!s) return false;
  /* 兼容「全年一次性奖金收入」等文案变体 */
  if (s.indexOf('全年一次性') >= 0 || s.indexOf('年终奖') >= 0) return true;
  if (s.indexOf('解除劳动合同') >= 0 || s.indexOf('裁员补偿') >= 0) return true;
  return false;
}

/**
 * 拆分基本减除费用与专项附加扣除。
 * 本系统把 other_deduction 当作专项附加扣除存储（批量开具写入 specialAdd）；
 * 旧数据可能把专项附加塞进 deduction_fee（>5000 的超出部分）。
 */
function splitBasicAndSpecialAdditionalDeduction(rec) {
  const sub = String((rec && rec.income_subtype) || '').trim();
  if (isSeparateTaxIncomeSubtype(sub)) {
    return { basic: sumRowMoney(rec, 'deduction_fee'), specialAdditional: 0 };
  }
  const df = sumRowMoney(rec, 'deduction_fee');
  const other = sumRowMoney(rec, 'other_deduction');
  if (other > 0) {
    return {
      basic: Math.min(5000, df > 0 ? df : 5000),
      specialAdditional: other
    };
  }
  if (df > 5000) {
    const sadd = Math.max(0, Math.round((df - 5000) * 100) / 100);
    return { basic: Math.round((df - sadd) * 100) / 100, specialAdditional: sadd };
  }
  return { basic: df, specialAdditional: 0 };
}

/**
 * 「累计其他扣除」展示值：若 other_deduction 已映射为专项附加，则返回 0，避免税款计算页出现两个相同金额。
 * 计税仍应单独扣减 raw other_deduction（见 getTaxCalculationData）。
 */
function otherDeductionForDisplay(rec, split) {
  const otherRaw = sumRowMoney(rec, 'other_deduction');
  const sub = String((rec && rec.income_subtype) || '').trim();
  if (isSeparateTaxIncomeSubtype(sub)) {
    return otherRaw;
  }
  const sp = split || splitBasicAndSpecialAdditionalDeduction(rec);
  if (otherRaw > 0 && Math.abs(sp.specialAdditional - otherRaw) < 0.005) {
    return 0;
  }
  return otherRaw;
}

/**
 * 本期明细里的「本期其他扣除」：专项附加不在本期数据展示（对齐官方提示，只在税款计算看）。
 * 返回应展示的其他扣除；专项附加已占用 other_deduction 时为 0。
 */
function periodOtherDeductionForDetail(rec) {
  const sp = splitBasicAndSpecialAdditionalDeduction(rec);
  return otherDeductionForDisplay(rec, sp);
}

/**
 * 累计预扣用的收入：排除奖金/补偿等单独计税记录。
 * periodIncomeFn 可选，默认用 income_this_period 或 income。
 */
function sumCumulativeWageIncome(rows, periodIncomeFn) {
  const incomeOf =
    typeof periodIncomeFn === 'function'
      ? periodIncomeFn
      : function (r) {
          if (r.income_this_period != null && String(r.income_this_period).trim() !== '') {
            return sumRowMoney(r, 'income_this_period');
          }
          return sumRowMoney(r, 'income');
        };
  let total = 0;
  (rows || []).forEach(function (r) {
    if (isSeparateTaxIncomeSubtype(r && r.income_subtype)) return;
    total += incomeOf(r);
  });
  return total;
}

module.exports = {
  sumRowMoney,
  isSeparateTaxIncomeSubtype,
  splitBasicAndSpecialAdditionalDeduction,
  otherDeductionForDisplay,
  periodOtherDeductionForDetail,
  sumCumulativeWageIncome
};
