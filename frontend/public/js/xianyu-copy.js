(function (global) {
    var TOAST_MSG = '复制成功，打开闲鱼';
    var toastTimer = null;

    function showXianyuToast(msg) {
        var el = document.getElementById('xianyu-copy-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'xianyu-copy-toast';
            el.setAttribute('role', 'status');
            el.style.cssText =
                'position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top,0px));' +
                'transform:translateX(-50%);z-index:1000020;max-width:88vw;padding:10px 14px;' +
                'border-radius:8px;background:rgba(0,0,0,.78);color:#fff;font-size:13px;' +
                'line-height:1.45;text-align:center;pointer-events:none;opacity:0;transition:opacity .2s ease;';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity = '1';
        if (toastTimer) {
            clearTimeout(toastTimer);
        }
        toastTimer = setTimeout(function () {
            el.style.opacity = '0';
        }, 2200);
    }

    function copyText(text) {
        text = String(text || '');
        if (!text) {
            return Promise.reject(new Error('empty'));
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try {
                var ok = document.execCommand('copy');
                document.body.removeChild(ta);
                if (ok) {
                    resolve();
                } else {
                    reject(new Error('copy failed'));
                }
            } catch (e) {
                document.body.removeChild(ta);
                reject(e);
            }
        });
    }

    function copyXianyuPurchaseText(text) {
        return copyText(text).then(function () {
            showXianyuToast(TOAST_MSG);
        });
    }

    global.copyXianyuPurchaseText = copyXianyuPurchaseText;
})(typeof window !== 'undefined' ? window : this);
