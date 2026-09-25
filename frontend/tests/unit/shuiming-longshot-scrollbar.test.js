import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const guide = readFileSync(resolve(__dirname, '../../public/js/conversion-guide.js'), 'utf8');

describe('收入纳税明细长截图不露右侧滚动条', () => {
  it('列表容器隐藏系统滚动条', () => {
    expect(html).toContain('body.page-shuiming-result .list');
    expect(html).toContain('scrollbar-width: none !important');
    expect(html).toContain('body.page-shuiming-result .list::-webkit-scrollbar');
  });

  it('短拉手仅手指滑动出现，长截图/截屏强制隐藏', () => {
    expect(html).toContain('sm-longshot-hide-thumb');
    expect(html).toContain('html.cg-capture-hide .sm-scroll-thumb');
    expect(html).toContain('fingerActive');
    expect(html).toContain('仅手指滑动出现');
    expect(html).not.toMatch(
      /window\.addEventListener\('scroll',\s*onScroll[\s\S]{0,80}wantShow\s*=\s*true/
    );
  });

  it('转化引导截屏隐藏类覆盖短拉手', () => {
    expect(guide).toContain(" .sm-scroll-thumb");
    expect(guide).toContain('CAPTURE_HIDE_CLASS');
  });
});
