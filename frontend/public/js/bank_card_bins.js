(function (global) {
    /** 常见借记卡 BIN（前缀越长越优先匹配） */
    var BIN_RULES = [
        { bank: '交通银行', bins: ['622260', '622261', '622262', '622258', '521899', '434910', '458123'] },
        {
            bank: '中国工商银行',
            bins: ['622202', '622203', '955880', '621226', '621225', '621722', '621723', '621721', '621720']
        },
        {
            bank: '中国建设银行',
            bins: ['622700', '621700', '621284', '621467', '436742', '552245', '621081', '621082', '621083']
        },
        {
            bank: '中国农业银行',
            bins: ['622848', '622845', '95599', '103', '621336', '621619', '621671', '622821', '622822', '622823']
        },
        {
            bank: '中国银行',
            bins: [
                '621660',
                '621661',
                '621662',
                '621663',
                '621666',
                '621667',
                '621668',
                '621669',
                '621756',
                '621757',
                '621758',
                '621759',
                '621785',
                '621786',
                '621787',
                '621788',
                '621789',
                '621790',
                '621791',
                '456351'
            ]
        },
        { bank: '招商银行', bins: ['622588', '622575', '622576', '621483', '621485', '621486'] },
        { bank: '平安银行', bins: ['622155', '622156', '622157', '621626', '623058'] }
    ];

    var SORTED_BINS = [];
    BIN_RULES.forEach(function (rule) {
        rule.bins.forEach(function (bin) {
            SORTED_BINS.push({ bin: bin, bank: rule.bank });
        });
    });
    SORTED_BINS.sort(function (a, b) {
        return b.bin.length - a.bin.length;
    });

    function digitsOnly(cardNo) {
        return String(cardNo || '').replace(/\D/g, '');
    }

    function inferBankNameFromCardNo(cardNo) {
        var s = digitsOnly(cardNo);
        if (!s) return '银行卡';
        for (var i = 0; i < SORTED_BINS.length; i++) {
            var item = SORTED_BINS[i];
            if (s.indexOf(item.bin) === 0) return item.bank;
        }
        return '银行卡';
    }

    global.BankCardBins = {
        inferBankNameFromCardNo: inferBankNameFromCardNo,
        BIN_RULES: BIN_RULES
    };
})(typeof window !== 'undefined' ? window : this);
