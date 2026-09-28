import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const panel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const charts = readFileSync(resolve(__dirname, '../../public/js/admin/modules/charts.js'), 'utf8');

describe('渠道分析页简化', () => {
  it('只留一张表+趋势+一套漏斗切换，去掉重复图和双时间筛选', () => {
    expect(html).toContain('class="channel-analysis-tables"');
    expect(html).toContain('channel-funnel-tab');
    expect(html).toContain('id="channelChartDailyTrend"');
    expect(html).not.toContain('id="channelAnalysisCards"');
    expect(html).not.toContain('id="channelChartRegisterPie"');
    expect(html).not.toContain('id="channelChartRegisterBar"');
    expect(html).not.toContain('id="analyticsChannelFunnelDays"');
    expect(html).not.toContain('id="analyticsActivationChannelFunnelDays"');
    expect(panel).toContain('function channelAnalysisFunnelDays(');
    expect(panel).toContain('function setChannelFunnelTab(');
    expect(charts).not.toContain('channelChartRegisterPie');
    expect(charts).toContain('renderChannelDailyTrendChart');
  });
});
