const { cityLabelFromIp } = require('../../src/utils/ipCity');

describe('cityLabelFromIp (ip2region)', () => {
  it('returns 本地 for loopback', () => {
    expect(cityLabelFromIp('127.0.0.1')).toBe('本地');
    expect(cityLabelFromIp('::1')).toBe('本地');
  });

  it('resolves domestic city for CN broadband IP that geoip-lite missed', () => {
    expect(cityLabelFromIp('121.23.50.196')).toBe('廊坊市');
  });

  it('resolves Hangzhou for Ali DNS', () => {
    expect(cityLabelFromIp('223.5.5.5')).toBe('杭州市');
  });

  it('returns dash for empty', () => {
    expect(cityLabelFromIp('')).toBe('—');
    expect(cityLabelFromIp(null)).toBe('—');
  });
});
