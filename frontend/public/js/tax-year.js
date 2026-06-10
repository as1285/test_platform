/**
 * 收入纳税明细可选年度（2019 起）；设备系统时间异常时勿采用无效年份。
 */
(function (global) {
    var MIN_TAX_YEAR = 2019;
    var MAX_TAX_YEAR = 2026;

    function getDefaultTaxYear() {
        var now = new Date().getFullYear();
        if (now >= MIN_TAX_YEAR && now <= MAX_TAX_YEAR) return now;
        return MAX_TAX_YEAR;
    }

    function normalizeTaxYear(raw) {
        var y = parseInt(String(raw == null ? '' : raw).trim(), 10);
        if (!y || isNaN(y) || y < MIN_TAX_YEAR || y > MAX_TAX_YEAR) {
            return getDefaultTaxYear();
        }
        return y;
    }

    global.getDefaultTaxYear = getDefaultTaxYear;
    global.normalizeTaxYear = normalizeTaxYear;
})(typeof window !== 'undefined' ? window : global);
