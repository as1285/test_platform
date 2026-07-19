/**
 * 收入纳税明细可选年度：最早可至 1900，最晚为当前公历年（随设备时间动态变化）。
 * 录入个税记录时不在此强制截断；本模块仅用于年度选择与规范化。
 */
(function (global) {
    var MIN_TAX_YEAR = 1900;

    function getMaxTaxYear() {
        var now = new Date().getFullYear();
        if (!now || isNaN(now) || now < MIN_TAX_YEAR) return MIN_TAX_YEAR;
        return now;
    }

    function getMinTaxYear() {
        return MIN_TAX_YEAR;
    }

    function getDefaultTaxYear() {
        return getMaxTaxYear();
    }

    function normalizeTaxYear(raw) {
        var y = parseInt(String(raw == null ? '' : raw).trim(), 10);
        var maxY = getMaxTaxYear();
        if (!y || isNaN(y) || y < MIN_TAX_YEAR || y > maxY) {
            return getDefaultTaxYear();
        }
        return y;
    }

    /** 从早到晚：1900 … 当前年 */
    function listTaxYears() {
        var maxY = getMaxTaxYear();
        var years = [];
        var y;
        for (y = MIN_TAX_YEAR; y <= maxY; y++) {
            years.push(y);
        }
        return years;
    }

    /** 录入/校验用：四位年内任意合法整数（不截断到 2019 等硬编码区间） */
    function isPlausibleTaxYear(raw) {
        var y = parseInt(String(raw == null ? '' : raw).trim(), 10);
        return !!(y && !isNaN(y) && y >= 1 && y <= 9999);
    }

    global.getMinTaxYear = getMinTaxYear;
    global.getMaxTaxYear = getMaxTaxYear;
    global.getDefaultTaxYear = getDefaultTaxYear;
    global.normalizeTaxYear = normalizeTaxYear;
    global.listTaxYears = listTaxYears;
    global.isPlausibleTaxYear = isPlausibleTaxYear;
})(typeof window !== 'undefined' ? window : global);
