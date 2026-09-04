'use strict';

const fs = require('fs');
const path = require('path');
const {
  isAdPageTrackAction,
  eventLabel,
  sourceLabel,
  parsePeriod,
  VIEW_KEYS,
  COPY_KEYS,
  LEAVE_KEYS
} = require('../../src/admin/adPageAnalytics');

function countPlaceholders(sql) {
  return (String(sql).match(/\?/g) || []).length;
}

describe('adPageAnalytics helpers', () => {
  it('recognizes refund, purchase and douyin yuefu ad events', () => {
    expect(isAdPageTrackAction('track_refund_ad_view')).toBe(true);
    expect(isAdPageTrackAction('track_refund_ad_page_leave')).toBe(true);
    expect(isAdPageTrackAction('track_purchase_refund_ad_copy')).toBe(true);
    expect(isAdPageTrackAction('track_douyin_yuefu_ad_view')).toBe(true);
    expect(isAdPageTrackAction('track_douyin_yuefu_ad_page_leave')).toBe(true);
    expect(isAdPageTrackAction('track_gjj_extract_ad_view')).toBe(true);
    expect(isAdPageTrackAction('track_gjj_extract_ad_page_leave')).toBe(true);
    expect(isAdPageTrackAction('track_install_page_view')).toBe(false);
  });

  it('labels events and sources', () => {
    expect(eventLabel('track_refund_ad_copy')).toBe('复制微信号');
    expect(eventLabel('track_refund_ad_calc_click')).toBe('一键计算可退税');
    expect(eventLabel('track_refund_ad_calc_contact')).toBe('联系客服退税');
    expect(eventLabel('track_refund_ad_inactive_promo_show')).toBe('未激活退税广告曝光');
    expect(eventLabel('track_refund_ad_inactive_promo_click')).toBe('未激活点退税广告');
    expect(eventLabel('track_refund_ad_page_leave')).toBe('离开广告页');
    expect(eventLabel('track_douyin_yuefu_ad_view')).toBe('进入月付广告页');
    expect(eventLabel('track_gjj_extract_ad_view')).toBe('进入公积金广告页');
    expect(sourceLabel('tax_done')).toBe('填完个税');
    expect(sourceLabel('refund_ad_tab')).toBe('底栏退税');
    expect(sourceLabel('purchase_yuefu')).toBe('开通页月付入口');
    expect(sourceLabel('purchase_gjj')).toBe('开通页公积金入口');
    expect(sourceLabel('msg_refund')).toBe('退税站内信');
    expect(sourceLabel('shuiming_result')).toBe('收入明细');
  });

  it('summary/daily/user SQL placeholder counts match bind lists', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../src/admin/adPageAnalytics.js'),
      'utf8'
    );
    const sumBind = src.match(
      /sumRows[\s\S]*?\[\]\.concat\(([^)]+)\)/
    );
    expect(sumBind && sumBind[1].replace(/\s+/g, '')).toBe(
      'VIEW_KEYS,VIEW_KEYS,COPY_KEYS,COPY_KEYS,LEAVE_KEYS,LEAVE_KEYS,params'
    );
    const dailyBind = src.match(
      /dailyRows[\s\S]*?\[\]\.concat\(([^)]+)\)/
    );
    expect(dailyBind && dailyBind[1].replace(/\s+/g, '')).toBe(
      'VIEW_KEYS,VIEW_KEYS,COPY_KEYS,LEAVE_KEYS,params'
    );
    const userBind = src.match(
      /userRows[\s\S]*?\[\]\.concat\(\s*([\s\S]*?)\)\s*\)/
    );
    expect(userBind && userBind[1].replace(/\s+/g, '')).toContain(
      'VIEW_KEYS,COPY_KEYS,LEAVE_KEYS,LEAVE_KEYS,LEAVE_KEYS,LEAVE_KEYS,userParams'
    );
    expect(VIEW_KEYS.length).toBeGreaterThan(2);
    expect(COPY_KEYS.length).toBeGreaterThan(2);
    expect(LEAVE_KEYS.length).toBe(3);
    expect(countPlaceholders(VIEW_KEYS.map(() => '?').join(','))).toBe(VIEW_KEYS.length);
  });

  it('parses days and custom range', () => {
    expect(parsePeriod('30')).toEqual(
      expect.objectContaining({ mode: 'days', days: 30, period_key: '30' })
    );
    expect(parsePeriod('range_2026-08-01_2026-08-31')).toEqual(
      expect.objectContaining({
        mode: 'range',
        start: '2026-08-01',
        end: '2026-08-31'
      })
    );
  });
});
