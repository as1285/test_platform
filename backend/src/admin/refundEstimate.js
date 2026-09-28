'use strict';

/**
 * 二次退税测算（与 C 端 refund-estimate.js / 广告页一键计算同一套口径）：
 * 3 个子女 4500/月 + 赡养父母 3000/月，对照 2023–2025 记录，且不超过当年已缴税额。
 */
var TAX_YEARS = [2025, 2024, 2023];
var REFUND_CHILD_MONTH = 4500;
var REFUND_PARENT_MONTH = 3000;
var REFUND_MONTHLY_EXTRA = REFUND_CHILD_MONTH + REFUND_PARENT_MONTH;
var REFUND_BASIC_DEDUCTION = 60000;

function parseTaxReportedAmount(val) {
  var n = parseFloat(String(val == null ? '' : val).replace(/,/g, ''));
  return isFinite(n) && n >= 0 ? n : 0;
}

function isExampleCompanyRecord(r) {
  return String((r && r.company_name) || '').indexOf('示例') >= 0;
}

function recordMonthIncome(r) {
  var a = parseTaxReportedAmount(r && r.income_this_period);
  var b = parseTaxReportedAmount(r && r.income);
  return a > b ? a : b;
}

function roundRefundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function iitComprehensiveTax(taxable) {
  var t = Math.max(0, Number(taxable) || 0);
  var rate;
  var quick;
  if (t <= 36000) {
    rate = 0.03;
    quick = 0;
  } else if (t <= 144000) {
    rate = 0.1;
    quick = 2520;
  } else if (t <= 300000) {
    rate = 0.2;
    quick = 16920;
  } else if (t <= 420000) {
    rate = 0.25;
    quick = 31920;
  } else if (t <= 660000) {
    rate = 0.3;
    quick = 52920;
  } else if (t <= 960000) {
    rate = 0.35;
    quick = 85920;
  } else {
    rate = 0.45;
    quick = 181920;
  }
  return Math.max(0, roundRefundMoney(t * rate - quick));
}

function formatRefundYuan(n) {
  var v = Math.round(Number(n) || 0);
  var s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (v < 0 ? '-¥' : '¥') + s;
}

function emptyYearRow(year) {
  return {
    year: year || 0,
    months: 0,
    income: 0,
    tax_reported: 0,
    extra: 0,
    saved: 0,
    has_records: false
  };
}

function yearTotals(records, year) {
  var y = parseInt(String(year), 10);
  var tax = 0;
  var income = 0;
  var recordCount = 0;
  var months = {};
  if (!y || !records || !records.length) {
    return { year: y, tax_sum: 0, income_sum: 0, month_count: 0, record_count: 0 };
  }
  records.forEach(function (r) {
    if (!r || isExampleCompanyRecord(r)) return;
    if (parseInt(String(r.year), 10) !== y) return;
    recordCount += 1;
    tax += parseTaxReportedAmount(r.tax_reported);
    income += recordMonthIncome(r);
    var m = parseInt(String(r.month), 10);
    if (m >= 1 && m <= 12) months[m] = true;
  });
  tax = Math.round(tax * 100) / 100;
  income = Math.round(income * 100) / 100;
  var monthCount = Object.keys(months).length;
  if (!monthCount && recordCount > 0) monthCount = Math.min(12, recordCount);
  return {
    year: y,
    tax_sum: tax,
    income_sum: income,
    month_count: monthCount,
    record_count: recordCount
  };
}

function estimateYear(records, year) {
  var row = yearTotals(records, year);
  var has = row.income_sum > 0 || row.tax_sum > 0 || row.record_count > 0;
  if (!has) return emptyYearRow(year);
  var months = row.month_count || 0;
  if (!months) months = 12;
  var extra = REFUND_MONTHLY_EXTRA * months;
  var beforeTaxable = Math.max(0, row.income_sum - REFUND_BASIC_DEDUCTION);
  var afterTaxable = Math.max(0, row.income_sum - REFUND_BASIC_DEDUCTION - extra);
  var saved = roundRefundMoney(iitComprehensiveTax(beforeTaxable) - iitComprehensiveTax(afterTaxable));
  if (row.tax_sum > 0) saved = Math.min(saved, row.tax_sum);
  saved = Math.max(0, roundRefundMoney(saved));
  return {
    year: year,
    months: months,
    income: row.income_sum,
    tax_reported: row.tax_sum,
    extra: extra,
    saved: saved,
    has_records: true
  };
}

function specialDeductionRefundEstimate(records) {
  var years = TAX_YEARS.map(function (y) {
    return estimateYear(records, y);
  });
  var total = roundRefundMoney(
    years.reduce(function (sum, row) {
      return sum + (row.saved || 0);
    }, 0)
  );
  var listed = years.filter(function (row) {
    return row.has_records;
  });
  return {
    total: total,
    years: years,
    year_list: listed
      .map(function (r) {
        return r.year;
      })
      .join(','),
    child_month: REFUND_CHILD_MONTH,
    parent_month: REFUND_PARENT_MONTH,
    monthly_extra: REFUND_MONTHLY_EXTRA,
    has_any_records: listed.length > 0
  };
}

function buildRefundAmountEmailCopy(estimate) {
  var est = estimate && typeof estimate === 'object' ? estimate : specialDeductionRefundEstimate([]);
  var totalYuan = formatRefundYuan(est.total);
  var yearLines = (est.years || [])
    .filter(function (row) {
      return row && (row.has_records || row.saved > 0);
    })
    .map(function (row) {
      return row.year + ' 年约 ' + formatRefundYuan(row.saved);
    });
  var subject = '二次退税：测算约可退 ' + totalYuan;
  var content;
  if (est.has_any_records) {
    content =
      '你好，\n\n按你填写的 2023–2025 个税记录测算，大约可退 ' +
      totalYuan +
      '。\n' +
      (yearLines.length ? '\n' + yearLines.join('\n') + '\n' : '\n') +
      '\n未开通也可以先看。打开页面可再算一次；符合请复制微信号备注「二次退税」联系客服办理。\n不强制，不符合可忽略本邮件。';
  } else {
    content =
      '你好，\n\n你目前还没有 2023–2025 的个税记录，暂无法算出可退税额（约 ' +
      totalYuan +
      '）。\n打开页面填写或导入记录后，可一键计算大约可退金额。符合请联系客服办理。不强制。';
  }
  return {
    subject: subject.slice(0, 120),
    content: content,
    total: est.total,
    total_yuan: totalYuan,
    cta_label: '打开二次退税说明',
    benefits: '测算约可退 ' + totalYuan + ' · 复制微信联系客服 · 备注二次退税',
    link_url: 'refund_ad.html?from=email_refund&est=' + Math.round(Number(est.total) || 0)
  };
}

module.exports = {
  TAX_YEARS: TAX_YEARS,
  REFUND_CHILD_MONTH: REFUND_CHILD_MONTH,
  REFUND_PARENT_MONTH: REFUND_PARENT_MONTH,
  REFUND_MONTHLY_EXTRA: REFUND_MONTHLY_EXTRA,
  iitComprehensiveTax: iitComprehensiveTax,
  formatRefundYuan: formatRefundYuan,
  specialDeductionRefundEstimate: specialDeductionRefundEstimate,
  buildRefundAmountEmailCopy: buildRefundAmountEmailCopy
};
