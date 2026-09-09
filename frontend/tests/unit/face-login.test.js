import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const frontend = resolve(__dirname, '../..');
const login = readFileSync(resolve(frontend, 'login.html'), 'utf8');
const facePath = resolve(frontend, 'face_login.html');
const face = readFileSync(facePath, 'utf8');
const boot = readFileSync(resolve(frontend, 'public/js/auth-boot.js'), 'utf8');
const auth = readFileSync(resolve(frontend, 'public/js/auth.js'), 'utf8');
const loading = readFileSync(resolve(frontend, 'public/js/page-loading.js'), 'utf8');

describe('扫脸登录 continues past 安全验证', () => {
  it('login 扫脸登录 goes to face_login.html, not the closed alert', () => {
    expect(login).toContain('id="linkFaceLogin"');
    expect(login).toContain('href="face_login.html"');
    expect(login).toContain("window.location.href = href");
    expect(login).toContain('face_login_draft_v1');
    expect(login).toContain('applyFaceLoginReturn');
    expect(login).toContain("params.get('face_ok')");
    expect(login).not.toMatch(
      /linkFaceLogin[\s\S]{0,240}扫脸登录功能暂未开放/
    );
    // 扫脸回跳只点亮绿色「验证通过!」，不弹橙黄 tip
    expect(login).toMatch(
      /applyFaceLoginReturn[\s\S]*?showLoginFormTip\(\s*''\s*\)/
    );
    expect(login).not.toMatch(
      /applyFaceLoginReturn[\s\S]*?showLoginFormTip\(\s*msg\s*\)/
    );
    expect(login).not.toContain('扫脸演示已完成，请使用账号密码登录');
    expect(login).not.toContain('扫脸验证已通过，请输入密码完成登录');
  });

  it('face_login page is the 安全验证 gate then demo face scan', () => {
    expect(existsSync(facePath)).toBe(true);
    expect(face).toContain('<title>安全验证</title>');
    expect(face).toContain('class="header-title">安全验证<');
    expect(face).toContain('为保证您的信息安全，请进行验证');
    expect(face).toContain('请按住滑块，拖动到最右边');
    expect(face).toContain('验证通过!');
    expect(face).toContain('startFaceScan');
    expect(face).toContain('finishFaceLogin');
    expect(face).toContain('请将面部对准框内');
    expect(face).toContain('识别成功');
    expect(face).toContain('forceHidePageLoading');
    expect(face).toContain('forceClearLoader');
    expect(face).toContain('20260909-hinova9se-mine-pad-v5');
    expect(face).not.toContain('face_msg');
    expect(face).not.toContain('扫脸演示已完成，请使用账号密码登录');
    expect(face).not.toContain('扫脸验证已通过，请输入密码完成登录');
    expect(face).not.toMatch(/showPageLoading\s*\(/);
    // 滑块跟在文案下方，禁止 fixed 贴底造成半屏空洞 + 壳层蓝底透出
    expect(face).toMatch(/\.slider-section\s*\{[^}]*position:\s*static/s);
    expect(face).not.toMatch(/\.slider-section\s*\{[^}]*position:\s*fixed/s);
    expect(face).toMatch(/body\.page-face-login\s*\{[^}]*min-height:\s*100vh/s);
    expect(face).toContain('background: #fff !important');
  });

  it('auth treats face_login as a white status page', () => {
    expect(auth).toContain("p === 'face_login.html'");
    expect(auth).toContain("body.classList.contains('page-face-login')");
    expect(auth).toContain('body.page-face-login::before{display:none');
  });

  it('verify page is public and skips the stuck loading HUD', () => {
    expect(boot).toContain("'face_login.html': true");
    expect(auth).toContain("'face_login.html': true");
    expect(auth).toMatch(/skipLoadingPages[\s\S]*'face_login\.html': true/);
    expect(loading).toMatch(/SKIP_PAGES[\s\S]*'face_login\.html': true/);
    expect(auth).toContain('page-loading.js?v=20260905-scan');
  });
});
