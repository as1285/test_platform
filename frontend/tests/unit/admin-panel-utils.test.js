import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

beforeAll(() => {
  const code = readFileSync(resolve(__dirname, '../../public/js/admin-panel-utils.js'), 'utf8');
  // eslint-disable-next-line no-eval
  eval(code);
});

describe('AdminUtils', () => {
  it('escapes HTML', () => {
    expect(window.AdminUtils.esc('<b>"&</b>')).toBe('&lt;b&gt;&quot;&amp;&lt;/b&gt;');
  });

  it('formatMoneyLike', () => {
    expect(window.AdminUtils.formatMoneyLike(12)).toMatch(/12/);
    expect(window.AdminUtils.formatMoneyLike('3.5')).toMatch(/3\.5|3\.50/);
  });

  it('parseAgentChannelIds', () => {
    expect(window.AdminUtils.parseAgentChannelIds('a\nb\n\nc')).toEqual(['a', 'b', 'c']);
  });

  it('buildAgentPromoLink', () => {
    const link = window.AdminUtils.buildAgentPromoLink('https://ex.com', 'register.html', 'agent_1');
    expect(link).toContain('ch=agent_1');
  });

  it('menuLabel uses concise names', () => {
    expect(window.AdminUtils.menuLabel('settings')).toBe('定价与弹窗');
    expect(window.AdminUtils.menuLabel('appearance')).toBe('外观');
  });
});
