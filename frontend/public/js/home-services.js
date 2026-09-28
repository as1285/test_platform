/**
 * 首页重点服务：目录、本地排序、首页横滑卡渲染。
 * 与官方「更多功能 / 首页重点服务管理」对齐；最多 7 个，末位固定为更多功能入口。
 */
(function (global) {
    var STORAGE_KEY = 'tax_home_key_services_v1';
    var MAX_SELECTED = 7;
    /* 图标来自官方 APK icon-all.747718b.png 切片，避免自制 SVG 与「更多」不一致 */
    var HOME_ASSET_Q = '?v=20260908-apk-icons';
    var ICON_ASSET_Q = '?v=20260908-apk-icons';
    var MANAGE_HREF = 'zhongdian_fuwu.html';
    var ICON_DIR = '/img/home/service-icons/';

    var CATALOG = [
        {
            id: 'zonghe',
            name: '综合所得年度汇算',
            href: 'zonghe.html',
            category: '办税',
            desc: '申报与查询境内综合所得年度汇算',
            btn: '去申报',
            color: '#2b7cff',
            btnBg: '#dce8ff',
            btnColor: '#1e5fe0',
            slice: '/img/home/a6_01.jpg',
            iconFile: 'zonghe.png'
        },
        {
            id: 'shuiming',
            name: '收入纳税明细',
            href: 'shuiming.html?reset=1',
            category: '查询',
            desc: '查看个人所得税纳税明细',
            btn: '去查询',
            color: '#7c5cbf',
            btnBg: '#efe8ff',
            btnColor: '#6b46c1',
            slice: '/img/home/a6_02.jpg',
            iconFile: 'shuiming.png'
        },
        {
            id: 'najilu',
            name: '纳税记录开具',
            href: 'najilu.html',
            category: '办税',
            desc: '生成或查看纳税记录',
            btn: '去开具',
            color: '#1aa6a0',
            btnBg: '#d4f3f1',
            btnColor: '#0f7f7a',
            slice: '/img/home/a6_03.jpg',
            iconFile: 'najilu.png'
        },
        {
            id: 'yanglao',
            name: '个人养老金扣除管理',
            href: 'gerenyanglao.html',
            category: '办税',
            desc: '录入或查看个人养老金扣除信息',
            btn: '去使用',
            color: '#3ba6e0',
            btnBg: '#d7effb',
            btnColor: '#1b7cb8',
            iconFile: 'yanglao.png'
        },
        {
            id: 'zxk',
            name: '专项附加扣除',
            href: 'zxkouchu.html',
            category: '办税',
            desc: '填报专项附加扣除',
            btn: '去填报',
            color: '#f5a023',
            btnBg: '#ffe8c4',
            btnColor: '#c67a00',
            iconFile: 'zxk.png'
        },
        {
            id: 'weituo',
            name: '委托代理关系管理',
            href: 'weituodaili.html',
            category: '办税',
            desc: '委托代理机构或个人代办年度汇算',
            btn: '去使用',
            color: '#f0a05a',
            btnBg: '#ffe8d2',
            btnColor: '#c46a20',
            iconFile: 'weituo.png'
        },
        {
            id: 'gongyi',
            name: '公益慈善捐赠扣除填报',
            href: 'gongyicishan.html',
            category: '办税',
            desc: '录入或查看准予扣除的捐赠记录',
            btn: '去填报',
            color: '#9b7fe8',
            btnBg: '#eee6ff',
            btnColor: '#6d4fc4',
            iconFile: 'gongyi.png'
        },
        {
            id: 'jingying_a',
            name: '其他经营所得（A表）',
            href: 'jingyingsuode.html',
            category: '办税',
            desc: '其他经营所得预缴纳税申报',
            btn: '去申报',
            color: '#7dcea0',
            btnBg: '#ddf6e8',
            btnColor: '#2e8b57',
            iconFile: 'jingying_a.png'
        },
        {
            id: 'jingying_b',
            name: '其他经营所得（B表）',
            href: 'jingyingsuode.html',
            category: '办税',
            desc: '其他经营所得年度汇算清缴',
            btn: '去申报',
            color: '#6ec8b8',
            btnBg: '#d9f4ee',
            btnColor: '#1f8a78',
            iconFile: 'jingying_b.png'
        },
        {
            id: 'jingying',
            name: '经营所得申报',
            href: 'jingyingsuode.html',
            category: '办税',
            desc: '取得经营所得后办理申报',
            btn: '去申报',
            color: '#2f9e5f',
            btnBg: '#d7f3e3',
            btnColor: '#1b7040',
            iconFile: 'jingying.png'
        },
        {
            id: 'jingying_c',
            name: '经营所得(C表)',
            href: 'jingyingsuode.html',
            category: '办税',
            desc: '多处经营所得年度汇总申报',
            btn: '去申报',
            color: '#2e5aac',
            btnBg: '#d8e4f8',
            btnColor: '#1d3f80',
            iconFile: 'jingying_c.png'
        }
    ];

    var DEFAULT_IDS = ['zonghe', 'shuiming', 'najilu'];

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getById(id) {
        for (var i = 0; i < CATALOG.length; i++) {
            if (CATALOG[i].id === id) return CATALOG[i];
        }
        return null;
    }

    function uniqueValidIds(ids) {
        var out = [];
        var seen = {};
        if (!ids || !ids.length) return out;
        for (var i = 0; i < ids.length; i++) {
            var id = String(ids[i] || '');
            if (!id || seen[id] || !getById(id)) continue;
            seen[id] = true;
            out.push(id);
            if (out.length >= MAX_SELECTED) break;
        }
        return out;
    }

    function loadSelectedIds() {
        try {
            var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
            if (raw == null || raw === '') return DEFAULT_IDS.slice();
            var parsed = JSON.parse(raw);
            var ids = uniqueValidIds(parsed);
            return ids.length ? ids : DEFAULT_IDS.slice();
        } catch (e0) {
            return DEFAULT_IDS.slice();
        }
    }

    function saveSelectedIds(ids) {
        var next = uniqueValidIds(ids);
        if (!next.length) next = DEFAULT_IDS.slice();
        try {
            if (global.localStorage) {
                global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            }
        } catch (e1) {}
        return next;
    }

    function isDefaultSelection(ids) {
        var list = ids || loadSelectedIds();
        if (!list || list.length !== DEFAULT_IDS.length) return false;
        for (var i = 0; i < DEFAULT_IDS.length; i++) {
            if (list[i] !== DEFAULT_IDS[i]) return false;
        }
        return true;
    }

    function addService(id) {
        var ids = loadSelectedIds();
        if (ids.indexOf(id) >= 0) return { ok: true, ids: ids };
        if (ids.length >= MAX_SELECTED) {
            return { ok: false, reason: 'max', message: '最多可添加7个服务', ids: ids };
        }
        if (!getById(id)) return { ok: false, reason: 'unknown', ids: ids };
        ids.push(id);
        return { ok: true, ids: saveSelectedIds(ids) };
    }

    function removeService(id) {
        var ids = loadSelectedIds();
        if (ids.length <= 1) {
            return { ok: false, reason: 'min', message: '至少保留1个服务', ids: ids };
        }
        var next = [];
        for (var i = 0; i < ids.length; i++) {
            if (ids[i] !== id) next.push(ids[i]);
        }
        if (next.length === ids.length) return { ok: true, ids: ids };
        return { ok: true, ids: saveSelectedIds(next) };
    }

    function moveService(id, toIndex) {
        var ids = loadSelectedIds();
        var from = ids.indexOf(id);
        if (from < 0) return { ok: false, ids: ids };
        var next = ids.slice();
        next.splice(from, 1);
        var idx = Math.max(0, Math.min(next.length, parseInt(toIndex, 10) || 0));
        next.splice(idx, 0, id);
        return { ok: true, ids: saveSelectedIds(next) };
    }

    function moreServicesByCategory(selectedIds) {
        var selected = {};
        var ids = selectedIds || loadSelectedIds();
        for (var s = 0; s < ids.length; s++) selected[ids[s]] = true;
        var groups = [];
        var map = {};
        for (var i = 0; i < CATALOG.length; i++) {
            var item = CATALOG[i];
            if (selected[item.id]) continue;
            var cat = item.category || '更多服务';
            if (!map[cat]) {
                map[cat] = { category: cat, items: [] };
                groups.push(map[cat]);
            }
            map[cat].items.push(item);
        }
        return groups;
    }

    function iconSrc(item) {
        var file = (item && item.iconFile) || 'zonghe.png';
        return ICON_DIR + file + ICON_ASSET_Q;
    }

    function iconMarkup(item, size) {
        var s = size || 32;
        return (
            '<img class="hs-icon" src="' +
            esc(iconSrc(item)) +
            '" width="' +
            s +
            '" height="' +
            s +
            '" alt="" decoding="async">'
        );
    }

    function moreCardHtml(assetQ) {
        var q = assetQ == null ? HOME_ASSET_Q : assetQ;
        return (
            '<a class="sy-apk-hitem" href="' +
            MANAGE_HREF +
            '" aria-label="更多功能">' +
            '<img src="/img/home/a6_04.jpg' +
            q +
            '" alt="" loading="lazy" fetchpriority="low" decoding="async">' +
            '</a>'
        );
    }

    function homeCardHtml(item, assetQ) {
        var q = assetQ == null ? HOME_ASSET_Q : assetQ;
        if (item.slice) {
            return (
                '<a class="sy-apk-hitem" href="' +
                esc(item.href) +
                '" aria-label="' +
                esc(item.name) +
                '">' +
                '<img src="' +
                esc(item.slice) +
                q +
                '" alt="" loading="lazy" fetchpriority="low" decoding="async">' +
                '</a>'
            );
        }
        return (
            '<a class="sy-apk-hitem sy-hcard-link" href="' +
            esc(item.href) +
            '" aria-label="' +
            esc(item.name) +
            '">' +
            '<div class="sy-hcard">' +
            '<span class="sy-hcard-icon">' +
            iconMarkup(item, 28) +
            '</span>' +
            '<strong class="sy-hcard-title">' +
            esc(item.name) +
            '</strong>' +
            '<em class="sy-hcard-desc">' +
            esc(item.desc) +
            '</em>' +
            '<span class="sy-hcard-btn" style="background:' +
            esc(item.btnBg) +
            ';color:' +
            esc(item.btnColor) +
            '">' +
            esc(item.btn) +
            '</span>' +
            '</div></a>'
        );
    }

    function renderHomeRow(container, assetQ) {
        if (!container) return loadSelectedIds();
        var ids = loadSelectedIds();
        var html = '';
        for (var i = 0; i < ids.length; i++) {
            var item = getById(ids[i]);
            if (!item) continue;
            html += homeCardHtml(item, assetQ);
        }
        html += moreCardHtml(assetQ);
        container.innerHTML = html;
        return ids;
    }

    function syncHomeRow(container, assetQ) {
        if (!container) return loadSelectedIds();
        if (isDefaultSelection()) return loadSelectedIds();
        return renderHomeRow(container, assetQ);
    }

    var api = {
        STORAGE_KEY: STORAGE_KEY,
        MAX_SELECTED: MAX_SELECTED,
        DEFAULT_IDS: DEFAULT_IDS.slice(),
        CATALOG: CATALOG,
        MANAGE_HREF: MANAGE_HREF,
        HOME_ASSET_Q: HOME_ASSET_Q,
        esc: esc,
        getById: getById,
        loadSelectedIds: loadSelectedIds,
        saveSelectedIds: saveSelectedIds,
        isDefaultSelection: isDefaultSelection,
        addService: addService,
        removeService: removeService,
        moveService: moveService,
        moreServicesByCategory: moreServicesByCategory,
        iconMarkup: iconMarkup,
        renderHomeRow: renderHomeRow,
        syncHomeRow: syncHomeRow
    };

    global.TaxHomeServices = api;
})(typeof window !== 'undefined' ? window : global);
