'use strict';

const {
  parseSegment,
  parseDays,
  parseBjDate,
  beijingTodayYmd,
  resolveKpiDay,
  resolveKpiRange,
  opsSkuGmvLabel,
  HIGH_INCOME,
  REFUND_AD_MIN_INCOME,
  REFUND_AD_MIN_TAX,
  refundEligibleSql,
  refundCopiedExistsSql,
  isRefundBulkAudience,
  appendRefundBulkAudienceFilters
} = require('../../src/admin/opsConversion');

describe('opsConversion helpers', () => {
  it('defaults unknown segment to all', () => {
    expect(parseSegment('')).toBe('all');
    expect(parseSegment('high_income')).toBe('high_income');
    expect(parseSegment('nope')).toBe('all');
  });

  it('clamps research days', () => {
    expect(parseDays('7', 7)).toBe(7);
    expect(parseDays('0', 7)).toBe(7);
    expect(parseDays('9999', 7)).toBe(366);
  });

  it('parses Beijing KPI dates and rejects future / invalid', () => {
    var today = beijingTodayYmd();
    expect(parseBjDate(today)).toBe(today);
    expect(parseBjDate('2026-09-01')).toBe('2026-09-01');
    expect(parseBjDate('2026-13-01')).toBe('');
    expect(parseBjDate('not-a-date')).toBe('');
    expect(parseBjDate('2019-12-31')).toBe('');
    expect(resolveKpiDay('')).toBe(today);
    expect(resolveKpiDay('2026-09-01')).toBe('2026-09-01');
    expect(resolveKpiRange({ date: '2026-09-01' })).toEqual({
      from: '2026-09-01',
      to: '2026-09-01',
      is_single: true,
      is_today: false
    });
    expect(resolveKpiRange({ date_from: '2026-09-10', date_to: '2026-09-01' })).toEqual({
      from: '2026-09-01',
      to: '2026-09-10',
      is_single: false,
      is_today: false
    });
    expect(resolveKpiRange({})).toEqual({
      from: today,
      to: today,
      is_single: true,
      is_today: true
    });
    var src = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../src/admin/opsConversion.js'),
      'utf8'
    );
    expect(src).toContain('resolveKpiRange(req.query)');
    expect(src).toContain('cnDay} >= ? AND ${cnDay} <= ?');
    expect(src).toContain('loadOpsBoardDau');
    expect(src).toContain('dau: dau');
  });

  it('keeps high-income threshold at 15000', () => {
    expect(HIGH_INCOME).toBe(15000);
  });

  it('ops sku label prefers channel custom name over 档位5', () => {
    expect(opsSkuGmvLabel({ sku_id: 'sku_ch_t5' })).toBe('档位5');
    expect(opsSkuGmvLabel({ sku_id: 'sku_ch_t5', subject: '激活码·档位5' })).toBe('档位5');
    expect(opsSkuGmvLabel({ sku_id: 'sku_ch_t5', subject: '激活码·年卡' })).toBe('年卡');
    expect(opsSkuGmvLabel({ sku_id: 'sku_ch_t5', subject: '激活码·永久' })).toBe('永久');
    expect(opsSkuGmvLabel({ sku_id: 'sku_ch_t4', subject: '激活码·季卡' })).toBe('季卡');
    expect(opsSkuGmvLabel({ sku_id: 'sku_398_30d', subject: '激活码·月卡' })).toBe('月卡');
    expect(opsSkuGmvLabel({ grant_kind: 'tax_edit_daily' })).toBe('同行费用（每天无限）');
  });

  it('ops sku label uses 周卡/月卡/永久 instead of 档位N·专属价', () => {
    expect(
      opsSkuGmvLabel({
        sku_id: 'sku_ch_t5',
        subject: '激活码·档位5·专属价',
        grant_kind: 'permanent'
      })
    ).toBe('永久');
    expect(
      opsSkuGmvLabel({
        sku_id: 'sku_ch_t5',
        subject: '激活码·档位5·专属价',
        grant_kind: 'trial',
        grant_days: 30
      })
    ).toBe('月卡');
    expect(
      opsSkuGmvLabel({
        sku_id: 'sku_300_7d',
        subject: '激活码·周卡',
        grant_kind: 'trial',
        grant_days: 7
      })
    ).toBe('周卡');
    expect(
      opsSkuGmvLabel({
        sku_id: 'sku_99_1h',
        grant_kind: 'trial',
        grant_hours: 1
      })
    ).toBe('小时卡');
  });

  it('refund eligible sql uses 2023-2025 tax or 150000 income', () => {
    expect(REFUND_AD_MIN_TAX).toBe(5000);
    expect(REFUND_AD_MIN_INCOME).toBe(150000);
    var sql = refundEligibleSql('users.username');
    expect(sql).toContain('2025');
    expect(sql).toContain('2024');
    expect(sql).toContain('2023');
    expect(sql).toContain('150000');
    expect(sql).toContain('示例');
    expect(sql).toContain('users.username');
  });

  it('today activate excludes cancelled activations', () => {
    const src = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../src/admin/opsConversion.js'),
      'utf8'
    );
    expect(src).toContain('u.activation_cancelled_at IS NULL');
    expect(src).toContain('LEFT JOIN users u ON u.username = ac.used_by_username');
  });

  it('refund copied audiences share eligible sql', () => {
    expect(isRefundBulkAudience('refund_eligible')).toBe(true);
    expect(isRefundBulkAudience('refund_eligible_copied')).toBe(true);
    expect(isRefundBulkAudience('refund_eligible_not_copied')).toBe(true);
    expect(isRefundBulkAudience('all_inactive')).toBe(false);
    expect(refundCopiedExistsSql('u.username')).toContain('track_refund_ad_copy');
    expect(refundCopiedExistsSql('u.username')).toContain('track_purchase_refund_ad_copy');
    var copied = [];
    appendRefundBulkAudienceFilters('refund_eligible_copied', copied);
    expect(copied.join(' ')).toContain('EXISTS (SELECT 1 FROM (');
    expect(copied.join(' ')).toContain('track_refund_ad_copy');
    var notCopied = [];
    appendRefundBulkAudienceFilters('refund_eligible_not_copied', notCopied);
    expect(notCopied.join(' ')).toContain('NOT EXISTS');
  });
});
