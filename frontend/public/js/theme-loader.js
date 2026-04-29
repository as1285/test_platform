/**
 * 从服务端拉取「个人中心 / 底栏」主题与配图，写入 documentElement。
 * 各页在 nav.css 之后引入；个人中心 mine.html 另监听 mineUiConfig 更新配图。
 */
(function () {
  var STORAGE_KEY = 'public_mine_ui_v1';

  function applyThemeAndStore(d) {
    if (!d || typeof d !== 'object') {
      return;
    }
    var theme = d.theme === 'yellow' ? 'yellow' : 'blue';
    document.documentElement.setAttribute('data-app-theme', theme);
    var root = document.documentElement;
    if (theme === 'yellow') {
      root.style.setProperty('--app-accent', '#d4a012');
      root.style.setProperty('--app-accent-mid', '#e8a820');
      root.style.setProperty('--app-accent-soft', '#f5e6b8');
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
      icon_bank: d.icon_bank || 'yhk.jpg'
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(window.__MINE_UI_CONFIG));
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent('mineUiConfig', { detail: window.__MINE_UI_CONFIG }));
    } catch (e2) {}
  }

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
