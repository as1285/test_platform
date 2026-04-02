(function () {
    var WM_KEY = 'watermark_enabled';
    var WM_USER_KEY = 'user_id';
    var WM_CACHE_KEY = 'wm_cache';
    var WM_CACHE_TIME_KEY = 'wm_cache_time';
    var CACHE_TTL = 60000; // 1分钟缓存

    function createWatermarkLayer() {
        var existing = document.getElementById('__wm_layer__');
        if (existing) return;

        var canvas = document.createElement('canvas');
        var dpr = window.devicePixelRatio || 1;
        var w = 200, h = 120;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        var ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.rotate(-25 * Math.PI / 180);
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.fillStyle = 'rgba(160, 0, 0, 0.35)';
        ctx.textAlign = 'center';
        ctx.fillText('未激活', w / 2, h / 2);
        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = 'rgba(160, 0, 0, 0.28)';
        ctx.fillText('Unactivated', w / 2, h / 2 + 20);

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
            'background-size:200px 120px',
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
        var userId = localStorage.getItem(WM_USER_KEY);
        if (!userId) {
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

        // 从 API 获取最新状态
        var xhr = new XMLHttpRequest();
        xhr.open('GET', (typeof WM_API_BASE !== 'undefined' ? WM_API_BASE : '') + 'api/user.php?action=info&user_id=' + userId, true);
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
})();
