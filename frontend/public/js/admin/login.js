/**
 * 管理端登录页逻辑（外置，便于 CSP）
 */
(function () {
  function showErr(m) {
    var el = document.getElementById('err');
    if (el) el.textContent = m || '';
  }

  var btn = document.getElementById('btn');
  if (!btn) return;

  btn.addEventListener('click', function () {
    var u = (document.getElementById('u') && document.getElementById('u').value.trim()) || '';
    var p = (document.getElementById('p') && document.getElementById('p').value) || '';
    if (!u || !p) {
      showErr('请输入账号和密码');
      return;
    }
    btn.disabled = true;
    showErr('');
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (x) {
        if (x.ok && x.j.code === 200 && x.j.data && x.j.data.token) {
          localStorage.setItem('admin_token', x.j.data.token);
          if (x.j.data.admin) {
            localStorage.setItem('admin_profile', JSON.stringify(x.j.data.admin));
          }
          if (x.j.data.menu_tree) {
            try {
              localStorage.setItem('admin_menu_tree', JSON.stringify(x.j.data.menu_tree));
            } catch (e0) {}
          }
          window.location.href = '/admin_panel.html';
          return;
        }
        showErr((x.j && x.j.msg) || '登录失败');
        btn.disabled = false;
      })
      .catch(function () {
        showErr('网络错误');
        btn.disabled = false;
      });
  });

  var pEl = document.getElementById('p');
  if (pEl) {
    pEl.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') btn.click();
    });
  }
})();
