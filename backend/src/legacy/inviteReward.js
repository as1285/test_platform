/**
 * 时效激活 + 邀请有礼（Phase A/B）
 * 由 monolith 注入 pool 与少量依赖后使用。
 */
'use strict';

var SETTING_INVITE_ENABLED = 'invite_enabled';
var SETTING_INVITE_REWARD_DAYS = 'invite_reward_days';
var SETTING_INVITE_REWARD_HOURS = 'invite_reward_hours';
var SETTING_INVITE_REWARD_MINUTES = 'invite_reward_minutes';
var SETTING_INVITE_PAY_REWARD_DAYS = 'invite_pay_reward_days';
var SETTING_INVITE_MONTHLY_CAP = 'invite_monthly_cap';
var SETTING_INVITE_GRANT_DELAY_HOURS = 'invite_grant_delay_hours';

/** 从 DB 行判断当前是否有效激活（含 trial 未过期 / permanent / 兼容旧 account_active） */
function isUserEffectivelyActive(row) {
  if (!row) return false;
  var kind = row.activation_kind != null ? String(row.activation_kind).trim() : '';
  if (kind === 'permanent') return true;
  if (kind === 'trial') {
    if (!row.active_until) return false;
    var t = new Date(row.active_until).getTime();
    return isFinite(t) && t > Date.now();
  }
  /* 兼容迁移前或未回填：account_active=1 视为永久 */
  if (row.account_active === 1 || row.account_active === true || Number(row.account_active) === 1) {
    return true;
  }
  return false;
}

/** 组装 API 用的激活字段 */
function activationFieldsForApi(row) {
  var kind = row && row.activation_kind != null ? String(row.activation_kind).trim() : '';
  if (!kind || kind === 'none') {
    if (
      row &&
      (row.account_active === 1 || row.account_active === true || Number(row.account_active) === 1)
    ) {
      kind = 'permanent';
    } else {
      kind = 'none';
    }
  }
  var active = isUserEffectivelyActive(row);
  var until = null;
  var daysLeft = null;
  if (kind === 'trial' && row && row.active_until) {
    until =
      row.active_until instanceof Date
        ? row.active_until.toISOString()
        : String(row.active_until);
    var ms = new Date(row.active_until).getTime() - Date.now();
    daysLeft = ms > 0 ? Math.ceil(ms / 86400000) : 0;
  }
  return {
    account_active: active,
    activation_kind: active ? kind : kind === 'trial' ? 'none' : kind,
    active_until: kind === 'trial' && active ? until : null,
    active_days_left: kind === 'trial' && active ? daysLeft : null
  };
}

