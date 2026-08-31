'use strict';

const {
  formatBytes,
  formatBps,
  toLoadPercent,
  isSustainedHighLoad
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
