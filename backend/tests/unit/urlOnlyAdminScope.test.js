'use strict';

const fs = require('fs');
const path = require('path');
const {
  isUrlOnlySalesChannel,
  listUrlOnlySalesChannelIds,
  excludeUrlOnlySalesChannelSql,
  excludeUrlOnlySalesChannelSinceSql
} = require('../../src/legacy/agentChannels');

describe('URL-only channel admin visibility', () => {
  it('lists abc as url-only', () => {
    expect(isUrlOnlySalesChannel('abc')).toBe(true);
    expect(isUrlOnlySalesChannel('ABC')).toBe(true);
    expect(listUrlOnlySalesChannelIds()).toContain('abc');
  });

  it('builds exclude-all SQL for sub-admins', () => {
    var params = [];
    var sql = excludeUrlOnlySalesChannelSql('u.sales_promo_channel', params);
    expect(sql).toContain('u.sales_promo_channel');
    expect(sql).toContain('NOT IN');
    expect(params).toEqual(['abc']);
  });

  it('builds exclude-since SQL for full-scope ops (new abc only)', () => {
    var params = [];
    var sql = excludeUrlOnlySalesChannelSinceSql(
      'users.sales_promo_channel',
      'users.created_at',
      '2026-09-07 02:41:00',
      params
    );
    expect(sql).toContain('NOT (');
    expect(sql).toContain('users.sales_promo_channel');
    expect(sql).toContain('users.created_at >= ?');
    expect(params).toEqual(['abc', '2026-09-07 02:41:00']);
  });

  it('monolith: only admin sees new abc; full-scope loses new abc', () => {
    var monolith = fs.readFileSync(
      path.join(__dirname, '../../src/legacy/monolith.js'),
      'utf8'
    );
    expect(monolith).toContain('ABC_CHANNEL_ADMIN_ONLY_SINCE');
    expect(monolith).toContain('isAbcChannelViewerAdmin');
    expect(monolith).toContain('excludeUrlOnlySalesChannelSinceSql');
    expect(monolith).toMatch(
      /function appendAdminUserScope[\s\S]*isAbcChannelViewerAdmin[\s\S]*appendExcludeUrlOnlySalesChannelUsers/
    );
    expect(monolith).toMatch(
      /function appendAdminRegisteredUsersScope[\s\S]*isAbcChannelViewerAdmin[\s\S]*appendExcludeUrlOnlySalesChannelUsers/
    );
    expect(monolith).toContain("adminUsernameKey(admin) === 'admin'");
    expect(monolith).toContain('仅显式 ch 或安装下载埋点写入 sales_promo_channel');
    expect(monolith).toContain('sanitizeStickySalesChannelId');
    expect(monolith).toContain('resolveUrlOnlyChannelFromInstallDownload');
    expect(monolith).toContain('maybeBindUrlOnlySalesChannel');
    expect(monolith).toContain('禁止靠 client_id / 指纹 sticky 归因补绑');
  });
});
