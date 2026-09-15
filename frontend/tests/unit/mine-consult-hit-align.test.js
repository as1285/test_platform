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

function hitTag(html, id) {
  const idx = html.indexOf('id="' + id + '"');
  expect(idx).toBeGreaterThan(-1);
  const from = html.lastIndexOf('<a', idx);
  const to = html.indexOf('>', idx);
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return html.slice(from, to + 1);
}

describe('我的页：附近按钮都进我要咨询', () => {
  it.each([
    ['mine.html', mine],
    ['mine_mate60_aug12.html', mate60]
  ])('%s 帮助/咨询/关于热区都指向咨询页', (_name, html) => {
    const consult = consultBlock(html);
    expect(consult).toContain('top: calc(950 * var(--mine-rpx))');
    expect(consult).toContain('height: calc(270 * var(--mine-rpx))');
    expect(consult).toContain('z-index: 120');
    expect(consult).not.toContain('top: calc(1048 * var(--mine-rpx))');
    expect(hitTag(html, 'mineHelpCenterLink')).toContain('href="consult.html?tab=records"');
    expect(hitTag(html, 'consultModifyLink')).toContain('href="consult.html?tab=records"');
    expect(hitTag(html, 'mineAboutLink')).toContain('href="consult.html?tab=records"');
    expect(html).toContain("['consultModifyLink', 'mineHelpCenterLink', 'mineAboutLink']");
    expect(html).toContain('goMineFillData');
    expect(html).not.toContain('关闭编辑：静默拦截');
    expect(hitTag(html, 'mineHelpCenterLink')).not.toContain('help_center.html');
    expect(hitTag(html, 'mineAboutLink')).not.toContain('about_update.html');
  });
});
