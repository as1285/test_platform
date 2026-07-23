/**
 * 时效激活（trial / permanent / 激活码履约）
 * 邀请注册/邀请有礼已移除；本模块仅保留激活相关能力。
 */
'use strict';

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

/** 时效试用已过期（仍记为 trial，但 active_until 已过） */
function isTrialExpired(row) {
  if (!row) return false;
  var kind = row.activation_kind != null ? String(row.activation_kind).trim() : '';
  if (kind !== 'trial') return false;
  if (!row.active_until) return true;
  var t = new Date(row.active_until).getTime();
  return !isFinite(t) || t <= Date.now();
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
  var invalidateUserAuthCache = deps.invalidateUserAuthCache;
  var invalidateUserInfoApiCache = deps.invalidateUserInfoApiCache;
  var ADMIN_PANEL_USER = deps.ADMIN_PANEL_USER || 'admin';

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
    var grantDaysLog = d + (h > 0 ? h / 24 : 0) + (m > 0 ? m / 1440 : 0);
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
        `SELECT account_active, activation_kind, active_until FROM users WHERE username = ? FOR UPDATE`,
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

  return {
    isUserEffectivelyActive: isUserEffectivelyActive,
    activationFieldsForApi: activationFieldsForApi,
    setUserPermanentInConn: setUserPermanentInConn,
    addTrialDaysInConn: addTrialDaysInConn,
    applyActivationCodeExtended: applyActivationCodeExtended
  };
}

module.exports = {
  createInviteReward: createInviteReward,
  isUserEffectivelyActive: isUserEffectivelyActive,
  isTrialExpired: isTrialExpired,
  activationFieldsForApi: activationFieldsForApi
};
