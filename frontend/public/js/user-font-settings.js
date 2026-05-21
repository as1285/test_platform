/**
 * 收入纳税明细 / 详情：用户自定义字体（全局或按区域分项）
 */
(function (global) {
    var STORAGE_KEY = 'h5_user_font_tax_pages';
    var FAB_MANUAL_HIDDEN_KEY = 'h5_user_font_fab_manual_hidden';
    var FAB_CAPTURE_AUTO_KEY = 'h5_user_font_capture_auto_hide';
    var STYLE_ID = 'ufs-dynamic-rules';

    var PRESETS = {
        size: [
            { id: '14', label: '14', value: '14px' },
            { id: '16', label: '16', value: '16px' },
            { id: '18', label: '18', value: '18px' },
            { id: '20', label: '20', value: '20px' }
        ],
        weight: [
            { id: '400', label: '正常', value: '400' },
            { id: '600', label: '加粗', value: '600' },
            { id: '700', label: '更粗', value: '700' }
        ],
        color: [
            { id: '000', label: '纯黑', value: '#000000' },
            { id: '333', label: '深灰', value: '#333333' },
            { id: '666', label: '中灰', value: '#666666' },
            { id: '999', label: '浅灰', value: '#999999' }
        ]
    };

    var ROLES_RESULT = [
        { id: 'all', label: '全局', selectors: null },
        { id: 'header', label: '顶栏', selectors: '.header-title, .back-btn, .header-right' },
        { id: 'summary', label: '汇总区', selectors: '.summary-label, .summary-value' },
        { id: 'listTitle', label: '列表标题', selectors: '.list-title, .list-date' },
        { id: 'listBody', label: '列表正文', selectors: '.list-label, .list-value, .list-company' }
    ];

    var ROLES_DETAIL = [
        { id: 'all', label: '全局', selectors: null },
        { id: 'header', label: '顶栏', selectors: '.header-title, .back-btn, .header-right' },
        { id: 'section', label: '区块标题', selectors: '.section-title' },
        { id: 'info', label: '纳税信息', selectors: '.info-label, .info-value, .info-link' },
        { id: 'tips', label: '温馨提示', selectors: '.tips, .tips-link' },
        { id: 'detail', label: '收入扣除', selectors: '.detail-label, .detail-value' }
    ];

    var EXCLUDE_SEL =
        ':not(svg):not(path):not(img):not(.ufs-host):not(.ufs-host *):not(#__wm_layer__):not(#__wm_layer__ *)';

    var captureHideTimer = null;
    var toastTimer = null;
    var panelUi = null;

    function getRoles() {
        var p = (location.pathname || '').toLowerCase();
        if (p.indexOf('xiangqing') !== -1) return ROLES_DETAIL;
        return ROLES_RESULT;
    }

    function getRestoreLinkLabel() {
        var p = (location.pathname || '').toLowerCase();
        return p.indexOf('xiangqing') !== -1 ? '申诉' : '批量申诉';
    }

    function normalizeConfig(raw) {
        if (!raw || typeof raw !== 'object') {
            return { activeTarget: 'all', targets: {} };
        }
        if (raw.targets && typeof raw.targets === 'object') {
            return {
                activeTarget: raw.activeTarget || 'all',
                targets: raw.targets
            };
        }
        if (raw.size || raw.weight || raw.color) {
            return {
                activeTarget: 'all',
                targets: {
                    all: {
                        size: raw.size || undefined,
                        weight: raw.weight || undefined,
                        color: raw.color || undefined
                    }
                }
            };
        }
        return { activeTarget: 'all', targets: {} };
    }

    function targetHasStyle(t) {
        return !!(t && (t.size || t.weight || t.color));
    }

    function configIsEmpty(cfg) {
        if (!cfg || !cfg.targets) return true;
        return !Object.keys(cfg.targets).some(function (k) {
            return targetHasStyle(cfg.targets[k]);
        });
    }

    function loadConfig() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return normalizeConfig(null);
            return normalizeConfig(JSON.parse(raw));
        } catch (e) {
            return normalizeConfig(null);
        }
    }

    function saveConfig(cfg) {
        try {
            if (configIsEmpty(cfg)) {
                localStorage.removeItem(STORAGE_KEY);
            } else {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
            }
        } catch (e) {}
    }

    function getTargetState(cfg, targetId) {
        return (cfg.targets && cfg.targets[targetId]) || {};
    }

    function setTargetState(cfg, targetId, patch) {
        var next = {
            activeTarget: cfg.activeTarget || 'all',
            targets: Object.assign({}, cfg.targets || {})
        };
        var cur = Object.assign({}, next.targets[targetId] || {});
        if (patch.size === null) delete cur.size;
        else if (patch.size) cur.size = patch.size;
        if (patch.weight === null) delete cur.weight;
        else if (patch.weight) cur.weight = patch.weight;
        if (patch.color === null) delete cur.color;
        else if (patch.color) cur.color = patch.color;
        if (!targetHasStyle(cur)) {
            delete next.targets[targetId];
        } else {
            next.targets[targetId] = cur;
        }
        return next;
    }

    function toggleProp(cfg, targetId, key, value) {
        var cur = getTargetState(cfg, targetId);
        var patch = {};
        if (cur[key] === value) {
            patch[key] = null;
        } else {
            patch[key] = value;
        }
        return setTargetState(cfg, targetId, patch);
    }

    function isManualFabHidden() {
        try {
            return localStorage.getItem(FAB_MANUAL_HIDDEN_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function setManualFabHidden(hidden) {
        try {
            if (hidden) localStorage.setItem(FAB_MANUAL_HIDDEN_KEY, '1');
            else localStorage.removeItem(FAB_MANUAL_HIDDEN_KEY);
        } catch (e) {}
        syncFabVisibility();
    }

    function isCaptureAutoHideEnabled() {
        try {
            return localStorage.getItem(FAB_CAPTURE_AUTO_KEY) !== '0';
        } catch (e) {
            return true;
        }
    }

    function setCaptureAutoHideEnabled(on) {
        try {
            localStorage.setItem(FAB_CAPTURE_AUTO_KEY, on ? '1' : '0');
        } catch (e) {}
        if (panelUi) syncCaptureHideButtons();
    }

    function syncFabVisibility() {
        document.documentElement.classList.toggle('ufs-fab-hidden', isManualFabHidden());
    }

    function setCaptureHideTemporary(ms) {
        if (!isCaptureAutoHideEnabled() || isManualFabHidden()) return;
        var html = document.documentElement;
        html.classList.add('ufs-capture-hide');
        if (captureHideTimer) clearTimeout(captureHideTimer);
        captureHideTimer = setTimeout(function () {
            html.classList.remove('ufs-capture-hide');
            captureHideTimer = null;
        }, ms || 3500);
    }

    function showToast(msg) {
        var el = document.getElementById('ufs-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'ufs-toast';
            el.className = 'ufs-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('is-show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            el.classList.remove('is-show');
        }, 2200);
    }

    function getScopeSelector() {
        var scripts = document.getElementsByTagName('script');
        for (var i = scripts.length - 1; i >= 0; i--) {
            var s = scripts[i];
            if (s.src && s.src.indexOf('user-font-settings.js') !== -1) {
                return s.getAttribute('data-scope') || 'body';
            }
        }
        return 'body';
    }

    function markScope() {
        var el = document.querySelector(getScopeSelector());
        if (el) el.setAttribute('data-ufs-target', '1');
    }

    function buildSelectorList(role) {
        var scope = '[data-ufs-target]';
        if (role.id === 'all') {
            return [scope + ' *' + EXCLUDE_SEL, scope];
        }
        if (!role.selectors) return [];
        return role.selectors.split(',').map(function (s) {
            return scope + ' ' + s.trim() + EXCLUDE_SEL;
        });
    }

    function applyConfig(cfg) {
        cfg = normalizeConfig(cfg);
        var html = document.documentElement;
        var styleEl = document.getElementById(STYLE_ID);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = STYLE_ID;
            document.head.appendChild(styleEl);
        }

        if (configIsEmpty(cfg)) {
            html.classList.remove('user-font-custom');
            styleEl.textContent = '';
            return;
        }

        html.classList.add('user-font-custom');
        var roles = getRoles();
        var roleMap = {};
        roles.forEach(function (r) {
            roleMap[r.id] = r;
        });

        var order = ['all'];
        roles.forEach(function (r) {
            if (r.id !== 'all' && cfg.targets[r.id] && targetHasStyle(cfg.targets[r.id])) {
                order.push(r.id);
            }
        });

        var css = [];
        order.forEach(function (rid) {
            var t = cfg.targets[rid];
            if (!targetHasStyle(t)) return;
            var role = roleMap[rid];
            if (!role) return;
            var decl = [];
            if (t.size) decl.push('font-size:' + t.size + ' !important');
            if (t.weight) decl.push('font-weight:' + t.weight + ' !important');
            if (t.color) decl.push('color:' + t.color + ' !important');
            if (!decl.length) return;
            var sels = buildSelectorList(role);
            if (sels.length) {
                css.push(sels.join(',\n') + ' {\n  ' + decl.join(';\n  ') + ';\n}');
            }
        });

        styleEl.textContent = css.join('\n\n');
    }

    function bindLongPress(el, ms, onFire) {
        if (!el) return;
        var timer = null;
        function clear() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        }
        function start() {
            clear();
            timer = setTimeout(function () {
                timer = null;
                onFire();
            }, ms);
        }
        el.addEventListener('touchstart', start, { passive: true });
        el.addEventListener('touchend', clear);
        el.addEventListener('touchcancel', clear);
        el.addEventListener('touchmove', clear);
        el.addEventListener('mousedown', start);
        el.addEventListener('mouseup', clear);
        el.addEventListener('mouseleave', clear);
    }

    function initCaptureHideListeners() {
        function onCaptureSignal() {
            setCaptureHideTemporary(4000);
        }
        window.addEventListener('blur', onCaptureSignal);
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) onCaptureSignal();
        });
        window.addEventListener('pagehide', onCaptureSignal);
        ['user-capture-screen', 'screenshot', 'screenrecordstart', 'screen-capture'].forEach(function (name) {
            document.addEventListener(name, onCaptureSignal);
            window.addEventListener(name, onCaptureSignal);
        });
        window.onUserCaptureScreen = onCaptureSignal;
        window.onScreenRecordStart = onCaptureSignal;
        var lastH = window.innerHeight;
        window.addEventListener('resize', function () {
            if (!isCaptureAutoHideEnabled()) return;
            var dh = Math.abs(window.innerHeight - lastH);
            lastH = window.innerHeight;
            if (dh > 0 && dh < 80) onCaptureSignal();
        });
    }

    var captureHideButtonsBound = false;

    function syncCaptureHideButtons() {
        if (!panelUi || !panelUi.captureBtn) return;
        var on = isCaptureAutoHideEnabled();
        panelUi.captureBtn.classList.toggle('is-on', on);
        panelUi.captureBtn.textContent = on ? '截图/录屏时自动隐藏：开' : '截图/录屏时自动隐藏：关';
    }

    function refreshPanelUi(host, cfg) {
        if (!panelUi) return;
        cfg = normalizeConfig(cfg);
        var roles = getRoles();
        var active = cfg.activeTarget || 'all';
        var activeRole = roles.filter(function (r) {
            return r.id === active;
        })[0];
        panelUi.editingLabel.textContent = '正在调整：' + (activeRole ? activeRole.label : '全局');

        panelUi.chips.innerHTML = '';
        roles.forEach(function (role) {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'ufs-target-chip';
            if (role.id === active) chip.classList.add('is-active');
            if (targetHasStyle(getTargetState(cfg, role.id))) chip.classList.add('has-custom');
            chip.textContent = role.label;
            chip.addEventListener('click', function (e) {
                e.stopPropagation();
                cfg.activeTarget = role.id;
                saveConfig(cfg);
                refreshPanelUi(host, cfg);
                refreshPresetButtons(host, cfg);
            });
            panelUi.chips.appendChild(chip);
        });

        refreshPresetButtons(host, cfg);
    }

    function refreshPresetButtons(host, cfg) {
        if (!panelUi) return;
        var targetId = cfg.activeTarget || 'all';
        var state = getTargetState(cfg, targetId);
        host.querySelectorAll('.ufs-preset-group').forEach(function (group) {
            var key = group.getAttribute('data-key');
            var presets = PRESETS[key];
            if (!presets) return;
            var btns = group.querySelectorAll('.ufs-opt');
            presets.forEach(function (p, idx) {
                if (btns[idx]) {
                    btns[idx].classList.toggle('is-active', state[key] === p.value);
                }
            });
        });
    }

    function buildPanel(host, cfg, onConfigChange) {
        var panel = document.createElement('div');
        panel.className = 'ufs-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', '字体设置');

        var title = document.createElement('div');
        title.className = 'ufs-panel-title';
        title.textContent = '字体设置';
        panel.appendChild(title);

        var chips = document.createElement('div');
        chips.className = 'ufs-target-chips';
        panel.appendChild(chips);

        var editingLabel = document.createElement('div');
        editingLabel.className = 'ufs-editing-label';
        panel.appendChild(editingLabel);

        function addPresetGroup(label, key, isColor) {
            var group = document.createElement('div');
            group.className = 'ufs-group ufs-preset-group';
            group.setAttribute('data-key', key);
            var lab = document.createElement('div');
            lab.className = 'ufs-group-label';
            lab.textContent = label;
            group.appendChild(lab);
            var opts = document.createElement('div');
            opts.className = 'ufs-options';
            PRESETS[key].forEach(function (p) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ufs-opt' + (isColor ? ' ufs-opt-swatch' : '');
                if (isColor) {
                    btn.style.backgroundColor = p.value;
                    btn.setAttribute('aria-label', p.label);
                } else {
                    btn.textContent = p.label;
                }
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var tid = cfg.activeTarget || 'all';
                    var next = toggleProp(cfg, tid, key, p.value);
                    onConfigChange(next);
                });
                opts.appendChild(btn);
            });
            group.appendChild(opts);
            panel.appendChild(group);
        }

        addPresetGroup('字号', 'size', false);
        addPresetGroup('粗细', 'weight', false);
        addPresetGroup('颜色', 'color', true);

        var clearTargetBtn = document.createElement('button');
        clearTargetBtn.type = 'button';
        clearTargetBtn.className = 'ufs-action-btn';
        clearTargetBtn.textContent = '清除当前区域设置';
        clearTargetBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var tid = cfg.activeTarget || 'all';
            var next = Object.assign({}, cfg, { targets: Object.assign({}, cfg.targets) });
            delete next.targets[tid];
            onConfigChange(next);
        });
        panel.appendChild(clearTargetBtn);

        var closePanelBtn = document.createElement('button');
        closePanelBtn.type = 'button';
        closePanelBtn.className = 'ufs-action-btn';
        closePanelBtn.textContent = '收起面板';
        closePanelBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            host.classList.remove('is-open');
        });
        panel.appendChild(closePanelBtn);

        var actions = document.createElement('div');
        actions.className = 'ufs-row-actions';

        var hideNowBtn = document.createElement('button');
        hideNowBtn.type = 'button';
        hideNowBtn.className = 'ufs-action-btn';
        hideNowBtn.textContent = '立即隐藏「字」按钮';
        hideNowBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            setManualFabHidden(true);
            host.classList.remove('is-open');
            showToast('已隐藏；点击右上角「' + getRestoreLinkLabel() + '」可恢复');
        });
        actions.appendChild(hideNowBtn);

        var captureBtn = document.createElement('button');
        captureBtn.type = 'button';
        captureBtn.className = 'ufs-action-btn';
        captureBtn.id = 'ufs-capture-auto-btn';
        captureBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            setCaptureAutoHideEnabled(!isCaptureAutoHideEnabled());
        });
        actions.appendChild(captureBtn);
        panel.appendChild(actions);

        var resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'ufs-reset';
        resetBtn.textContent = '一键恢复全部默认字体';
        resetBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            onConfigChange(normalizeConfig(null));
        });
        panel.appendChild(resetBtn);

        var hint = document.createElement('div');
        hint.className = 'ufs-hint';
        hint.textContent =
            '先点顶栏/汇总区等切换区域，再调字号；面板保持打开，可逐项设置。再次点「字」或「收起面板」关闭。';
        panel.appendChild(hint);

        panelUi = {
            chips: chips,
            editingLabel: editingLabel,
            captureBtn: captureBtn
        };

        function stopPanelEvent(e) {
            e.stopPropagation();
        }
        panel.addEventListener('click', stopPanelEvent);
        panel.addEventListener('touchstart', stopPanelEvent, { passive: true });

        host.appendChild(panel);
        refreshPanelUi(host, cfg);
        syncCaptureHideButtons();
        return panel;
    }

    function bindHeaderRightRestore() {
        document.querySelectorAll('.header-right').forEach(function (el) {
            el.addEventListener(
                'click',
                function (e) {
                    if (!isManualFabHidden()) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setManualFabHidden(false);
                    showToast('已恢复「字」按钮');
                },
                true
            );
        });
    }

    function mountUi() {
        if (document.getElementById('ufs-host')) return;

        var cfg = loadConfig();

        var host = document.createElement('div');
        host.id = 'ufs-host';
        host.className = 'ufs-host';

        var fab = document.createElement('button');
        fab.type = 'button';
        fab.className = 'ufs-fab';
        fab.setAttribute('aria-label', '字体设置');
        fab.textContent = '字';

        bindLongPress(fab, 600, function () {
            setManualFabHidden(true);
            host.classList.remove('is-open');
            showToast('已隐藏；点击「' + getRestoreLinkLabel() + '」可恢复');
        });

        buildPanel(host, cfg, function (next) {
            cfg = normalizeConfig(next);
            saveConfig(cfg);
            applyConfig(cfg);
            refreshPanelUi(host, cfg);
            if (configIsEmpty(cfg)) {
                host.classList.remove('is-open');
            }
        });

        fab.addEventListener('click', function (e) {
            e.stopPropagation();
            host.classList.toggle('is-open');
            if (host.classList.contains('is-open')) {
                refreshPanelUi(host, cfg);
            }
        });

        host.addEventListener('click', function (e) {
            e.stopPropagation();
        });
        host.addEventListener('touchstart', function (e) {
            e.stopPropagation();
        }, { passive: true });

        host.appendChild(fab);
        document.body.appendChild(host);
        markScope();
        syncFabVisibility();
        bindHeaderRightRestore();

        if (!captureHideButtonsBound) {
            captureHideButtonsBound = true;
            initCaptureHideListeners();
        }
    }

    function boot() {
        applyConfig(loadConfig());
        syncFabVisibility();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                markScope();
                mountUi();
            });
        } else {
            markScope();
            mountUi();
        }
    }

    global.UserFontSettings = {
        storageKey: STORAGE_KEY,
        load: loadConfig,
        save: saveConfig,
        apply: applyConfig,
        reset: function () {
            saveConfig(normalizeConfig(null));
            applyConfig(normalizeConfig(null));
        },
        setFabVisible: function (visible) {
            setManualFabHidden(!visible);
        },
        hideFabForCapture: function (ms) {
            setCaptureHideTemporary(ms || 4000);
        },
        showToast: showToast,
        getRoles: getRoles
    };

    boot();
})(typeof window !== 'undefined' ? window : this);
