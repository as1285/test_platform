(function () {
    var WM_KEY = 'watermark_enabled';
    var WM_CACHE_KEY = 'wm_cache';
    var WM_CACHE_TIME_KEY = 'wm_cache_time';
    var CACHE_TTL = 60000; // 1分钟缓存
    var _wmGuardObserver = null;
    var _wmRemoving = false;

    function isInactiveWatermarkPage() {
        try {
            var p = (window.location.pathname || '').toLowerCase();
            return (
                p.endsWith('/shuiming_result.html') ||
                p.endsWith('shuiming_result.html')
            );
        } catch (e) {
            return false;
        }
    }

    function isLocalInactiveAccount() {
        try {
            return localStorage.getItem('account_active') === '0';
        } catch (e) {
            return false;
        }
    }

    /** 未激活水印：稀疏、低透明度，提示未开通但不抢内容、少干扰付费 */
    function getInactiveWatermarkSpec() {
        return {
            w: 360,
            h: 260,
            line1: '未激活',
            line2: 'Unactivated',
            font1: '16px Arial, sans-serif',
            font2: '11px Arial, sans-serif',
            color1: 'rgba(200, 16, 16, 0.28)',
            color2: 'rgba(200, 16, 16, 0.22)',
            line2OffsetY: 18
        };
    }

    function stopWmGuard() {
        if (_wmGuardObserver) {
            try {
                _wmGuardObserver.disconnect();
            } catch (e0) {}
            _wmGuardObserver = null;
        }
    }

    function createWatermarkLayer() {
        var existing = document.getElementById('__wm_layer__');
        if (existing) return;

        var spec = getInactiveWatermarkSpec();
        var canvas = document.createElement('canvas');
        var dpr = window.devicePixelRatio || 1;
        var w = spec.w;
        var h = spec.h;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        var ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.rotate(-25 * Math.PI / 180);
        ctx.textAlign = 'center';
        ctx.font = spec.font1;
        ctx.fillStyle = spec.color1;
        ctx.fillText(spec.line1, w / 2, h / 2);
        if (spec.line2) {
            ctx.font = spec.font2;
            ctx.fillStyle = spec.color2;
            ctx.fillText(spec.line2, w / 2, h / 2 + spec.line2OffsetY);
        }

        var dataUrl = canvas.toDataURL('image/png');

        var div = document.createElement('div');
        div.id = '__wm_layer__';
        div.setAttribute('aria-hidden', 'true');
        /*
         * 挂到 .page-root 内，避免 body 上 z-index:1000000 全屏层
         * 在部分 Android/iOS WebView 中即使 pointer-events:none 仍会吞掉点击。
         */
        div.style.cssText = [
            'position:absolute',
            'top:0',
            'left:0',
            'right:0',
            'bottom:0',
            'width:100%',
            'min-height:100%',
            'pointer-events:none',
            'z-index:5',
            'background-image:url(' + dataUrl + ')',
            'background-repeat:repeat',
            'background-size:' + w + 'px ' + h + 'px',
            'user-select:none',
            '-webkit-user-select:none'
        ].join(';');
        var host = document.querySelector('.page-root') || document.body;
        try {
            var cs = window.getComputedStyle(host);
            if (cs && cs.position === 'static') {
                host.style.position = 'relative';
            }
        } catch (ePos) {}
        host.appendChild(div);

        function remountWm() {
            var mount = document.querySelector('.page-root') || document.body;
            if (!document.getElementById('__wm_layer__')) {
                mount.appendChild(div);
            }
        }

        /* 防删守卫：移除前必须 disconnect，否则 remove 会被立刻加回（激活后仍见水印） */
        stopWmGuard();
        _wmGuardObserver = new MutationObserver(function (mutations) {
            if (_wmRemoving) return;
            mutations.forEach(function (m) {
                m.removedNodes.forEach(function (node) {
                    if (node && node.id === '__wm_layer__') {
                        try {
                            remountWm();
                        } catch (eRe) {}
                    }
                });
            });
        });
        _wmGuardObserver.observe(document.body, { childList: true, subtree: true });
    }

    function removeWatermarkLayer() {
        _wmRemoving = true;
        stopWmGuard();
        try {
            var el = document.getElementById('__wm_layer__');
            if (el && el.parentNode) el.parentNode.removeChild(el);
        } catch (eRm) {}
        _wmRemoving = false;
    }

    function applyWatermark(enabled) {
        if (!isInactiveWatermarkPage()) {
            removeWatermarkLayer();
            return;
        }
        if (enabled == 1 || enabled === '1' || enabled === true) {
            createWatermarkLayer();
        } else {
            removeWatermarkLayer();
        }
    }

    function notifyActivateCardSync() {
        if (typeof window.syncSmActivateCard === 'function') {
            try {
                window.syncSmActivateCard();
            } catch (eSync) {}
        }
    }

    function fetchAndApply() {
        if (!isInactiveWatermarkPage()) {
            removeWatermarkLayer();
            return;
        }
        var token = localStorage.getItem('token');
        if (!token) {
            removeWatermarkLayer();
            return;
        }

        /* 本地已开通：立刻去水印。本地未开通也不先画，等接口确认，避免已开通闪一下 */
        var localActive = false;
        try {
            localActive = localStorage.getItem('account_active') === '1';
        } catch (e0) {}
        if (localActive) {
            window.__smAccountActiveConfirmed = true;
            try {
                document.documentElement.classList.add('sm-account-active');
            } catch (eCls) {}
            applyWatermark('0');
            notifyActivateCardSync();
            try {
                localStorage.removeItem(WM_CACHE_KEY);
                localStorage.removeItem(WM_CACHE_TIME_KEY);
            } catch (e1) {}
        } else {
            applyWatermark('0');
        }

        // 从 API 获取最新状态（与 /api/user 一致，需 JWT，不再使用 URL 上的 user_id）
        var xhr = new XMLHttpRequest();
        var base = typeof WM_API_BASE !== 'undefined' ? WM_API_BASE : '';
        xhr.open('GET', base + 'api/user?action=info', true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.code === 200 && data.data) {
                        var raw = data.data.account_active;
                        var apiActive = raw === true || raw === 1 || raw === '1';
                        var apiInactive =
                            raw === false || raw === 0 || raw === '0';
                        if (apiActive) {
                            localStorage.setItem('account_active', '1');
                            localStorage.setItem(WM_CACHE_KEY, '0');
                            localStorage.setItem(WM_CACHE_TIME_KEY, Date.now().toString());
                            window.__smAccountActiveConfirmed = true;
                            try {
                                document.documentElement.classList.add('sm-account-active');
                            } catch (eOn) {}
                            applyWatermark('0');
                            notifyActivateCardSync();
                        } else if (apiInactive) {
                            localStorage.setItem('account_active', '0');
                            localStorage.setItem(WM_CACHE_KEY, '1');
                            localStorage.setItem(WM_CACHE_TIME_KEY, Date.now().toString());
                            window.__smAccountActiveConfirmed = false;
                            try {
                                document.documentElement.classList.remove('sm-account-active');
                            } catch (eOff) {}
                            applyWatermark('1');
                            notifyActivateCardSync();
                        }
                    }
                } catch (e) {}
            }
        };
        xhr.send();
    }

    // DOM 就绪后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fetchAndApply);
    } else {
        fetchAndApply();
    }

    // 页面可见性切换时刷新（防止缓存过久）
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            try {
                localStorage.removeItem(WM_CACHE_KEY);
                localStorage.removeItem(WM_CACHE_TIME_KEY);
            } catch (eV) {}
            fetchAndApply();
        }
    });

    /* App 内返回 / bfcache 恢复：按最新激活态立刻去水印 */
    window.addEventListener('pageshow', function () {
        try {
            localStorage.removeItem(WM_CACHE_KEY);
            localStorage.removeItem(WM_CACHE_TIME_KEY);
        } catch (ePs) {}
        fetchAndApply();
    });

    window.refreshWatermarkFromApi = function () {
        try {
            localStorage.removeItem(WM_CACHE_KEY);
            localStorage.removeItem(WM_CACHE_TIME_KEY);
        } catch (e) {}
        fetchAndApply();
    };
})();
