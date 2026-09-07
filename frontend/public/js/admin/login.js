/**
 * 管理端登录页逻辑（外置，便于 CSP）
 * 支持连续失败锁定提示 + 可选邮件 OTP 二步验证
 */
(function () {
  var challengeId = '';

  function showErr(m) {
    var el = document.getElementById('err');
    if (el) el.textContent = m || '';
  }

  function setOtpVisible(show, hint) {
    var field = document.getElementById('otpField');
    var hintEl = document.getElementById('otpHint');
    if (field) field.hidden = !show;
    if (hintEl) hintEl.textContent = hint || '';
    if (!show) {
      challengeId = '';
      var otpEl = document.getElementById('otp');
      if (otpEl) otpEl.value = '';
    }
  }

  function finishLogin(data) {
    localStorage.setItem('admin_token', data.token);
    if (data.admin) {
      localStorage.setItem('admin_profile', JSON.stringify(data.admin));
    }
    if (data.menu_tree) {
      try {
        localStorage.setItem('admin_menu_tree', JSON.stringify(data.menu_tree));
      } catch (e0) {}
    }
    window.location.href = '/admin_panel.html?v=20260905-ch-psych-col';
  }

  var btn = document.getElementById('btn');
  if (!btn) return;

  btn.addEventListener('click', function () {
    var u = (document.getElementById('u') && document.getElementById('u').value.trim()) || '';
    var p = (document.getElementById('p') && document.getElementById('p').value) || '';
    var otp = (document.getElementById('otp') && document.getElementById('otp').value.trim()) || '';
    if (!u || !p) {
      showErr('请输入账号和密码');
      return;
    }
    if (challengeId && !otp) {
      showErr('请输入邮件验证码');
      return;
    }
    btn.disabled = true;
    showErr('');
    var payload = { username: u, password: p };
    if (challengeId) {
      payload.challenge_id = challengeId;
      payload.otp = otp;
    }
    fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r).then(function (j) {
          return { ok: r.ok, status: r.status, j: j };
        });
      })
      .then(function (x) {
        if (x.ok && x.j.code === 200 && x.j.data && x.j.data.otp_required) {
          challengeId = String(x.j.data.challenge_id || '');
          setOtpVisible(
            true,
            '验证码已发送至 ' + (x.j.data.email_masked || '邮箱') + '，请查收后继续登录'
          );
          showErr('');
          btn.disabled = false;
          var otpEl = document.getElementById('otp');
          if (otpEl) otpEl.focus();
          return;
        }
        if (x.ok && x.j.code === 200 && x.j.data && x.j.data.token) {
          finishLogin(x.j.data);
          return;
        }
        if (x.status === 423 || (x.j && x.j.code === 423)) {
          setOtpVisible(false);
        }
        showErr((x.j && x.j.msg) || '登录失败');
        btn.disabled = false;
      })
      .catch(function () {
        showErr('网络错误');
        btn.disabled = false;
      });
  });

  function bindEnter(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') btn.click();
    });
  }
  bindEnter('p');
  bindEnter('otp');
})();
