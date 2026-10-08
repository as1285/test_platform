'use strict';

const {
  siteKeyFromHost,
  isLegacyAdminHost,
  resolveAdminSiteScope,
  normalizeSiteFilter,
  appendRegisterSiteFilter,
  SITE_GETJOB68,
  SITE_LKJ,
  SITE_ALL
} = require('../../src/shared/registerSite');

describe('registerSite', () => {
  it('maps hosts to site keys', () => {
    expect(siteKeyFromHost('getjob68.club')).toBe(SITE_GETJOB68);
    expect(siteKeyFromHost('www.getjob68.club')).toBe(SITE_GETJOB68);
    expect(siteKeyFromHost('lkj.qiyun888.top')).toBe(SITE_LKJ);
    expect(siteKeyFromHost('103.106.188.166')).toBe(SITE_LKJ);
    expect(siteKeyFromHost('evil.example.com')).toBe('unknown');
  });

  it('locks legacy admin host to lkj', () => {
    expect(isLegacyAdminHost('lkj.qiyun888.top')).toBe(true);
    expect(isLegacyAdminHost('getjob68.club')).toBe(false);
    var scope = resolveAdminSiteScope(
      { headers: { host: 'lkj.qiyun888.top' } },
      'getjob68'
    );
    expect(scope.site).toBe(SITE_LKJ);
    expect(scope.locked).toBe(true);
    expect(scope.allow_filter).toBe(false);
  });

  it('new host defaults to all and honors filter', () => {
    var all = resolveAdminSiteScope({ headers: { host: 'getjob68.club' } }, '');
    expect(all.site).toBe(SITE_ALL);
    expect(all.allow_filter).toBe(true);
    var filtered = resolveAdminSiteScope(
      { headers: { host: 'getjob68.club' } },
      'getjob68'
    );
    expect(filtered.site).toBe(SITE_GETJOB68);
  });

  it('appends sql filter', () => {
    var where = [];
    var params = [];
    appendRegisterSiteFilter(where, params, 'lkj', 'users');
    expect(where[0]).toContain('register_site');
    expect(params).toEqual(['lkj']);
    where = [];
    params = [];
    appendRegisterSiteFilter(where, params, 'all', 'users');
    expect(where.length).toBe(0);
    expect(normalizeSiteFilter('')).toBe(SITE_ALL);
  });
});
