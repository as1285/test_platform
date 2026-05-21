/**
 * 收入纳税明细 / 收入纳税明细详情：用户自定义字体（大小、粗细、颜色）
 * localStorage 持久化；未设置时保持页面原有样式；支持一键恢复默认。
 */
(function (global) {
    var STORAGE_KEY = 'h5_user_font_tax_pages';

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
            { id: '333', label: '黑', value: '#333333' },
            { id: 'e53935', label: '红', value: '#e53935' },
            { id: '1e6fff', label: '蓝', value: '#1e6fff' },
            { id: '2e7d32', label: '绿', value: '#2e7d32' }
        ]
    };

    function loadConfig() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var o = JSON.parse(raw);
            if (!o || typeof o !== 'object') return null;
            return o;
        } catch (e) {
            return null;
        }
    }

    function saveConfig(cfg) {
        try {
            if (!cfg || (!cfg.size && !cfg.weight && !cfg.color)) {
                localStorage.removeItem(STORAGE_KEY);
            } else {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
            }
        } catch (e) {}
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
        var sel = getScopeSelector();
        var el = document.querySelector(sel);
        if (el) {
            el.setAttribute('data-ufs-target', '1');
        }
    }

    function applyConfig(cfg) {
        var html = document.documentElement;
        html.classList.remove('user-font-custom', 'ufs-has-size', 'ufs-has-weight', 'ufs-has-color');
        html.style.removeProperty('--ufs-font-size');
        html.style.removeProperty('--ufs-font-weight');
        html.style.removeProperty('--ufs-font-color');

        if (!cfg) return;

        var hasAny = false;
        if (cfg.size) {
            html.classList.add('ufs-has-size');
            html.style.setProperty('--ufs-font-size', cfg.size);
            hasAny = true;
        }
        if (cfg.weight) {
            html.classList.add('ufs-has-weight');
            html.style.setProperty('--ufs-font-weight', String(cfg.weight));
            hasAny = true;
        }
        if (cfg.color) {
            html.classList.add('ufs-has-color');
            html.style.setProperty('--ufs-font-color', cfg.color);
            hasAny = true;
        }
        if (hasAny) {
            html.classList.add('user-font-custom');
        }
    }

    function buildPanel(host, state, onChange) {
        var panel = document.createElement('div');
        panel.className = 'ufs-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', '字体设置');

        var title = document.createElement('div');
        title.className = 'ufs-panel-title';
        title.textContent = '字体设置';
        panel.appendChild(title);

        function addGroup(label, key, presets, isColor) {
            var group = document.createElement('div');
            group.className = 'ufs-group';
            var lab = document.createElement('div');
            lab.className = 'ufs-group-label';
            lab.textContent = label;
            group.appendChild(lab);
            var opts = document.createElement('div');
            opts.className = 'ufs-options';
            presets.forEach(function (p) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ufs-opt' + (isColor ? ' ufs-opt-swatch' : '');
                if (isColor) {
                    btn.style.backgroundColor = p.value;
                    btn.setAttribute('aria-label', p.label);
                } else {
                    btn.textContent = p.label;
                }
                if (state[key] === p.value) {
                    btn.classList.add('is-active');
                }
                btn.addEventListener('click', function () {
                    var next = {};
                    if (state.size) next.size = state.size;
                    if (state.weight) next.weight = state.weight;
                    if (state.color) next.color = state.color;
                    if (state[key] === p.value) {
                        delete next[key];
                    } else {
                        next[key] = p.value;
                    }
                    onChange(next);
                });
                opts.appendChild(btn);
            });
            group.appendChild(opts);
            panel.appendChild(group);
        }

        addGroup('字号', 'size', PRESETS.size, false);
        addGroup('粗细', 'weight', PRESETS.weight, false);
        addGroup('颜色', 'color', PRESETS.color, true);

        var resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'ufs-reset';
        resetBtn.textContent = '一键恢复默认';
        resetBtn.addEventListener('click', function () {
            onChange(null);
        });
        panel.appendChild(resetBtn);

        var hint = document.createElement('div');
        hint.className = 'ufs-hint';
        hint.textContent = '设置即时生效并自动保存；两页共用。再次点击选项可取消该项。';
        panel.appendChild(hint);

        host.appendChild(panel);
        return panel;
    }

    function refreshActiveButtons(host, state) {
        state = state || {};
        host.querySelectorAll('.ufs-opt').forEach(function (btn) {
            btn.classList.remove('is-active');
        });
        host.querySelectorAll('.ufs-group').forEach(function (group, gi) {
            var keys = ['size', 'weight', 'color'];
            var key = keys[gi];
            if (!key) return;
            var presets = PRESETS[key];
            var btns = group.querySelectorAll('.ufs-opt');
            presets.forEach(function (p, idx) {
                if (state[key] === p.value && btns[idx]) {
                    btns[idx].classList.add('is-active');
                }
            });
        });
    }

    function mountUi() {
        if (document.getElementById('ufs-host')) return;

        var state = loadConfig() || {};

        var host = document.createElement('div');
        host.id = 'ufs-host';
        host.className = 'ufs-host';

        var fab = document.createElement('button');
        fab.type = 'button';
        fab.className = 'ufs-fab';
        fab.setAttribute('aria-label', '字体设置');
        fab.textContent = '字';

        var panel = buildPanel(host, state, function (next) {
            state = next || {};
            saveConfig(state);
            applyConfig(state);
            refreshActiveButtons(host, state);
            if (!next || (!next.size && !next.weight && !next.color)) {
                host.classList.remove('is-open');
            }
        });

        fab.addEventListener('click', function (e) {
            e.stopPropagation();
            host.classList.toggle('is-open');
        });

        document.addEventListener('click', function (e) {
            if (!host.classList.contains('is-open')) return;
            if (!host.contains(e.target)) {
                host.classList.remove('is-open');
            }
        });

        host.appendChild(fab);
        document.body.appendChild(host);
        markScope();
        refreshActiveButtons(host, state);
    }

    function boot() {
        applyConfig(loadConfig());
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
            saveConfig(null);
            applyConfig(null);
        }
    };

    boot();
})(typeof window !== 'undefined' ? window : this);
