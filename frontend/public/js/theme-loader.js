/**
 * 从服务端拉取「个人中心 / 底栏 / 各 TAB 页配图」主题与路径，写入 documentElement。
 * 各页在 nav.css 之后引入；个人中心 mine.html 另监听 mineUiConfig 更新配图。
 */
(function () {
  var STORAGE_KEY = 'public_mine_ui_v1';
  var PRELOADED = {};

  function setSrcIfChanged(img, src) {
    if (!img || !src) {
      return;
    }
    if (img.getAttribute('src') !== src) {
      img.src = src;
    }
  }

  function preloadAsset(src) {
    if (!src || PRELOADED[src]) {
      return;
    }
    PRELOADED[src] = true;
    try {
      var img = new Image();
      img.decoding = 'async';
      img.src = src;
    } catch (e) {}
  }

  function preloadConfiguredAssets(cfg) {
    if (!cfg) {
      return;
    }
    [
      cfg.nav_sy_1, cfg.nav_sy_2,
      cfg.nav_db_1, cfg.nav_db_2,
      cfg.nav_bc_1, cfg.nav_bc_2,
      cfg.nav_xx_1, cfg.nav_xx_2,
      cfg.nav_w_1, cfg.nav_w_2,
      cfg.header_male, cfg.header_female,
      cfg.icon_family, cfg.icon_employer, cfg.icon_bank,
      cfg.shouye_banner, cfg.shouye_zdfwdb, cfg.shouye_lb,
      cfg.daiban_header, cfg.bancha_header, cfg.message_header
    ].forEach(preloadAsset);
  }

  function applyBottomNavFromConfig(cfg) {
    if (!cfg) {
      return;
    }
    var nav = document.querySelector('.bottom-nav');
    if (!nav) {
      return;
    }
    nav.querySelectorAll('.nav-item').forEach(function (item) {
      var icon = item.getAttribute('data-icon');
      if (!icon) {
        return;
      }
      var img = item.querySelector('.nav-icon img');
      if (!img) {
        return;
      }
      var active = item.classList.contains('active');
      var k1 = 'nav_' + icon + '_1';
      var k2 = 'nav_' + icon + '_2';
      var def1 = 'caidan/' + icon + '1.png';
      var def2 = 'caidan/' + icon + '2.png';
      var u1 = cfg[k1];
      var u2 = cfg[k2];
      setSrcIfChanged(img, active ? u1 || def1 : u2 || def2);
    });
  }

  function applyTabPageImagesFromConfig(cfg) {
    if (!cfg) {
      return;
    }
    var b = document.getElementById('assetShouyeBanner');
    if (b && cfg.shouye_banner) {
      setSrcIfChanged(b, cfg.shouye_banner);
    }
    var z = document.getElementById('assetShouyeZdfwdb');
    if (z && cfg.shouye_zdfwdb) {
      setSrcIfChanged(z, cfg.shouye_zdfwdb);
    }
    var lb = document.getElementById('assetShouyeLb');
    if (lb && cfg.shouye_lb) {
      setSrcIfChanged(lb, cfg.shouye_lb);
    }
    var dh = document.getElementById('assetDaibanHeader');
    if (dh && cfg.daiban_header) {
      setSrcIfChanged(dh, cfg.daiban_header);
    }
    var bc = document.getElementById('assetBanchaHeader');
    if (bc && cfg.bancha_header) {
      setSrcIfChanged(bc, cfg.bancha_header);
    }
    var mh = document.getElementById('assetMessageHeader');
    var msgBuiltin = document.getElementById('messageHeaderBuiltin');
    if (msgBuiltin) {
      msgBuiltin.style.display = '';
    }
    if (mh) {
      var mp = cfg.message_header ? String(cfg.message_header).trim() : '';
      var useCustom =
        mp && mp !== 'message_header.jpg' && !/(^|\/)message_header\.jpg$/i.test(mp);
      if (useCustom) {
        setSrcIfChanged(mh, mp);
        mh.style.display = 'block';
        if (msgBuiltin) {
          msgBuiltin.style.display = 'none';
        }
      } else {
        mh.removeAttribute('src');
        mh.style.display = 'none';
      }
    }
    var pg = document.getElementById('assetPiaojiaGoumai');
    if (pg && cfg.piaojia_goumai) {
      setSrcIfChanged(pg, cfg.piaojia_goumai);
    }
    var px = document.getElementById('assetPiaojiaXiaoshou');
    if (px && cfg.piaojia_xiaoshou) {
      setSrcIfChanged(px, cfg.piaojia_xiaoshou);
    }
  }

  function applyThemeAndStore(d) {
    if (!d || typeof d !== 'object') {
      return;
    }
    var theme = d.theme === 'yellow' ? 'yellow' : 'blue';
    document.documentElement.setAttribute('data-app-theme', theme);
    var root = document.documentElement;
    if (theme === 'yellow') {
      /* 黄主题保留浅金背景等页面样式，强调色与蓝主题一致（底栏选中、链接等） */
      root.style.setProperty('--app-accent', '#1e6fff');
      root.style.setProperty('--app-accent-mid', '#008afd');
      root.style.setProperty('--app-accent-soft', '#5aa3ff');
      /* 首页顶部与下滑固定搜索条：与蓝主题一致 */
      root.style.setProperty('--shouye-top-bar-rgb', '44, 128, 244');
    } else {
      root.style.setProperty('--app-accent', '#1e6fff');
      root.style.setProperty('--app-accent-mid', '#008afd');
      root.style.setProperty('--app-accent-soft', '#5aa3ff');
      root.style.setProperty('--shouye-top-bar-rgb', '44, 128, 244');
    }
    window.__MINE_UI_CONFIG = {
      theme: theme,
      header_male: d.header_male || 'grdb.jpg',
      header_female: d.header_female || 'nx.jpg',
      icon_family: d.icon_family || 'jtcy.jpg',
      icon_employer: d.icon_employer || 'rzsp.jpg',
      icon_bank: d.icon_bank || 'yhk.jpg',
      nav_sy_1: d.nav_sy_1 || 'caidan/sy1.png',
      nav_sy_2: d.nav_sy_2 || 'caidan/sy2.png',
      nav_db_1: d.nav_db_1 || 'caidan/db1.png',
      nav_db_2: d.nav_db_2 || 'caidan/db2.png',
      nav_bc_1: d.nav_bc_1 || 'caidan/bc1.png',
      nav_bc_2: d.nav_bc_2 || 'caidan/bc2.png',
      nav_xx_1: d.nav_xx_1 || 'caidan/xx1.png',
      nav_xx_2: d.nav_xx_2 || 'caidan/xx2.png',
      nav_w_1: d.nav_w_1 || 'caidan/w1.png',
      nav_w_2: d.nav_w_2 || 'caidan/w2.png',
      shouye_banner: d.shouye_banner || 'sydb-v2.jpg',
      mine_header: d.mine_header || d.header_male || 'grdb.jpg',
      shouye_zdfwdb: d.shouye_zdfwdb || 'zdfwdb.jpg',
      shouye_lb: d.shouye_lb || 'lb.jpg',
      daiban_header: d.daiban_header || 'daiban.jpg',
      bancha_header: d.bancha_header || 'db.jpg',
      message_header: d.message_header || '',
      piaojia_goumai: d.piaojia_goumai || 'piaojia-goumai.png',
      piaojia_xiaoshou: d.piaojia_xiaoshou || 'piaojia-xiaoshou.png'
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(window.__MINE_UI_CONFIG));
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent('mineUiConfig', { detail: window.__MINE_UI_CONFIG }));
    } catch (e2) {}
    applyBottomNavFromConfig(window.__MINE_UI_CONFIG);
    applyTabPageImagesFromConfig(window.__MINE_UI_CONFIG);
    preloadConfiguredAssets(window.__MINE_UI_CONFIG);
  }

  window.__refreshNavFromMineUi = function () {
    applyBottomNavFromConfig(window.__MINE_UI_CONFIG);
    applyTabPageImagesFromConfig(window.__MINE_UI_CONFIG);
  };

  function applyCached() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        applyThemeAndStore(JSON.parse(raw));
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* 不再等首页大图加载完再关转圈，配图后台加载即可 */
  function finishPageLoadingAfterTheme() {
    window.__appPageLoadingThemeDone = true;
    if (typeof window.appPageLoadingDispatchThemeDone === 'function') {
      window.appPageLoadingDispatchThemeDone();
    }
  }

  function prefetchBottomNavPages() {
    var pages = ['shouye.html', 'daiban.html', 'bancha.html', 'message.html', 'mine.html'];
    var here = '';
    try {
      here = String(window.location.pathname || '')
        .split('/')
        .pop()
        .toLowerCase();
    } catch (e0) {}
    pages.forEach(function (page) {
      if (page === here) {
        return;
      }
      if (document.querySelector('link[data-prefetch-nav="' + page + '"]')) {
        return;
      }
      try {
        var link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'document';
        link.href = page;
        link.setAttribute('data-prefetch-nav', page);
        document.head.appendChild(link);
      } catch (e1) {}
    });
  }

  document.documentElement.setAttribute('data-app-theme', 'blue');
  document.documentElement.style.setProperty('--app-accent', '#1e6fff');
  document.documentElement.style.setProperty('--app-accent-mid', '#008afd');
  document.documentElement.style.setProperty('--app-accent-soft', '#5aa3ff');
  document.documentElement.style.setProperty('--shouye-top-bar-rgb', '44, 128, 244');
  // 有缓存时立刻放行加载转圈，后台静默刷新主题，避免每个 TAB 都卡在 mine-ui 请求上
  var hadThemeCache = applyCached();
  if (hadThemeCache) {
    finishPageLoadingAfterTheme();
  }

  fetch('/api/public/mine-ui', { credentials: 'same-origin' })
    .then(function (r) {
      return r.json();
    })
    .then(function (body) {
      if (body.code === 200 && body.data) {
        applyThemeAndStore(body.data);
      }
    })
    .catch(function () {})
    .finally(function () {
      if (!hadThemeCache) {
        finishPageLoadingAfterTheme();
      }
      /* 空闲时预取底栏页面，减轻切 TAB 等待 */
      var runPrefetch = function () {
        prefetchBottomNavPages();
      };
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(runPrefetch, { timeout: 2500 });
      } else {
        setTimeout(runPrefetch, 600);
      }
    });
})();
