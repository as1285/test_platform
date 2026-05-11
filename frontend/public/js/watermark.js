(function () {
    var WM_KEY = 'watermark_enabled';
    var WM_CACHE_KEY = 'wm_cache';
    var WM_CACHE_TIME_KEY = 'wm_cache_time';
    var CACHE_TTL = 60000; // 1分钟缓存

    function isMineProfilePage() {
        try {
            var p = (window.location.pathname || '').toLowerCase();
            return p.endsWith('/mine.html') || p.endsWith('mine.html');
        } catch (e) {
            return false;
        }
    }

    /** 未激活水印文案与平铺尺寸（「我的」页单独提示咨询入口） */
    function getInactiveWatermarkSpec() {
        if (isMineProfilePage()) {
            return {
                w: 340,
                h: 132,
                line1: '点击我要咨询修改数据',
                line2: '',
                font1: 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
                font2: '12px Arial, sans-serif',
                color1: 'rgba(160, 0, 0, 0.34)',
                color2: 'rgba(160, 0, 0, 0.28)',
                line2OffsetY: 22
            };
        }
        return {
            w: 200,
            h: 120,
            line1: '未激活',
            line2: 'Unactivated',
            font1: 'bold 18px Arial, sans-serif',
            font2: '12px Arial, sans-serif',
            color1: 'rgba(160, 0, 0, 0.35)',
            color2: 'rgba(160, 0, 0, 0.28)',
            line2OffsetY: 20
        };
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
        div.style.cssText = [
            'position:fixed',
            'top:0', 'left:0', 'right:0', 'bottom:0',
            'width:100%', 'height:100%',
            'pointer-events:none',
            'z-index:99999',
            'background-image:url(' + dataUrl + ')',
            'background-repeat:repeat',
            'background-size:' + w + 'px ' + h + 'px',
            'user-select:none',
            '-webkit-user-select:none'
        ].join(';');
        document.body.appendChild(div);

        // MutationObserver 防止被删除
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                m.removedNodes.forEach(function (node) {
                    if (node.id === '__wm_layer__') {
                        document.body.appendChild(div);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true });
    }

    function removeWatermarkLayer() {
        var el = document.getElementById('__wm_layer__');
        if (el) el.parentNode.removeChild(el);
    }

    function applyWatermark(enabled) {
        if (enabled == 1 || enabled === '1' || enabled === true) {
            createWatermarkLayer();
        } else {
            removeWatermarkLayer();
        }
    }

    function fetchAndApply() {
        var token = localStorage.getItem('token');
        if (!token) {
            removeWatermarkLayer();
            return;
        }

        // 检查缓存
        var cached = localStorage.getItem(WM_CACHE_KEY);
        var cachedTime = parseInt(localStorage.getItem(WM_CACHE_TIME_KEY) || '0');
        if (cached !== null && (Date.now() - cachedTime) < CACHE_TTL) {
            applyWatermark(cached);
            return;
        }

        // 从 API 获取最新状态（与 /api/user.php 一致，需 JWT，不再使用 URL 上的 user_id）
        var xhr = new XMLHttpRequest();
        var base = typeof WM_API_BASE !== 'undefined' ? WM_API_BASE : '';
        xhr.open('GET', base + 'api/user.php?action=info', true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.code === 200 && data.data) {
                        var val = data.data.watermark_enabled ? '1' : '0';
                        localStorage.setItem(WM_CACHE_KEY, val);
                        localStorage.setItem(WM_CACHE_TIME_KEY, Date.now().toString());
                        applyWatermark(val);
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
            localStorage.removeItem(WM_CACHE_KEY);
            fetchAndApply();
        }
    });

    window.refreshWatermarkFromApi = function () {
        try {
            localStorage.removeItem(WM_CACHE_KEY);
            localStorage.removeItem(WM_CACHE_TIME_KEY);
        } catch (e) {}
        fetchAndApply();
    };
})();
