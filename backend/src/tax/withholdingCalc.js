'use strict';

function roundMoney2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * 工资薪金累计预扣：本期应预扣预缴税额
 * = 累计应纳税额 − 累计减免税额 − 累计已预缴税额
 * （与税款计算页展示字段对应；可为负表示本期应退/抵减）
 */
function currentPeriodDeclaredTax(totalTaxPayable, totalTaxPaid, totalTaxRelief) {
  return roundMoney2(
    (Number(totalTaxPayable) || 0) -
      (Number(totalTaxRelief) || 0) -
      (Number(totalTaxPaid) || 0)
  );
}

module.exports = {
  roundMoney2,
  currentPeriodDeclaredTax
};
