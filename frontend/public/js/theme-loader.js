/**
 * 从服务端拉取「个人中心 / 底栏 / 各 TAB 页配图」主题与路径，写入 documentElement。
 * 各页在 nav.css 之后引入；个人中心 mine.html 另监听 mineUiConfig 更新配图。
 */
(function () {
  var STORAGE_KEY = 'public_mine_ui_v1';

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
      img.src = active ? u1 || def1 : u2 || def2;
    });
  }

  function applyTabPageImagesFromConfig(cfg) {
    if (!cfg) {
      return;
    }
    var b = document.getElementById('assetShouyeBanner');
    if (b && cfg.shouye_banner) {
      b.src = cfg.shouye_banner;
    }
    var z = document.getElementById('assetShouyeZdfwdb');
    if (z && cfg.shouye_zdfwdb) {
      z.src = cfg.shouye_zdfwdb;
    }
    var lb = document.getElementById('assetShouyeLb');
    if (lb && cfg.shouye_lb) {
      lb.src = cfg.shouye_lb;
    }
    var dh = document.getElementById('assetDaibanHeader');
    if (dh && cfg.daiban_header) {
      dh.src = cfg.daiban_header;
    }
    var bc = document.getElementById('assetBanchaHeader');
    if (bc && cfg.bancha_header) {
      bc.src = cfg.bancha_header;
    }
    var mh = document.getElementById('assetMessageHeader');
    if (mh && cfg.message_header) {
      mh.src = cfg.message_header;
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
    } else {
      root.style.setProperty('--app-accent', '#1e6fff');
      root.style.setProperty('--app-accent-mid', '#008afd');
      root.style.setProperty('--app-accent-soft', '#5aa3ff');
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
      shouye_zdfwdb: d.shouye_zdfwdb || 'zdfwdb.jpg',
      shouye_lb: d.shouye_lb || 'lb.jpg',
      daiban_header: d.daiban_header || 'daiban.jpg',
      bancha_header: d.bancha_header || 'db.jpg',
      message_header: d.message_header || 'message_header.jpg'
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(window.__MINE_UI_CONFIG));
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent('mineUiConfig', { detail: window.__MINE_UI_CONFIG }));
    } catch (e2) {}
    applyBottomNavFromConfig(window.__MINE_UI_CONFIG);
    applyTabPageImagesFromConfig(window.__MINE_UI_CONFIG);
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

  document.documentElement.setAttribute('data-app-theme', 'blue');
  document.documentElement.style.setProperty('--app-accent', '#1e6fff');
  document.documentElement.style.setProperty('--app-accent-mid', '#008afd');
  document.documentElement.style.setProperty('--app-accent-soft', '#5aa3ff');
  applyCached();

  fetch('/api/public/mine-ui', { credentials: 'same-origin' })
    .then(function (r) {
      return r.json();
    })
    .then(function (body) {
      if (body.code === 200 && body.data) {
        applyThemeAndStore(body.data);
      }
    })
    .catch(function () {});
})();
