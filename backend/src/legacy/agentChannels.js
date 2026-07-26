/**
 * 代理专属渠道：channel_id → 下属代理账号 + 默认支付 A/B/C
 * 未显式配置 a/b 时一律强制 C（不再跟随增长分流）。
 */
const CHANNEL_ID_RE = /^[a-z0-9_-]{1,64}$/i;

function createAgentChannels(deps) {
  var getPool = deps.getPool;
  var sanitizeSalesChannelId =
    typeof deps.sanitizeSalesChannelId === 'function'
      ? deps.sanitizeSalesChannelId
      : function (raw) {
          var s = String(raw == null ? '' : raw).trim().toLowerCase();
          if (!s || !CHANNEL_ID_RE.test(s)) return '';
          return s;
        };

  async function ensureTable() {
    var pool = getPool();
    await pool.execute(
      `CREATE TABLE IF NOT EXISTS agent_channels (
        channel_id VARCHAR(64) NOT NULL,
        owner_admin_username VARCHAR(64) NOT NULL,
        default_pricing_abc VARCHAR(8) NOT NULL DEFAULT 'c' COMMENT 'a|b|c，空亦按 c（代理专属默认 C）',
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        note VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (channel_id),
        KEY idx_agent_channels_owner (owner_admin_username),
        KEY idx_agent_channels_enabled (enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    try {
      await pool.execute(
        `ALTER TABLE users ADD COLUMN owner_agent_admin VARCHAR(64) NULL COMMENT '专属渠道绑定的下属代理账号' AFTER sales_promo_channel`
      );
    } catch (e) {
      if (!(e && (e.code === 'ER_DUP_FIELDNAME' || e.errno === 1060))) throw e;
    }
  }

  function normalizeAbc(raw) {
    var s = String(raw == null ? '' : raw).trim();
    try {
      if (typeof s.normalize === 'function') s = s.normalize('NFKC');
    } catch (eNfkc) {}
    s = s.toLowerCase();
    if (s === 'a' || s === 'b' || s === 'c') return s;
    /* 空 / none / auto：历史「跟随分流」；专属渠道侧按 C 处理见 effectivePricingAbc */
    if (
      s === '' ||
      s === 'none' ||
      s === '-' ||
      s === 'auto' ||
      s === 'follow' ||
      s === 'ab' ||
      s === 'growth'
    ) {
      return '';
    }
    return '';
  }

  /** 专属渠道有效默认支付：未显式 a/b/c 时强制 C */
  function effectivePricingAbc(raw) {
    return normalizeAbc(raw) || 'c';
  }

  function normalizeOwner(raw) {
    return String(raw == null ? '' : raw).trim().slice(0, 64);
  }

  function normalizeNote(raw) {
    var s = String(raw == null ? '' : raw).trim();
    return s ? s.slice(0, 255) : null;
  }

  async function listChannels() {
    await ensureTable();
    var pool = getPool();
    const [rows] = await pool.execute(
      `SELECT channel_id, owner_admin_username, default_pricing_abc, enabled, note, created_at, updated_at
       FROM agent_channels
       ORDER BY updated_at DESC, channel_id ASC`
    );
    return (rows || []).map(function (r) {
      return {
        channel_id: String(r.channel_id || ''),
        owner_admin_username: String(r.owner_admin_username || ''),
        default_pricing_abc: effectivePricingAbc(r.default_pricing_abc),
        enabled: Number(r.enabled) === 1,
        note: r.note != null ? String(r.note) : '',
        created_at: r.created_at,
        updated_at: r.updated_at
      };
    });
  }

  async function getChannelById(channelId) {
    var id = sanitizeSalesChannelId(channelId);
    if (!id) return null;
    await ensureTable();
    var pool = getPool();
    const [rows] = await pool.execute(
      `SELECT channel_id, owner_admin_username, default_pricing_abc, enabled, note
       FROM agent_channels WHERE channel_id = ? LIMIT 1`,
      [id]
    );
    if (!rows || !rows.length) return null;
    var r = rows[0];
    return {
      channel_id: String(r.channel_id || ''),
      owner_admin_username: String(r.owner_admin_username || ''),
      default_pricing_abc: effectivePricingAbc(r.default_pricing_abc),
      enabled: Number(r.enabled) === 1,
      note: r.note != null ? String(r.note) : ''
    };
  }

  async function getEnabledChannelById(channelId) {
    var ch = await getChannelById(channelId);
    if (!ch || !ch.enabled) return null;
    return ch;
  }

  async function listEnabledChannelIds() {
    await ensureTable();
    var pool = getPool();
    const [rows] = await pool.execute(
      `SELECT channel_id FROM agent_channels WHERE enabled = 1 ORDER BY channel_id ASC`
    );
    return (rows || [])
      .map(function (r) {
        return sanitizeSalesChannelId(r.channel_id);
      })
      .filter(Boolean);
  }

  async function listChannelIdsForOwner(ownerAdmin) {
    var owner = normalizeOwner(ownerAdmin);
    if (!owner) return [];
    await ensureTable();
    var pool = getPool();
    const [rows] = await pool.execute(
      `SELECT channel_id FROM agent_channels
       WHERE enabled = 1 AND owner_admin_username = ?
       ORDER BY channel_id ASC`,
      [owner]
    );
    return (rows || [])
      .map(function (r) {
        return sanitizeSalesChannelId(r.channel_id);
      })
      .filter(Boolean);
  }

  async function upsertChannel(input) {
    var channelId = sanitizeSalesChannelId(input && input.channel_id);
    var owner = normalizeOwner(input && input.owner_admin_username);
    /* 未传或跟随分流 → 默认 C */
    var abc = effectivePricingAbc(input && input.default_pricing_abc);
    var enabled = input && input.enabled === false ? 0 : 1;
    var note = normalizeNote(input && input.note);
    if (!channelId) {
      var err = new Error('渠道 ID 无效（仅字母数字下划线连字符，最长 64）');
      err.code = 'INVALID_CHANNEL';
      throw err;
    }
    if (!owner) {
      var err2 = new Error('请选择下属代理账号');
      err2.code = 'INVALID_OWNER';
      throw err2;
    }
    await ensureTable();
    var pool = getPool();
    await pool.execute(
      `INSERT INTO agent_channels (channel_id, owner_admin_username, default_pricing_abc, enabled, note)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         owner_admin_username = VALUES(owner_admin_username),
         default_pricing_abc = VALUES(default_pricing_abc),
         enabled = VALUES(enabled),
         note = VALUES(note)`,
      [channelId, owner, abc, enabled, note]
    );
    return getChannelById(channelId);
  }

  async function deleteChannel(channelId) {
    var id = sanitizeSalesChannelId(channelId);
    if (!id) return false;
    await ensureTable();
    var pool = getPool();
    const [ret] = await pool.execute(`DELETE FROM agent_channels WHERE channel_id = ?`, [id]);
    return !!(ret && ret.affectedRows);
  }

  /**
   * 按渠道把用户挂到下属代理名下，并返回渠道配置（含默认支付方案）。
   * 经专属渠道注册/登录时写入 owner_agent_admin；sales_promo_channel 仅在为空时补齐。
   */
  async function attachUserToChannel(username, channelId, opts) {
    var u = String(username || '').trim();
    var ch = await getEnabledChannelById(channelId);
    if (!u || !ch) return null;
    var pool = getPool();
    var setPromo = !(opts && opts.keepExistingPromo);
    if (setPromo) {
      await pool.execute(
        `UPDATE users
         SET sales_promo_channel = COALESCE(NULLIF(TRIM(sales_promo_channel), ''), ?),
             owner_agent_admin = ?
         WHERE username = ?`,
        [ch.channel_id, ch.owner_admin_username, u]
      );
    } else {
      await pool.execute(
        `UPDATE users
         SET owner_agent_admin = ?
         WHERE username = ?`,
        [ch.owner_admin_username, u]
      );
    }
    return ch;
  }

  async function getUserChannelPolicy(username) {
    var u = String(username || '').trim();
    if (!u) return null;
    await ensureTable();
    var pool = getPool();
    const [rows] = await pool.execute(
      `SELECT sales_promo_channel, owner_agent_admin
       FROM users WHERE username = ? LIMIT 1`,
      [u]
    );
    if (!rows || !rows.length) return null;
    var channelId = sanitizeSalesChannelId(rows[0].sales_promo_channel || '');
    if (!channelId) return null;
    return getEnabledChannelById(channelId);
  }

  return {
    ensureTable: ensureTable,
    listChannels: listChannels,
    getChannelById: getChannelById,
    getEnabledChannelById: getEnabledChannelById,
    listEnabledChannelIds: listEnabledChannelIds,
    listChannelIdsForOwner: listChannelIdsForOwner,
    upsertChannel: upsertChannel,
    deleteChannel: deleteChannel,
    attachUserToChannel: attachUserToChannel,
    getUserChannelPolicy: getUserChannelPolicy,
    normalizeAbc: normalizeAbc,
    effectivePricingAbc: effectivePricingAbc
  };
}

module.exports = { createAgentChannels: createAgentChannels };
