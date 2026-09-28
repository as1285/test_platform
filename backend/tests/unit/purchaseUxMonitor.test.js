'use strict';

const {
  evaluateAlert,
  isAlertTrackAction,
  ALERT_EVENT_KEYS
} = require('../../purchaseUxMonitor');

describe('purchaseUxMonitor', () => {
  it('recognizes alert track actions', () => {
    expect(isAlertTrackAction('track_purchase_boot_fail')).toBe(true);
    expect(isAlertTrackAction('track_purchase_pay_blocked')).toBe(true);
    expect(isAlertTrackAction('track_alipay_order_create_fail')).toBe(true);
    expect(isAlertTrackAction('probe_purchase_expired_block')).toBe(true);
    expect(isAlertTrackAction('track_purchase_page_view')).toBe(false);
    expect(ALERT_EVENT_KEYS.length).toBe(4);
  });

  it('alerts on probe fail immediately', () => {
    const d = evaluateAlert(
      { total: 1, activation_expired: 0, probe_fail: 1, by_key: {} },
      { minEvents: 3 }
    );
    expect(d.shouldAlert).toBe(true);
    expect(d.reason).toMatch(/探活/);
  });

  it('alerts when activation_expired >= 2', () => {
    const d = evaluateAlert(
      { total: 2, activation_expired: 2, probe_fail: 0, by_key: {} },
      { minEvents: 5 }
    );
    expect(d.shouldAlert).toBe(true);
    expect(d.reason).toMatch(/activation_expired/);
  });

  it('alerts when total reaches minEvents', () => {
    const d = evaluateAlert(
      { total: 3, activation_expired: 0, probe_fail: 0, by_key: {} },
      { minEvents: 3 }
    );
    expect(d.shouldAlert).toBe(true);
  });

  it('stays quiet below thresholds', () => {
    const d = evaluateAlert(
      { total: 2, activation_expired: 1, probe_fail: 0, by_key: {} },
      { minEvents: 3 }
    );
    expect(d.shouldAlert).toBe(false);
  });
});
