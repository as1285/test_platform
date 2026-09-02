'use strict';

const {
  formatBytes,
  formatBps,
  toLoadPercent,
  isSustainedHighLoad,
  classifyApiProbeResult,
  summarizeApiProbes,
  decideApiAutoHeal,
  getApiProbeDefs
} = require('../../serverMonitor');

describe('serverMonitor formatters', () => {
  it('formatBytes', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.00 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
  });

  it('formatBps', () => {
    expect(formatBps(null)).toBe('—');
    expect(formatBps(1024)).toBe('1.00 KB/s');
  });
});

describe('serverMonitor load alert gate', () => {
  it('toLoadPercent caps at 100 and scales by CPU count', () => {
    expect(toLoadPercent(4, 4)).toBe(100);
    expect(toLoadPercent(3.69, 4)).toBe(92.3);
    expect(toLoadPercent(2.06, 4)).toBe(51.5);
    expect(toLoadPercent(-1, 4)).toBe(null);
  });

  it('does not treat a 1-minute deploy spike as sustained', () => {
    expect(
      isSustainedHighLoad({ load_percent_1: 100, load_percent_5: 51.5 })
    ).toBe(false);
  });

  it('alerts only when 1-minute and 5-minute load stay high', () => {
    expect(
      isSustainedHighLoad({ load_percent_1: 92, load_percent_5: 75 })
    ).toBe(true);
    expect(
      isSustainedHighLoad({ load_percent_1: 80, load_percent_5: 80 })
    ).toBe(false);
  });
});

describe('serverMonitor API selftest', () => {
  it('exposes a non-empty probe list', () => {
    var defs = getApiProbeDefs();
    expect(defs.length).toBeGreaterThan(5);
    expect(defs.some(function (d) { return d.path === '/api/health'; })).toBe(true);
  });

  it('classifies expected statuses as healthy', () => {
    expect(classifyApiProbeResult({ accept: [200] }, 200, null).ok).toBe(true);
    expect(classifyApiProbeResult({ accept: [401, 403] }, 401, null).ok).toBe(true);
    expect(classifyApiProbeResult({ accept: [401, 403] }, 403, null).ok).toBe(true);
  });

  it('classifies 404 / 5xx / network error as down', () => {
    expect(classifyApiProbeResult({ accept: [200] }, 404, null).ok).toBe(false);
    expect(classifyApiProbeResult({ accept: [200] }, 500, null).ok).toBe(false);
    expect(classifyApiProbeResult({ accept: [401] }, 0, 'aborted').ok).toBe(false);
    expect(classifyApiProbeResult({ accept: [401] }, 200, null).ok).toBe(false);
  });

  it('summarizes failed probes for one alert', () => {
    var sum = summarizeApiProbes([
      { ok: true, label: '健康检查', latency_ms: 12 },
      { ok: false, label: '转化配置', message: 'HTTP 500 服务错误', latency_ms: 40 }
    ]);
    expect(sum.id).toBe('api-selftest');
    expect(sum.ok).toBe(false);
    expect(sum.message).toContain('转化配置');
    expect(summarizeApiProbes([{ ok: true, label: '健康检查', latency_ms: 8 }]).ok).toBe(true);
  });
});

describe('serverMonitor API auto-heal', () => {
  it('restarts when health probe fails', () => {
    var d = decideApiAutoHeal([
      { id: 'health', ok: false, message: 'HTTP 500' },
      { id: 'public-conversion', ok: true }
    ]);
    expect(d.heal).toBe(true);
    expect(d.action).toBe('restart_process');
    expect(d.reason).toContain('健康检查');
  });

  it('restarts when a majority of probes fail', () => {
    var d = decideApiAutoHeal([
      { id: 'health', ok: true },
      { id: 'a', ok: false },
      { id: 'b', ok: false },
      { id: 'c', ok: false },
      { id: 'd', ok: true },
      { id: 'e', ok: false }
    ]);
    expect(d.heal).toBe(true);
    expect(d.reason).toContain('多数接口失败');
  });

  it('does not restart for a single non-health failure', () => {
    var d = decideApiAutoHeal([
      { id: 'health', ok: true },
      { id: 'public-conversion', ok: false, message: 'HTTP 500' },
      { id: 'public-landing-ab', ok: true },
      { id: 'public-install', ok: true }
    ]);
    expect(d.heal).toBe(false);
  });
});