function createInviteReward(deps) {
  var pool = deps.pool;
  var upsertAppSetting = deps.upsertAppSetting;
  var invalidateUserAuthCache = deps.invalidateUserAuthCache;
  var invalidateUserInfoApiCache = deps.invalidateUserInfoApiCache;
  var randomActivationCodePlain = deps.randomActivationCodePlain;
  var ADMIN_PANEL_USER = deps.ADMIN_PANEL_USER || 'admin';

  var _settingsCache = null;
  var _settingsCacheAt = 0;

  async function readSetting(conn, key, fallback) {
    const [rows] = await conn.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [key]
    );
    if (!rows.length || rows[0].setting_value == null) return fallback;
    return String(rows[0].setting_value);
  }

  async function loadInviteSettings(force) {
    var now = Date.now();
    if (!force && _settingsCache && now - _settingsCacheAt < 15000) {
      return _settingsCache;
    }
    const conn = await pool.getConnection();
    try {
      var enabled = await readSetting(conn, SETTING_INVITE_ENABLED, '0');
      var days = parseInt(await readSetting(conn, SETTING_INVITE_REWARD_DAYS, '0'), 10);
      var hours = parseInt(await readSetting(conn, SETTING_INVITE_REWARD_HOURS, '0'), 10);
      var minutes = parseInt(await readSetting(conn, SETTING_INVITE_REWARD_MINUTES, '30'), 10);
      var payDays = parseInt(await readSetting(conn, SETTING_INVITE_PAY_REWARD_DAYS, '3'), 10);
      var cap = parseInt(await readSetting(conn, SETTING_INVITE_MONTHLY_CAP, '4'), 10);
      var delay = parseInt(await readSetting(conn, SETTING_INVITE_GRANT_DELAY_HOURS, '0'), 10);
      if (!isFinite(days) || days < 0) days = 0;
      if (days > 365) days = 365;
      if (!isFinite(hours) || hours < 0) hours = 0;
      if (hours > 24 * 30) hours = 24 * 30;
      if (!isFinite(minutes) || minutes < 0) minutes = 30;
      if (minutes > 24 * 60) minutes = 24 * 60;
      if (!days && !hours && !minutes) minutes = 30;
      if (!isFinite(payDays) || payDays < 0) payDays = 3;
      if (payDays > 365) payDays = 365;
      if (!cap || cap < 0) cap = 4;
      if (cap > 100) cap = 100;
      if (!isFinite(delay) || delay < 0) delay = 0;
      if (delay > 24 * 30) delay = 24 * 30;
      _settingsCache = {
        enabled: enabled === '1' || enabled === 'true',
        reward_days: days,
        reward_hours: hours,
        reward_minutes: minutes,
        pay_reward_days: payDays,
        monthly_cap: cap,
        grant_delay_hours: delay
      };
      _settingsCacheAt = now;
      return _settingsCache;
    } finally {
      conn.release();
    }
  }

  function invalidateInviteSettingsCache() {
    _settingsCache = null;
    _settingsCacheAt = 0;
  }

  function genInviteCode() {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    var i;
    for (i = 0; i < 8; i++) {
      out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return out;
  }

  async function ensureUserInviteCode(conn, username) {
    var u = String(username || '').trim();
    if (!u) return '';
    const [rows] = await conn.execute(
      'SELECT invite_code FROM users WHERE username = ? LIMIT 1',
      [u]
    );
    if (!rows.length) return '';
    if (rows[0].invite_code) return String(rows[0].invite_code);
    var n = 0;
    while (n < 12) {
      var code = genInviteCode();
      try {
        await conn.execute(
          'UPDATE users SET invite_code = ? WHERE username = ? AND (invite_code IS NULL OR invite_code = "")',
          [code, u]
        );
        const [again] = await conn.execute(
          'SELECT invite_code FROM users WHERE username = ? LIMIT 1',
          [u]
        );
        if (again.length && again[0].invite_code) return String(again[0].invite_code);
      } catch (e) {
        /* unique conflict retry */
      }
      n += 1;
    }
    return '';
  }

  async function resolveInviterByInviteCode(inviteCode) {
    var code = String(inviteCode || '')
      .trim()
      .toUpperCase();
    if (!code) return null;
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        'SELECT username, invite_code FROM users WHERE invite_code = ? LIMIT 1',
        [code]
      );
      return rows.length ? String(rows[0].username) : null;
    } finally {
      conn.release();
    }
  }

  /** 在连接内把用户设为永久激活 */
  async function setUserPermanentInConn(conn, username, sourceChannel) {
    if (sourceChannel) {
      await conn.execute(
        `UPDATE users SET account_active = 1, activation_kind = 'permanent', active_until = NULL,
         activation_source_channel = COALESCE(?, activation_source_channel) WHERE username = ?`,
        [sourceChannel, username]
      );
    } else {
      await conn.execute(
        `UPDATE users SET account_active = 1, activation_kind = 'permanent', active_until = NULL WHERE username = ?`,
        [username]
      );
    }
  }

  /** 在连接内叠加 trial 时长；已永久则不变并返回 permanent */
  async function addTrialDurationInConn(conn, username, days, hours, source, refId, minutes) {
    var d = parseInt(days, 10) || 0;
    var h = parseInt(hours, 10) || 0;
    var m = parseInt(minutes, 10) || 0;
    if (d < 0) d = 0;
    if (h < 0) h = 0;
    if (m < 0) m = 0;
    if (d < 1 && h < 1 && m < 1) throw new Error('奖励时长无效');
    const [rows] = await conn.execute(
      `SELECT account_active, activation_kind, active_until FROM users WHERE username = ? FOR UPDATE`,
      [username]
    );
    if (!rows.length) throw new Error('用户不存在');
    var rec = rows[0];
    var kind = rec.activation_kind != null ? String(rec.activation_kind) : '';
    if (kind === 'permanent' || (isUserEffectivelyActive(rec) && kind !== 'trial')) {
      return { kind: 'permanent', active_until: null, skipped: true };
    }
    var base = Date.now();
    if (kind === 'trial' && rec.active_until) {
      var prev = new Date(rec.active_until).getTime();
      if (isFinite(prev) && prev > base) base = prev;
    }
    var until = new Date(base + d * 86400000 + h * 3600000 + m * 60000);
    var grantDaysLog =
      d + (h > 0 ? h / 24 : 0) + (m > 0 ? m / 1440 : 0);
    await conn.execute(
      `UPDATE users SET account_active = 1, activation_kind = 'trial', active_until = ? WHERE username = ?`,
      [until, username]
    );
    await conn.execute(
      `INSERT INTO activation_grants (username, days, source, ref_id, active_until_after)
       VALUES (?, ?, ?, ?, ?)`,
      [
        username,
        grantDaysLog || d || m / 1440 || 1,
        source || 'trial',
        refId != null ? String(refId) : null,
        until
      ]
    );
    return { kind: 'trial', active_until: until, skipped: false };
  }

  async function addTrialDaysInConn(conn, username, days, source, refId) {
    return addTrialDurationInConn(conn, username, days, 0, source, refId, 0);
  }

  /** 应用激活码：支持 grant_days 时效码与永久码 */
  async function applyActivationCodeExtended(username, rawCode, actChannelFromNote) {
    var code = String(rawCode || '')
      .trim()
      .toUpperCase();
    if (!code) throw new Error('请输入激活码');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        'SELECT id, max_uses, used_count, note, grant_days, grant_hours, grant_minutes FROM activation_codes WHERE code = ? FOR UPDATE',
        [code]
      );
      if (!rows.length) {
        await conn.rollback();
        throw new Error('激活码无效');
      }
      var r = rows[0];
      if (Number(r.used_count) >= Number(r.max_uses)) {
        await conn.rollback();
        throw new Error('激活码已用完');
      }
      var actChannel = actChannelFromNote(r.note);
      await conn.execute(
        'UPDATE activation_codes SET used_count = used_count + 1, last_used_at = CURRENT_TIMESTAMP, used_by_username = ? WHERE id = ?',
        [username, r.id]
      );
      if (actChannel === 'alipay' || actChannel === 'kufaka') {
        await conn.execute(
          `UPDATE activation_codes
           SET owner_admin_username = COALESCE(NULLIF(TRIM(owner_admin_username), ''), ?)
           WHERE id = ?`,
          [ADMIN_PANEL_USER, r.id]
        );
      }
      var grantDays = r.grant_days != null ? parseInt(r.grant_days, 10) : 0;
      var grantHours = r.grant_hours != null ? parseInt(r.grant_hours, 10) : 0;
      var grantMinutes = r.grant_minutes != null ? parseInt(r.grant_minutes, 10) : 0;
      if (!isFinite(grantDays) || grantDays < 0) grantDays = 0;
      if (!isFinite(grantHours) || grantHours < 0) grantHours = 0;
      if (!isFinite(grantMinutes) || grantMinutes < 0) grantMinutes = 0;
      var wasFirstActivation = false;
      const [urows] = await conn.execute(
        `SELECT account_active, activation_kind, active_until, invited_by FROM users WHERE username = ? FOR UPDATE`,
        [username]
      );
      if (!urows.length) {
        await conn.rollback();
        throw new Error('用户不存在');
      }
      var beforeActive = isUserEffectivelyActive(urows[0]);
      wasFirstActivation = !beforeActive;
      var isPermanentCode = !(grantDays > 0 || grantHours > 0 || grantMinutes > 0);

      if (!isPermanentCode) {
        await addTrialDurationInConn(
          conn,
          username,
          grantDays,
          grantHours,
          'trial_code',
          String(r.id),
          grantMinutes
        );
        if (actChannel) {
          await conn.execute(
            'UPDATE users SET activation_source_channel = COALESCE(activation_source_channel, ?) WHERE username = ?',
            [actChannel, username]
          );
        }
      } else {
        await setUserPermanentInConn(conn, username, actChannel || null);
      }

      if (wasFirstActivation) {
        await markInviteeActivatedInConn(conn, username, urows[0].invited_by);
      }
      if (isPermanentCode) {
        await grantInvitePayRewardInConn(conn, username, urows[0].invited_by);
      }

      await conn.commit();
      invalidateUserAuthCache(username);
      invalidateUserInfoApiCache(username);
      return { first_activation: wasFirstActivation };
    } catch (e) {
      try {
        await conn.rollback();
      } catch (e2) {}
      throw e;
    } finally {
      conn.release();
    }
  }

  async function countInviterGrantsThisMonth(conn, inviter) {
    const [rows] = await conn.execute(
      `SELECT
         (SELECT COUNT(*) FROM user_invites
          WHERE inviter_username = ? AND reward_status = 'granted'
            AND granted_at >= DATE_FORMAT(CURRENT_TIMESTAMP, '%Y-%m-01 00:00:00'))
         +
         (SELECT COUNT(*) FROM user_invites
          WHERE inviter_username = ? AND pay_reward_status = 'granted'
            AND pay_granted_at >= DATE_FORMAT(CURRENT_TIMESTAMP, '%Y-%m-01 00:00:00'))
         AS c`,
      [inviter, inviter]
    );
    return rows.length ? Number(rows[0].c) || 0 : 0;
  }

  function formatRewardDurationLabel(days, hours, minutes) {
    var bits = [];
    if (days) bits.push(days + '天');
    if (hours) bits.push(hours + '小时');
    if (minutes) bits.push(minutes + '分钟');
    return bits.length ? bits.join('') : '试用';
  }

  /**
   * 向邀请人发放一次奖励（注册奖或付费奖）。
   * 永久邀请人 → 可转赠时效码；否则直接叠加 trial。
   */
  async function deliverInviteRewardToInviterInConn(conn, opts) {
    var inviter = String(opts.inviter || '').trim();
    var days = parseInt(opts.days, 10) || 0;
    var hours = parseInt(opts.hours, 10) || 0;
    var minutes = parseInt(opts.minutes, 10) || 0;
    var source = opts.source || 'invite_reward';
    var refId = opts.refId != null ? String(opts.refId) : null;
    var notePrefix = opts.notePrefix || '邀请奖励可转赠';
    if (!inviter) throw new Error('邀请人无效');
    if (days < 1 && hours < 1 && minutes < 1) throw new Error('奖励时长无效');

    const [invRows] = await conn.execute(
      `SELECT activation_kind, account_active, active_until FROM users WHERE username = ? FOR UPDATE`,
      [inviter]
    );
    if (!invRows.length) {
      return { ok: false, reason: 'inviter_missing' };
    }

    var invKind = invRows[0].activation_kind != null ? String(invRows[0].activation_kind) : '';
    var transferable = null;
    if (invKind === 'permanent' || (isUserEffectivelyActive(invRows[0]) && invKind !== 'trial')) {
      transferable = randomActivationCodePlain();
      var label = formatRewardDurationLabel(days, hours, minutes);
      await conn.execute(
        `INSERT INTO activation_codes
         (code, max_uses, used_count, expires_at, grant_days, grant_hours, grant_minutes, note, owner_admin_username)
         VALUES (?, 1, 0, NULL, ?, ?, ?, ?, ?)`,
        [
          transferable,
          days || null,
          hours || null,
          minutes || null,
          notePrefix + (label ? '（' + label + '）' : ''),
          inviter
        ]
      );
      return { ok: true, transferable: transferable, applied: false };
    }

    await addTrialDurationInConn(conn, inviter, days, hours, source, refId, minutes);
    return { ok: true, transferable: null, applied: true };
  }

  /**
   * 被邀请人首次激活时补记 first_activated_at（发奖已改为注册成功即计注册奖）。
   */
  async function markInviteeActivatedInConn(conn, inviteeUsername, invitedBy) {
    var invitee = String(inviteeUsername || '').trim();
    var inviter = invitedBy != null ? String(invitedBy).trim() : '';
    if (!invitee || !inviter) return;
    if (invitee.toLowerCase() === inviter.toLowerCase()) return;

    var cfg = await loadInviteSettings(true);
    if (!cfg.enabled) return;

    const [existing] = await conn.execute(
      'SELECT id FROM user_invites WHERE invitee_username = ? LIMIT 1',
      [invitee]
    );
    if (existing.length) {
      await conn.execute(
        `UPDATE user_invites SET first_activated_at = COALESCE(first_activated_at, CURRENT_TIMESTAMP)
         WHERE id = ?`,
        [existing[0].id]
      );
      return;
    }

    await conn.execute(
      `INSERT INTO user_invites
       (inviter_username, invitee_username, first_activated_at, reward_status, reward_days, reward_minutes)
       VALUES (?, ?, CURRENT_TIMESTAMP, 'none', ?, ?)`,
      [inviter, invitee, cfg.reward_days, cfg.reward_minutes]
    );
  }

  /**
   * 被邀请人付费永久激活成功 → 邀请人立即获得付费奖励天数。
   */
  async function grantInvitePayRewardInConn(conn, inviteeUsername, invitedBy) {
    var invitee = String(inviteeUsername || '').trim();
    var inviter = invitedBy != null ? String(invitedBy).trim() : '';
    if (!invitee || !inviter) return { ok: false, reason: 'no_invite' };
    if (invitee.toLowerCase() === inviter.toLowerCase()) return { ok: false, reason: 'self' };

    var cfg = await loadInviteSettings(true);
    if (!cfg.enabled) return { ok: false, reason: 'disabled' };
    var payDays = cfg.pay_reward_days || 3;
    if (payDays < 1) return { ok: false, reason: 'zero_days' };

    const [existing] = await conn.execute(
      `SELECT id, inviter_username, pay_reward_status FROM user_invites WHERE invitee_username = ? LIMIT 1 FOR UPDATE`,
      [invitee]
    );

    var rowId = null;
    if (existing.length) {
      rowId = existing[0].id;
      inviter = String(existing[0].inviter_username || inviter);
      var st = String(existing[0].pay_reward_status || 'none');
      if (st === 'granted' || st === 'skipped_cap' || st === 'rejected') {
        await conn.execute(
          `UPDATE user_invites SET first_activated_at = COALESCE(first_activated_at, CURRENT_TIMESTAMP)
           WHERE id = ?`,
          [rowId]
        );
        return { ok: false, reason: 'already_' + st };
      }
    } else {
      const [ins] = await conn.execute(
        `INSERT INTO user_invites
         (inviter_username, invitee_username, first_activated_at, reward_status, reward_days, reward_minutes,
          pay_reward_status, pay_reward_days)
         VALUES (?, ?, CURRENT_TIMESTAMP, 'none', ?, ?, 'none', ?)`,
        [inviter, invitee, cfg.reward_days, cfg.reward_minutes, payDays]
      );
      rowId = ins.insertId;
    }

    await conn.execute(
      `UPDATE user_invites SET first_activated_at = COALESCE(first_activated_at, CURRENT_TIMESTAMP),
       pay_reward_days = ? WHERE id = ?`,
      [payDays, rowId]
    );

    var monthCount = await countInviterGrantsThisMonth(conn, inviter);
    if (monthCount >= cfg.monthly_cap) {
      await conn.execute(
        `UPDATE user_invites SET pay_reward_status = 'skipped_cap', reject_reason = COALESCE(reject_reason, 'monthly_cap_pay')
         WHERE id = ?`,
        [rowId]
      );
      return { ok: false, reason: 'monthly_cap' };
    }

    var delivered = await deliverInviteRewardToInviterInConn(conn, {
      inviter: inviter,
      days: payDays,
      hours: 0,
      minutes: 0,
      source: 'invite_pay_reward',
      refId: 'pay:' + rowId,
      notePrefix: '邀请付费奖励可转赠'
    });
    if (!delivered.ok) {
      await conn.execute(
        `UPDATE user_invites SET pay_reward_status = 'rejected', reject_reason = ? WHERE id = ?`,
        [delivered.reason || 'grant_failed', rowId]
      );
      return delivered;
    }

    await conn.execute(
      `UPDATE user_invites SET pay_reward_status = 'granted', pay_granted_at = CURRENT_TIMESTAMP,
       pay_transferable_code = ?, pay_reward_days = ? WHERE id = ?`,
      [delivered.transferable || null, payDays, rowId]
    );
    invalidateUserAuthCache(inviter);
    invalidateUserInfoApiCache(inviter);
    return { ok: true, transferable: delivered.transferable || null };
  }

  /** 注册成功即绑定邀请人并进入发奖（默认立即生效） */
  async function bindInvitedByOnRegister(username, inviteCode, clientId) {
    var cfg = await loadInviteSettings();
    if (!cfg.enabled) return null;
    var inviter = await resolveInviterByInviteCode(inviteCode);
    if (!inviter) return null;
    var u = String(username || '').trim();
    if (!u || inviter.toLowerCase() === u.toLowerCase()) return null;

    var delayMs = cfg.grant_delay_hours * 3600 * 1000;
    var grantAt = new Date(Date.now() + delayMs);

    const conn = await pool.getConnection();
    try {
      if (clientId) {
        const [dup] = await conn.execute(
          `SELECT invitee_username FROM user_invites WHERE invitee_client_id = ? LIMIT 1`,
          [String(clientId).trim()]
        );
        if (dup.length) {
          await conn.execute(
            `UPDATE users SET invited_by = COALESCE(invited_by, ?) WHERE username = ?`,
            [inviter, u]
          );
          await conn.execute(
            `INSERT IGNORE INTO user_invites
             (inviter_username, invitee_username, invitee_client_id, reward_status, reject_reason, reward_days, reward_minutes)
             VALUES (?, ?, ?, 'rejected', 'duplicate_client', ?, ?)`,
            [inviter, u, String(clientId).trim(), cfg.reward_days, cfg.reward_minutes]
          );
          return inviter;
        }
      }
      await conn.execute(
        `UPDATE users SET invited_by = COALESCE(invited_by, ?) WHERE username = ?`,
        [inviter, u]
      );
      await conn.execute(
        `INSERT IGNORE INTO user_invites
         (inviter_username, invitee_username, invitee_client_id, reward_status, reward_days, reward_minutes, grant_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
        [
          inviter,
          u,
          clientId ? String(clientId).trim() : null,
          cfg.reward_days,
          cfg.reward_minutes,
          grantAt
        ]
      );
      return inviter;
    } finally {
      conn.release();
    }
  }

  async function processPendingInviteRewards() {
    var cfg = await loadInviteSettings();
    if (!cfg.enabled) return { processed: 0 };
    const conn = await pool.getConnection();
    var processed = 0;
    try {
      const [rows] = await conn.execute(
        `SELECT id, inviter_username, invitee_username, reward_days, reward_minutes
         FROM user_invites
         WHERE reward_status = 'pending' AND grant_at IS NOT NULL AND grant_at <= CURRENT_TIMESTAMP
         ORDER BY grant_at ASC LIMIT 40`
      );
      var i;
      for (i = 0; i < rows.length; i++) {
        var row = rows[i];
        try {
          await conn.beginTransaction();
          const [locked] = await conn.execute(
            `SELECT id, inviter_username, invitee_username, reward_days, reward_minutes, reward_status
             FROM user_invites WHERE id = ? FOR UPDATE`,
            [row.id]
          );
          if (!locked.length || String(locked[0].reward_status) !== 'pending') {
            await conn.rollback();
            continue;
          }
          var inviter = String(locked[0].inviter_username);
          var days = cfg.reward_days;
          var hours = cfg.reward_hours;
          var minutes = cfg.reward_minutes;
          var monthCount = await countInviterGrantsThisMonth(conn, inviter);
          if (monthCount >= cfg.monthly_cap) {
            await conn.execute(
              `UPDATE user_invites SET reward_status = 'skipped_cap', reject_reason = 'monthly_cap'
               WHERE id = ?`,
              [row.id]
            );
            await conn.commit();
            processed += 1;
            continue;
          }

          var delivered = await deliverInviteRewardToInviterInConn(conn, {
            inviter: inviter,
            days: days,
            hours: hours,
            minutes: minutes,
            source: 'invite_reward',
            refId: String(row.id),
            notePrefix: '邀请注册奖励可转赠'
          });
          if (!delivered.ok) {
            await conn.execute(
              `UPDATE user_invites SET reward_status = 'rejected', reject_reason = ? WHERE id = ?`,
              [delivered.reason || 'grant_failed', row.id]
            );
            await conn.commit();
            processed += 1;
            continue;
          }

          await conn.execute(
            `UPDATE user_invites SET reward_status = 'granted', granted_at = CURRENT_TIMESTAMP,
             transferable_code = ?, reward_days = ?, reward_minutes = ? WHERE id = ?`,
            [delivered.transferable || null, days, minutes, row.id]
          );
          await conn.commit();
          invalidateUserAuthCache(inviter);
          invalidateUserInfoApiCache(inviter);
          processed += 1;
        } catch (eOne) {
          try {
            await conn.rollback();
          } catch (eR) {}
          console.error('processPendingInviteRewards one', eOne);
        }
      }
      return { processed: processed };
    } finally {
      conn.release();
    }
  }

  /**
   * 记录邀请链接打开（公开接口）。
   * 同设备同邀请码 30 分钟内只记 1 次，减少刷新刷量。
   */
  async function recordInviteLinkClick(opts) {
    var code = String((opts && opts.inviteCode) || '')
      .trim()
      .toUpperCase();
    if (!code || code.length > 16 || !/^[A-Z0-9]+$/.test(code)) {
      return { ok: false, reason: 'invalid_code' };
    }
    var clientId = opts && opts.clientId != null ? String(opts.clientId).trim().slice(0, 128) : '';
    var pagePath = opts && opts.pagePath != null ? String(opts.pagePath).trim().slice(0, 255) : '';
    var ip = opts && opts.ip != null ? String(opts.ip).trim().slice(0, 64) : '';
    const conn = await pool.getConnection();
    try {
      const [owners] = await conn.execute(
        'SELECT username FROM users WHERE invite_code = ? LIMIT 1',
        [code]
      );
      if (!owners.length) {
        return { ok: false, reason: 'unknown_code' };
      }
      var inviter = String(owners[0].username);
      if (clientId) {
        const [dup] = await conn.execute(
          `SELECT id FROM invite_link_clicks
           WHERE invite_code = ? AND visitor_client_id = ?
             AND created_at >= (CURRENT_TIMESTAMP - INTERVAL 30 MINUTE)
           LIMIT 1`,
          [code, clientId]
        );
        if (dup.length) {
          return { ok: true, recorded: false, deduped: true };
        }
      }
      await conn.execute(
        `INSERT INTO invite_link_clicks
         (invite_code, inviter_username, visitor_client_id, visitor_ip, page_path)
         VALUES (?, ?, ?, ?, ?)`,
        [code, inviter, clientId || null, ip || null, pagePath || null]
      );
      return { ok: true, recorded: true };
    } finally {
      conn.release();
    }
  }

  async function getInviteOverviewForUser(username) {
    var u = String(username || '').trim();
    var cfg = await loadInviteSettings();
    const conn = await pool.getConnection();
    try {
      var inviteCode = await ensureUserInviteCode(conn, u);
      const [urows] = await conn.execute(
        `SELECT activation_kind, active_until, account_active, invited_by FROM users WHERE username = ? LIMIT 1`,
        [u]
      );
      var fields = activationFieldsForApi(urows[0] || {});
      const [stats] = await conn.execute(
        `SELECT
           SUM(CASE WHEN reward_status IN ('pending','granted','skipped_cap') THEN 1 ELSE 0 END) AS invited_activated,
           SUM(CASE WHEN reward_status = 'granted' THEN 1 ELSE 0 END)
             + SUM(CASE WHEN pay_reward_status = 'granted' THEN 1 ELSE 0 END) AS rewarded,
           SUM(CASE WHEN reward_status = 'pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN reward_status = 'granted' AND granted_at >= DATE_FORMAT(CURRENT_TIMESTAMP, '%Y-%m-01 00:00:00') THEN 1 ELSE 0 END)
             + SUM(CASE WHEN pay_reward_status = 'granted' AND pay_granted_at >= DATE_FORMAT(CURRENT_TIMESTAMP, '%Y-%m-01 00:00:00') THEN 1 ELSE 0 END)
             AS rewarded_month
         FROM user_invites WHERE inviter_username = ?`,
        [u]
      );
      var s = stats[0] || {};
      const [clickStats] = await conn.execute(
        `SELECT
           COUNT(*) AS clicks,
           COUNT(DISTINCT NULLIF(visitor_client_id, '')) AS visitors
         FROM invite_link_clicks WHERE inviter_username = ?`,
        [u]
      );
      var cs = clickStats[0] || {};
      const [codes] = await conn.execute(
        `SELECT code, granted_at, days, minutes, invitee_username, kind FROM (
           SELECT transferable_code AS code, granted_at, reward_days AS days, reward_minutes AS minutes,
                  invitee_username, 'register' AS kind
           FROM user_invites
           WHERE inviter_username = ? AND transferable_code IS NOT NULL AND reward_status = 'granted'
           UNION ALL
           SELECT pay_transferable_code AS code, pay_granted_at AS granted_at, pay_reward_days AS days, 0 AS minutes,
                  invitee_username, 'pay' AS kind
           FROM user_invites
           WHERE inviter_username = ? AND pay_transferable_code IS NOT NULL AND pay_reward_status = 'granted'
         ) AS t
         ORDER BY granted_at DESC LIMIT 20`,
        [u, u]
      );
      return {
        enabled: cfg.enabled,
        invite_code: inviteCode,
        invite_path: inviteCode
          ? 'register.html?invite=' + encodeURIComponent(inviteCode)
          : '',
        invite_download_path: inviteCode
          ? 'install_guide.html?invite=' +
            encodeURIComponent(inviteCode) +
            '&download=1#download'
          : '',
        reward_days: cfg.reward_days,
        reward_hours: cfg.reward_hours,
        reward_minutes: cfg.reward_minutes,
        pay_reward_days: cfg.pay_reward_days,
        monthly_cap: cfg.monthly_cap,
        grant_delay_hours: cfg.grant_delay_hours,
        rewarded_this_month: Number(s.rewarded_month) || 0,
        invited_activated: Number(s.invited_activated) || 0,
        rewarded_total: Number(s.rewarded) || 0,
        pending_rewards: Number(s.pending) || 0,
        link_clicks: Number(cs.clicks) || 0,
        link_visitors: Number(cs.visitors) || 0,
        transferable_codes: (codes || []).map(function (c) {
          return {
            code: c.code,
            days: c.days,
            minutes: c.minutes,
            kind: c.kind,
            invitee: c.invitee_username,
            granted_at: c.granted_at
          };
        }),
        account_active: fields.account_active,
        activation_kind: fields.activation_kind,
        active_until: fields.active_until,
        active_days_left: fields.active_days_left
      };
    } finally {
      conn.release();
    }
  }

  async function saveInviteSettingsFromAdmin(body) {
    const conn = await pool.getConnection();
    try {
      if (Object.prototype.hasOwnProperty.call(body, 'invite_enabled')) {
        var en = body.invite_enabled === true || body.invite_enabled === 1 || body.invite_enabled === '1';
        await upsertAppSetting(conn, SETTING_INVITE_ENABLED, en ? '1' : '0');
      }
      if (Object.prototype.hasOwnProperty.call(body, 'invite_reward_days')) {
        var d = parseInt(body.invite_reward_days, 10);
        if (!isFinite(d) || d < 0) d = 0;
        if (d > 365) d = 365;
        await upsertAppSetting(conn, SETTING_INVITE_REWARD_DAYS, String(d));
      }
      if (Object.prototype.hasOwnProperty.call(body, 'invite_reward_hours')) {
        var rh = parseInt(body.invite_reward_hours, 10);
        if (!isFinite(rh) || rh < 0) rh = 0;
        if (rh > 24 * 30) rh = 24 * 30;
        await upsertAppSetting(conn, SETTING_INVITE_REWARD_HOURS, String(rh));
      }
      if (Object.prototype.hasOwnProperty.call(body, 'invite_reward_minutes')) {
        var rm = parseInt(body.invite_reward_minutes, 10);
        if (!isFinite(rm) || rm < 0) rm = 30;
        if (rm > 24 * 60) rm = 24 * 60;
        await upsertAppSetting(conn, SETTING_INVITE_REWARD_MINUTES, String(rm));
      }
      if (Object.prototype.hasOwnProperty.call(body, 'invite_pay_reward_days')) {
        var pd = parseInt(body.invite_pay_reward_days, 10);
        if (!isFinite(pd) || pd < 0) pd = 3;
        if (pd > 365) pd = 365;
        await upsertAppSetting(conn, SETTING_INVITE_PAY_REWARD_DAYS, String(pd));
      }
      if (Object.prototype.hasOwnProperty.call(body, 'invite_monthly_cap')) {
        var c = parseInt(body.invite_monthly_cap, 10);
        if (!isFinite(c) || c < 0) c = 4;
        if (c > 100) c = 100;
        await upsertAppSetting(conn, SETTING_INVITE_MONTHLY_CAP, String(c));
      }
      if (Object.prototype.hasOwnProperty.call(body, 'invite_grant_delay_hours')) {
        var h = parseInt(body.invite_grant_delay_hours, 10);
        if (!isFinite(h) || h < 0) h = 0;
        if (h > 24 * 30) h = 24 * 30;
        await upsertAppSetting(conn, SETTING_INVITE_GRANT_DELAY_HOURS, String(h));
      }
      invalidateInviteSettingsCache();
      return loadInviteSettings(true);
    } finally {
      conn.release();
    }
  }

  return {
    isUserEffectivelyActive: isUserEffectivelyActive,
    activationFieldsForApi: activationFieldsForApi,
    loadInviteSettings: loadInviteSettings,
    ensureUserInviteCode: ensureUserInviteCode,
    resolveInviterByInviteCode: resolveInviterByInviteCode,
    setUserPermanentInConn: setUserPermanentInConn,
    addTrialDaysInConn: addTrialDaysInConn,
    applyActivationCodeExtended: applyActivationCodeExtended,
    bindInvitedByOnRegister: bindInvitedByOnRegister,
    markInviteeActivatedInConn: markInviteeActivatedInConn,
    grantInvitePayRewardInConn: grantInvitePayRewardInConn,
    processPendingInviteRewards: processPendingInviteRewards,
    recordInviteLinkClick: recordInviteLinkClick,
    getInviteOverviewForUser: getInviteOverviewForUser,
    saveInviteSettingsFromAdmin: saveInviteSettingsFromAdmin,
    invalidateInviteSettingsCache: invalidateInviteSettingsCache,
    SETTING_INVITE_ENABLED: SETTING_INVITE_ENABLED,
    SETTING_INVITE_REWARD_DAYS: SETTING_INVITE_REWARD_DAYS,
    SETTING_INVITE_REWARD_HOURS: SETTING_INVITE_REWARD_HOURS,
    SETTING_INVITE_REWARD_MINUTES: SETTING_INVITE_REWARD_MINUTES,
    SETTING_INVITE_PAY_REWARD_DAYS: SETTING_INVITE_PAY_REWARD_DAYS,
    SETTING_INVITE_MONTHLY_CAP: SETTING_INVITE_MONTHLY_CAP,
    SETTING_INVITE_GRANT_DELAY_HOURS: SETTING_INVITE_GRANT_DELAY_HOURS
  };
}

module.exports = {
  createInviteReward: createInviteReward,
  isUserEffectivelyActive: isUserEffectivelyActive,
  activationFieldsForApi: activationFieldsForApi
};
