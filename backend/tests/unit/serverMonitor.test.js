'use strict';

const { formatBytes, formatBps } = require('../../serverMonitor');

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
