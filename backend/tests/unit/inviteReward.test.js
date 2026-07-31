'use strict';

const {
  isUserEffectivelyActive,
  isTrialExpired,
  activationFieldsForApi
} = require('../../src/legacy/inviteReward');

describe('inviteReward activation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('permanent is active', () => {
    expect(isUserEffectivelyActive({ activation_kind: 'permanent' })).toBe(true);
    expect(isTrialExpired({ activation_kind: 'permanent' })).toBe(false);
  });

  it('trial respects active_until', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isUserEffectivelyActive({ activation_kind: 'trial', active_until: future })).toBe(true);
    expect(isUserEffectivelyActive({ activation_kind: 'trial', active_until: past })).toBe(false);
    expect(isTrialExpired({ activation_kind: 'trial', active_until: past })).toBe(true);
  });

  it('legacy account_active=1 is active', () => {
    expect(isUserEffectivelyActive({ account_active: 1 })).toBe(true);
  });

  it('activationFieldsForApi maps trial days left', () => {
    const until = new Date(Date.now() + 2.5 * 86400000).toISOString();
    const f = activationFieldsForApi({ activation_kind: 'trial', active_until: until });
    expect(f.account_active).toBe(true);
    expect(f.activation_kind).toBe('trial');
    expect(f.active_days_left).toBe(3);
  });
});
