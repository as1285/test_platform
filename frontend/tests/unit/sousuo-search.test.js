import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const frontend = resolve(__dirname, '../..');
const shouye = readFileSync(resolve(frontend, 'shouye.html'), 'utf8');
const sousuo = readFileSync(resolve(frontend, 'sousuo.html'), 'utf8');
const boot = readFileSync(resolve(frontend, 'public/js/auth-boot.js'), 'utf8');
const auth = readFileSync(resolve(frontend, 'public/js/auth.js'), 'utf8');

describe('homepage search opens sousuo', () => {
  it('search hotspot goes to sousuo.html', () => {
    expect(shouye).toContain('class="sy-ahead-hit sy-hit-search"');
    expect(shouye).toMatch(/href="sousuo\.html"[^>]*sy-hit-search/);
    expect(shouye).not.toMatch(/href="help_center\.html"[^>]*sy-hit-search/);
  });

  it('search page matches official layout copy', () => {
    expect(sousuo).toContain('请输入想搜索的功能/服务');
    expect(sousuo).toContain('历史搜索');
    expect(sousuo).toContain('推荐搜索');
    expect(sousuo).toContain('热搜功能');
    expect(sousuo).toContain('收入纳税明细');
    expect(sousuo).toContain('综合所得年度汇算');
    expect(sousuo).toContain('纳税记录开具');
    expect(sousuo).toContain('专项附加扣除');
    expect(sousuo).toContain('关于&amp;更新');
    expect(sousuo).toContain('申报记录');
    expect(sousuo).toContain('异议申诉');
    expect(sousuo).toContain("['流水', '计算', '导出']");
  });

  it('is reachable without login', () => {
    expect(boot).toContain("'sousuo.html': true");
    expect(auth).toContain("'sousuo.html': true");
  });
});
