(function (global) {
    'use strict';

    var CUSTOM_MAX_DAYS = 366;
    var RANGE_RE = /^range_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/;
    /** 项目上线日起：统计不可选更早日期 */
    var PROJECT_START_YMD = '2026-04-01';
    var PROJECT_START_YEAR = 2026;
    var PROJECT_START_MONTH = 4;

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function chinaNowParts() {
        var now = new Date();
        var utc = now.getTime() + now.getTimezoneOffset() * 60000;
        var cn = new Date(utc + 8 * 3600000);
        return { year: cn.getFullYear(), month: cn.getMonth() + 1, day: cn.getDate() };
    }

    function chinaTodayYmd() {
        var cn = chinaNowParts();
        return cn.year + '-' + pad2(cn.month) + '-' + pad2(cn.day);
    }

    function ymKey(y, m) {
        return y * 12 + m;
    }

    function isOnOrAfterProjectStartYm(y, m) {
        return ymKey(y, m) >= ymKey(PROJECT_START_YEAR, PROJECT_START_MONTH);
    }

    function isValidYmd(ymd) {
        var m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return false;
        var y = parseInt(m[1], 10);
        var mo = parseInt(m[2], 10);
        var d = parseInt(m[3], 10);
        if (y < PROJECT_START_YEAR || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return false;
        var dt = new Date(Date.UTC(y, mo - 1, d));
        if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
            return false;
        }
        var key = y + '-' + pad2(mo) + '-' + pad2(d);
        return key >= PROJECT_START_YMD;
    }

    function dayCount(startYmd, endYmd) {
        var a = String(startYmd).split('-').map(function (x) {
            return parseInt(x, 10);
        });
        var b = String(endYmd).split('-').map(function (x) {
            return parseInt(x, 10);
        });
        return (
            Math.floor((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000) +
            1
        );
    }

    function buildRelativeMonthOptions() {
        var cn = chinaNowParts();
        var defs = [
            { value: 'month_current', label: '当月', offset: 0 },
            { value: 'month_prev', label: '上月', offset: 1 },
            { value: 'month_prev2', label: '上上月', offset: 2 }
        ];
        var html = '';
        defs.forEach(function (def) {
            var dt = new Date(cn.year, cn.month - 1 - def.offset, 1);
            var y = dt.getFullYear();
            var m = dt.getMonth() + 1;
            if (!isOnOrAfterProjectStartYm(y, m)) return;
            html += '<option value="' + def.value + '">' + def.label + '</option>';
        });
        return html;
    }

    function buildFixedMonthOptions(count) {
        count = count || 24;
        var cn = chinaNowParts();
        var html = '';
        var dt = new Date(cn.year, cn.month - 1, 1);
        for (var i = 0; i < count; i++) {
            var y = dt.getFullYear();
            var m = dt.getMonth() + 1;
            if (!isOnOrAfterProjectStartYm(y, m)) break;
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

    function defaultCustomRange() {
        var today = chinaTodayYmd();
        if (today < PROJECT_START_YMD) {
            return { start: PROJECT_START_YMD, end: PROJECT_START_YMD };
        }
        return { start: today, end: today };
    }

    function applyDateBounds(input) {
        if (!input) return;
        var today = chinaTodayYmd();
        input.min = PROJECT_START_YMD;
        input.max = today < PROJECT_START_YMD ? PROJECT_START_YMD : today;
    }

    function ensureCustomControls(el) {
        if (!el || el._analyticsCustomWrap) return el._analyticsCustomWrap;
        var parent = el.parentNode;
        if (!parent) return null;

        var wrap = document.createElement('span');
        wrap.className = 'analytics-custom-range';
        wrap.style.cssText =
            'display:none;align-items:center;gap:6px;margin-left:8px;flex-wrap:wrap;vertical-align:middle;';
        wrap.setAttribute('aria-hidden', 'true');

        var startLab = document.createElement('label');
        startLab.className = 'analytics-custom-range-label';
        startLab.style.cssText = 'margin:0;font-weight:normal;display:inline-flex;align-items:center;gap:4px;';
        startLab.appendChild(document.createTextNode('起'));
        var startInput = document.createElement('input');
        startInput.type = 'date';
        startInput.className = 'filter-select analytics-custom-start';
        startInput.setAttribute('aria-label', '自定义开始日期');
        startLab.appendChild(startInput);

        var endLab = document.createElement('label');
        endLab.className = 'analytics-custom-range-label';
        endLab.style.cssText = 'margin:0;font-weight:normal;display:inline-flex;align-items:center;gap:4px;';
        endLab.appendChild(document.createTextNode('止'));
        var endInput = document.createElement('input');
        endInput.type = 'date';
        endInput.className = 'filter-select analytics-custom-end';
        endInput.setAttribute('aria-label', '自定义结束日期');
        endLab.appendChild(endInput);

        wrap.appendChild(startLab);
        wrap.appendChild(endLab);

        var defs = defaultCustomRange();
        applyDateBounds(startInput);
        applyDateBounds(endInput);
        startInput.value = defs.start;
        endInput.value = defs.end;

        if (el.nextSibling) {
            parent.insertBefore(wrap, el.nextSibling);
        } else {
            parent.appendChild(wrap);
        }

        el._analyticsCustomWrap = wrap;
        el._analyticsCustomStart = startInput;
        el._analyticsCustomEnd = endInput;

        function onDateChange() {
            syncCustomVisibility(el);
            var encoded = encodeCustomRange(
                el._analyticsCustomStart && el._analyticsCustomStart.value,
                el._analyticsCustomEnd && el._analyticsCustomEnd.value
            );
            if (!encoded) {
                alert(
                    '请选择有效的起止日期（起 ≤ 止，不早于 ' +
                        PROJECT_START_YMD +
                        '，不超过今天，跨度不超过 366 天）'
                );
            }
            try {
                el.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e1) {
                var changeEv = document.createEvent('Event');
                changeEv.initEvent('change', true, false);
                el.dispatchEvent(changeEv);
            }
            dispatchPeriodChange(el);
        }
        startInput.addEventListener('change', onDateChange);
        endInput.addEventListener('change', onDateChange);

        return wrap;
    }

    function syncCustomVisibility(el) {
        if (!el) return;
        var wrap = ensureCustomControls(el);
        if (!wrap) return;
        var isCustom = String(el.value) === 'custom';
        wrap.style.display = isCustom ? 'inline-flex' : 'none';
        wrap.setAttribute('aria-hidden', isCustom ? 'false' : 'true');
        if (isCustom) {
            applyDateBounds(el._analyticsCustomStart);
            applyDateBounds(el._analyticsCustomEnd);
            var defs = defaultCustomRange();
            if (!el._analyticsCustomStart.value || el._analyticsCustomStart.value < PROJECT_START_YMD) {
                el._analyticsCustomStart.value = defs.start;
            }
            if (!el._analyticsCustomEnd.value || el._analyticsCustomEnd.value < PROJECT_START_YMD) {
                el._analyticsCustomEnd.value = defs.end;
            }
        }
    }

    function dispatchPeriodChange(el) {
        if (!el) return;
        try {
            el.dispatchEvent(
                new CustomEvent('analytics-period-change', {
                    bubbles: true,
                    detail: { value: getValue(el) }
                })
            );
        } catch (e0) {
            var ev = document.createEvent('Event');
            ev.initEvent('analytics-period-change', true, false);
            el.dispatchEvent(ev);
        }
    }

    function encodeCustomRange(start, end) {
        var today = chinaTodayYmd();
        if (!isValidYmd(start) || !isValidYmd(end)) return null;
        if (start < PROJECT_START_YMD) start = PROJECT_START_YMD;
        if (end > today) end = today;
        if (start > end) return null;
        var n = dayCount(start, end);
        if (n < 1 || n > CUSTOM_MAX_DAYS) return null;
        return 'range_' + start + '_' + end;
    }

    function initSelect(el, opts) {
        if (!el) return;
        opts = opts || {};
        var dayValues = opts.dayValues || parseDayValues(el.getAttribute('data-day-options'));
        var selected =
            opts.defaultValue != null
                ? opts.defaultValue
                : el.getAttribute('data-default') || el.value || 'custom';
        var fixedCount = opts.fixedMonthCount != null ? opts.fixedMonthCount : 24;

        var customStart = null;
        var customEnd = null;
        var rangeMatch = String(selected).match(RANGE_RE);
        if (rangeMatch) {
            customStart = rangeMatch[1];
            customEnd = rangeMatch[2];
            selected = 'custom';
        }

        var relativeMonths = buildRelativeMonthOptions();
        var fixedMonths = buildFixedMonthOptions(fixedCount);
        var html = '';
        if (relativeMonths) {
            html += '<optgroup label="按月">' + relativeMonths + '</optgroup>';
        }
        if (fixedMonths) {
            html += '<optgroup label="指定月份">' + fixedMonths + '</optgroup>';
        }
        html +=
            '<optgroup label="按天">' +
            buildDayOptions(dayValues, selected === 'custom' ? '' : selected) +
            '</optgroup>' +
            '<optgroup label="自定义">' +
            '<option value="custom">自定义日期</option>' +
            '</optgroup>';
        if (opts.prependHtml) {
            html = opts.prependHtml + html;
        }
        el.innerHTML = html;
        if (selected) {
            el.value = selected;
            if (el.value !== selected) {
                el.value = 'custom';
            }
        } else {
            el.value = 'custom';
        }

        ensureCustomControls(el);
        if (customStart && el._analyticsCustomStart && isValidYmd(customStart)) {
            el._analyticsCustomStart.value = customStart;
        }
        if (customEnd && el._analyticsCustomEnd && isValidYmd(customEnd)) {
            el._analyticsCustomEnd.value = customEnd;
        }
        if (String(el.value) === 'custom') {
            var defs = defaultCustomRange();
            if (!el._analyticsCustomStart.value) el._analyticsCustomStart.value = defs.start;
            if (!el._analyticsCustomEnd.value) el._analyticsCustomEnd.value = defs.end;
        }
        syncCustomVisibility(el);

        if (!el._analyticsPeriodBound) {
            el._analyticsPeriodBound = true;
            el.addEventListener('change', function () {
                syncCustomVisibility(el);
                dispatchPeriodChange(el);
            });
        }
    }

    function initAll(root) {
        var scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('.js-analytics-period-select').forEach(function (el) {
            initSelect(el, {
                defaultValue: el.getAttribute('data-default') || 'custom',
                prependHtml: el.getAttribute('data-prepend-options') || ''
            });
        });
    }

    function getValue(el) {
        if (!el) {
            var d = defaultCustomRange();
            return 'range_' + d.start + '_' + d.end;
        }
        var v = String(el.value || 'custom');
        if (v !== 'custom') return v;
        ensureCustomControls(el);
        var start = el._analyticsCustomStart && el._analyticsCustomStart.value;
        var end = el._analyticsCustomEnd && el._analyticsCustomEnd.value;
        var encoded = encodeCustomRange(start, end);
        if (encoded) return encoded;
        var defs = defaultCustomRange();
        return 'range_' + defs.start + '_' + defs.end;
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
        hintHtml: hintHtml,
        PROJECT_START_YMD: PROJECT_START_YMD
    };
})(typeof window !== 'undefined' ? window : this);
