import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const frontend = resolve(__dirname, '../..');
const adminHtml = readFileSync(resolve(frontend, 'admin_panel.html'), 'utf8');
const adminCss = readFileSync(resolve(frontend, 'css/admin_panel.css'), 'utf8');
const CACHE = '20260907-abc-ops';

function extractChannelSkuTable(html) {
  const start = html.indexOf('class="data-table agent-ch-sku-table"');
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf('</table>', start);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end + '</table>'.length);
}

describe('channel 专属套餐 心理价位 column', () => {
  it('renders 心理价位 after 小时 in header', () => {
    const chunk = extractChannelSkuTable(adminHtml);
    const thOrder = [...chunk.matchAll(/<th>([^<]+)<\/th>/g)].map((m) => m[1]);
    expect(thOrder).toEqual(['档位', '名称', '价格(元)', '天数', '小时', '心理价位']);
  });

  it('places agentChPsych* inputs after hours inputs in each row', () => {
    const chunk = extractChannelSkuTable(adminHtml);
    ['Week', 'Biweek', 'Month', 'T4', 'T5'].forEach((s) => {
      const hoursIdx = chunk.indexOf(`id="agentChHours${s}"`);
      const psychIdx = chunk.indexOf(`id="agentChPsych${s}"`);
      expect(hoursIdx, s + ' hours').toBeGreaterThan(-1);
      expect(psychIdx, s + ' psych').toBeGreaterThan(-1);
      expect(psychIdx).toBeGreaterThan(hoursIdx);
    });
  });

  it('hint says below-pay psych is C-end bid floor', () => {
    expect(adminHtml).toMatch(/C 端出价下限/);
    expect(adminHtml).toMatch(/低于该价会提示/);
  });

  it('busts admin_panel asset cache for the column', () => {
    expect(adminHtml).toContain(`admin_panel.js?v=${CACHE}`);
    expect(adminHtml).toContain('admin_panel.css?v=20260907-abc-ops');
    expect(adminCss).toContain('.agent-ch-sku-table');
    expect(adminCss).toContain('.max-w-920');
  });
});
