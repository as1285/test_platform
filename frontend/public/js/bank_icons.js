(function (global) {
    var ICON_BASE = 'bank_icons/';
    var ICON_MAP = {
        '交通银行': 'bankcomm-rect.svg',
        '中国工商银行': 'icbc-rect.svg',
        '中国建设银行': 'ccb-rect.svg',
        '中国农业银行': 'abchina-rect.svg',
        '中国银行': 'boc-rect.svg',
        '招商银行': 'cmbchina-rect.svg',
        '平安银行': 'pingan-rect.svg'
    };
    var ALIASES = {
        '工商银行': '中国工商银行',
        '建设银行': '中国建设银行',
        '农业银行': '中国农业银行',
        '招行': '招商银行'
    };

    function normalizeBankName(name) {
        var n = String(name || '').trim();
        if (!n) return '';
        if (ICON_MAP[n]) return n;
        if (ALIASES[n]) return ALIASES[n];
        var keys = Object.keys(ICON_MAP);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (n.indexOf(key) >= 0 || key.indexOf(n) >= 0) return key;
        }
        return n;
    }

    function getBankIconSrc(name) {
        var key = normalizeBankName(name);
        if (ICON_MAP[key]) {
            return ICON_BASE + ICON_MAP[key] + '?v=1';
        }
        return '';
    }

    function bankLogoChar(name) {
        var n = String(name || '').trim();
        return n ? n.charAt(0) : '卡';
    }

    function renderBankLogoHtml(name) {
        var src = getBankIconSrc(name);
        if (src) {
            return (
                '<div class="bank-logo" aria-hidden="true">' +
                '<img src="' +
                src +
                '" alt="" width="44" height="44" decoding="async">' +
                '</div>'
            );
        }
        return (
            '<div class="bank-logo bank-logo--fallback" aria-hidden="true">' +
            bankLogoChar(name) +
            '</div>'
        );
    }

    global.BankIcons = {
        getBankIconSrc: getBankIconSrc,
        renderBankLogoHtml: renderBankLogoHtml,
        bankLogoChar: bankLogoChar
    };
})(typeof window !== 'undefined' ? window : this);
