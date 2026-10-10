import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const guide = readFileSync(resolve(__dirname, '../../public/js/conversion-guide.js'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

describe('开通后绿色顶栏提示已下线', () => {
  it('不再往我的页插入已开通编辑横幅', () => {
    expect(guide).toContain('function renderPostActivateMineEditBanner()');
    expect(guide).toContain('removePostActivateMineEditBanner();');
    expect(guide).toMatch(
      /function renderPostActivateMineEditBanner\(\)\s*\{\s*removePostActivateMineEditBanner\(\);\s*\}/
    );
    expect(guide).not.toContain("banner.id = 'cg-post-activate-edit-banner'");
    expect(guide).toContain('#cg-post-activate-edit-banner,.cg-post-activate-edit-banner{display:none!important}');
  });

  it('auth 注入 conversion-guide 带上缓存戳', () => {
    expect(auth).toContain('conversion-guide.js?v=20261010-mine-activate');
  });
});
