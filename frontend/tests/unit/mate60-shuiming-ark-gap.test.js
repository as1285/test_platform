import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const core = readFileSync(resolve(__dirname, '../../public/js/app/core.js'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8');

describe('Mate 60 Pro 收入纳税明细筛选页顶空白', () => {
  it('ark 自修复跳过自管 fixed+40px 白顶栏页（含 page-shuiming）', () => {
    expect(auth).toContain('ARK_SELF_MANAGED_WHITE_TOP_PAGES');
    expect(auth).toContain("'page-shuiming'");
    expect(auth).toContain("'page-shuiming-result'");
    expect(auth).toContain("'page-xiangqing'");
    expect(auth).toContain("'page-message-detail'");
    expect(auth).toContain('function skipArkSelfManagedWhiteTop');
    expect(auth).toContain('if (skipArkSelfManagedWhiteTop()) return;');
    expect(auth).not.toMatch(
      /if \(b\.classList\.contains\('page-message-detail'\)\) \{\s*var staleShield/
    );
  });

  it('core.js 同步跳过，避免双通道再钉相对头', () => {
    expect(core).toContain('ARK_SELF_MANAGED_WHITE_TOP_PAGES');
    expect(core).toContain("'page-shuiming'");
    expect(core).toContain('if (skipArkSelfManagedWhiteTop()) return;');
  });

  it('CSS 强制 Mate60 筛选页 fixed+40px，并隐藏 ark 白顶遮挡条', () => {
    expect(auth).toContain(
      'html.app-android-huawei-mate60 body.page-shuiming #arkWhiteTopShield'
    );
    expect(auth).toContain(
      'html.app-android-huawei-mate60 body.page-shuiming > .header'
    );
    expect(auth).toContain(
      'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming > .content{'
    );
    expect(auth).toContain(
      'padding-top:calc(46px + var(--app-shell-statusbar-top,40px)) !important;}'
    );
  });

  it('shuiming.html 缓存戳更新到 mate60-sm-gap', () => {
    expect(shuiming).toContain('auth.js?v=20260909-mate60-sm-gap');
  });
});
