import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const panel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');

describe('IP 黑名单操作管理员列', () => {
  it('formats blocked_by instead of dumping raw JSON', () => {
    expect(panel).toContain('function formatBlockedByLabel');
    expect(panel).toContain('esc(formatBlockedByLabel(item.blocked_by))');
    expect(panel).not.toMatch(/html \+= '<td>' \+ esc\(item\.blocked_by/);
  });

  it('busts admin_panel.js cache after the label fix', () => {
    expect(html).toContain('admin_panel.js?v=20260907-amt-enter');
  });
});
