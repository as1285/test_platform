'use strict';

const {
  trackSiteFilterSql,
  mergeBySiteRows,
  normalizeGroupedSite
} = require('../../src/admin/installGuideStatsSite');
const { SITE_GETJOB68, SITE_LKJ, SITE_ALL } = require('../../src/shared/registerSite');

describe('installGuideStatsSite', () => {
  it('trackSiteFilterSql all is noop', () => {
    const f = trackSiteFilterSql(SITE_ALL, '');
    expect(f.sql).toBe('1=1');
    expect(f.params).toEqual([]);
  });

  it('trackSiteFilterSql filters getjob68', () => {
    const f = trackSiteFilterSql('getjob68', '');
    expect(f.sql).toContain('register_site = ?');
    expect(f.params).toEqual([SITE_GETJOB68]);
  });

  it('mergeBySiteRows keeps getjob68 and lkj', () => {
    const rows = mergeBySiteRows(
      [
        { site: 'getjob68', page_views: 10, unique_visitors: 8, download_clicks: 3, download_uv: 2 },
        { site: 'lkj', page_views: 20, unique_visitors: 15, download_clicks: 5, download_uv: 4 }
      ],
      [
        { site: 'getjob68', registered: 3 },
        { site: 'lkj', registered: 7 }
      ],
      [
        { site: 'getjob68', registered_from_install: 2 },
        { site: 'lkj', registered_from_install: 4 }
      ]
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].site).toBe(SITE_GETJOB68);
    expect(rows[0].unique_visitors).toBe(8);
    expect(rows[0].registered_from_install).toBe(2);
    expect(rows[0].register_rate_pct).toBe('25.0%');
    expect(rows[1].site).toBe(SITE_LKJ);
    expect(normalizeGroupedSite('GETJOB68')).toBe(SITE_GETJOB68);
  });
});
