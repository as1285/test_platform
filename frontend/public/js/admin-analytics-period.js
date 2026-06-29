(function (global) {
    'use strict';

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function chinaNowParts() {
        var now = new Date();
        var utc = now.getTime() + now.getTimezoneOffset() * 60000;
        var cn = new Date(utc + 8 * 3600000);
        return { year: cn.getFullYear(), month: cn.getMonth() + 1, day: cn.getDate() };
    }

    /** 指定月份列表最早年份（不含 2023–2025 等更早月份） */
    var FIXED_MONTH_MIN_YEAR = 2026;

    function buildFixedMonthOptions(count) {
        count = count || 24;
        var cn = chinaNowParts();
        var html = '';
        var dt = new Date(cn.year, cn.month - 1, 1);
        for (var i = 0; i < count; i++) {
            var y = dt.getFullYear();
            var m = dt.getMonth() + 1;
            if (y < FIXED_MONTH_MIN_YEAR) break;
            html +=
                '<option value="month_' +
                y +
                '-' +
                pad2(m) +
                '">' +
                y +
                '年' +
                m +
                '月</option>';
            dt.setMonth(dt.getMonth() - 1);
        }
        return html;
    }

    function buildDayOptions(dayValues, selected) {
        var html = '';
        (dayValues || []).forEach(function (v) {
            html +=
                '<option value="' +
                v +
                '"' +
                (String(v) === String(selected) ? ' selected' : '') +
                '>最近 ' +
                v +
                ' 天</option>';
        });
        return html;
    }

    function parseDayValues(raw) {
        if (!raw) return [1, 7, 14, 30, 90];
        return String(raw)
            .split(',')
            .map(function (s) {
                return parseInt(s.trim(), 10);
            })
            .filter(function (n) {
                return isFinite(n) && n > 0;
            });
    }

    function initSelect(el, opts) {
        if (!el) return;
        opts = opts || {};
        var dayValues = opts.dayValues || parseDayValues(el.getAttribute('data-day-options'));
        var selected = opts.defaultValue != null ? opts.defaultValue : el.getAttribute('data-default') || el.value || '1';
        var fixedCount = opts.fixedMonthCount != null ? opts.fixedMonthCount : 24;
        var html =
            '<optgroup label="按月">' +
            '<option value="month_current">当月</option>' +
            '<option value="month_prev">上月</option>' +
            '<option value="month_prev2">上上月</option>' +
            '</optgroup>' +
            '<optgroup label="指定月份">' +
            buildFixedMonthOptions(fixedCount) +
            '</optgroup>' +
            '<optgroup label="按天">' +
            buildDayOptions(dayValues, selected) +
            '</optgroup>';
        if (opts.prependHtml) {
            html = opts.prependHtml + html;
        }
        el.innerHTML = html;
        if (selected) {
            el.value = selected;
        }
    }

    function initAll(root) {
        var scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('.js-analytics-period-select').forEach(function (el) {
            initSelect(el, {
                defaultValue: el.getAttribute('data-default') || el.value || '1',
                prependHtml: el.getAttribute('data-prepend-options') || ''
            });
        });
    }

    function getValue(el) {
        if (!el) return '1';
        return String(el.value || '1');
    }

    function hintHtml(data) {
        if (!data || !data.period_label) return '';
        var hint = '统计区间：' + data.period_label;
        if (data.period_start && data.period_end) {
            hint += '（' + data.period_start + ' ~ ' + data.period_end + '，北京时间）';
        }
        return '<p class="hint analytics-period-hint">' + escapeHtml(hint) + '</p>';
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    global.AdminAnalyticsPeriod = {
        initSelect: initSelect,
        initAll: initAll,
        getValue: getValue,
        hintHtml: hintHtml
    };
})(typeof window !== 'undefined' ? window : this);
