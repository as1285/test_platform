import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');
const mate60 = readFileSync(resolve(__dirname, '../../mine_mate60_aug12.html'), 'utf8');

function consultBlock(html) {
  const start = html.indexOf('.mine-hit-consult {');
  const end = html.indexOf('.mine-hit-about {', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
}

function aboutBlock(html) {
  const start = html.indexOf('.mine-hit-about {');
  const end = html.indexOf('.mine-e1-pill {', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
}

describe('我的页：我要咨询热区对齐底图行', () => {
  it.each([
    ['mine.html', mine],
    ['mine_mate60_aug12.html', mate60]
  ])('%s 咨询热区覆盖 1062–1102 墨迹，不再跟帮助/关于抢点', (_name, html) => {
    const consult = consultBlock(html);
    const about = aboutBlock(html);
    expect(consult).toContain('top: calc(1048 * var(--mine-rpx))');
    expect(consult).toContain('height: calc(86 * var(--mine-rpx))');
    expect(consult).toContain('z-index: 120');
    expect(consult).not.toContain('top: calc(1020 * var(--mine-rpx))');
    expect(about).toContain('top: calc(1134 * var(--mine-rpx))');
    expect(about).toContain('height: calc(86 * var(--mine-rpx))');
    expect(about).not.toContain('top: calc(1090 * var(--mine-rpx))');
    expect(html).toContain('href="help_center.html"');
    expect(html).toContain('href="about_update.html"');
    expect(html).toContain('id="consultModifyLink"');
  });
});
