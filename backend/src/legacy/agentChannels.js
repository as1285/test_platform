/**
 * 代理专属渠道：channel_id → 下属代理账号 + 默认支付 A/B/C
 * 未显式配置 a/b 时一律强制 C（不再跟随增长分流）。
 * hide_self_serve_pay=1：仅激活码开通，隐藏全部自助支付（强制 C）。
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
        owner_admin_username VARCHAR(64) NOT NULL DEFAULT '',
        default_pricing_abc VARCHAR(8) NOT NULL DEFAULT 'c' COMMENT 'a|b|c，空亦按 c（代理专属默认 C）',
        hide_self_serve_pay TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=仅激活码，隐藏支付宝/闲鱼等自助支付',
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
    try {
      await pool.execute(
        `ALTER TABLE agent_channels
         ADD COLUMN hide_self_serve_pay TINYINT(1) NOT NULL DEFAULT 0
         COMMENT '1=仅激活码，隐藏支付宝/闲鱼等自助支付'
         AFTER default_pricing_abc`
      );
      /* 存量：C 方案渠道默认开启仅激活码；显式 A/B 保持可自助支付 */
      await pool.execute(
        `UPDATE agent_channels
         SET hide_self_serve_pay = 1
         WHERE LOWER(TRIM(IFNULL(default_pricing_abc, ''))) IN ('', 'c')`
      );
    } catch (e2) {
      if (!(e2 && (e2.code === 'ER_DUP_FIELDNAME' || e2.errno === 1060))) throw e2;
    }
    try {
      await pool.execute(
        `ALTER TABLE agent_channels
         MODIFY COLUMN owner_admin_username VARCHAR(64) NOT NULL DEFAULT ''`
      );
    } catch (e3) {}
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

  /** 专属渠道有效默认支付：未显式 a/b 时默认 A（全站支付宝）；c 视为 a */
  function effectivePricingAbc(raw) {
    var v = normalizeAbc(raw);
    if (v === 'b') return 'b';
    if (v === 'c') return 'a';
    return v || 'a';
  }

  function normalizeOwner(raw) {
    return String(raw == null ? '' : raw).trim().slice(0, 64);
  }

  function normalizeNote(raw) {
    var s = String(raw == null ? '' : raw).trim();
    return s ? s.slice(0, 255) : null;
  }

  function normalizeHideSelfServePay(raw, abc) {
    /* 全站取消渠道「仅激活码」：忽略 hide_self_serve_pay */
    return false;
  }

  /** 清洗安装包 URL（uploads/ 相对路径或 http(s)） */
  function normalizePackageUrl(raw) {
    if (raw == null) return '';
    var s = String(raw).trim();
    if (!s || s.length > 2048 || /[\s<>"'`]/.test(s)) return '';
    if (/^https?:\/\//i.test(s)) {
      try {
        var u = new URL(s);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
        return s;
      } catch (e) {
        return '';
      }
    }
    if (s.charAt(0) === '/' && s.indexOf('//') !== 0) {
      if (/^\/[a-zA-Z0-9_.\-\/%]+$/.test(s)) return s;
      return '';
    }
    if (s.indexOf('..') >= 0) return '';
    if (/^uploads\/[a-zA-Z0-9_.\-\/%]+$/.test(s)) return s;
    return '';
  }

  var CHANNEL_SKU_IDS = ['sku_300_7d', 'sku_348_14d', 'sku_398_30d', 'sku_ch_t4', 'sku_ch_t5'];
  var CHANNEL_SKU_META = {
    sku_300_7d: { key: 'week', default_days: 7, default_label: '档位1' },
    sku_348_14d: { key: 'biweek', default_days: 14, default_label: '档位2' },
    sku_398_30d: { key: 'month', default_days: 30, default_label: '档位3' },
    sku_ch_t4: { key: 't4', default_days: 90, default_label: '档位4' },
    sku_ch_t5: { key: 't5', default_days: 365, default_label: '档位5' }
  };

  function parseNonNegInt(raw, max) {
    if (raw == null || String(raw).trim() === '') return null;
    var n = parseInt(String(raw).trim(), 10);
    if (!isFinite(n) || n < 0) return null;
    if (max != null && n > max) n = max;
    return n;
  }

  function parseAmount(raw) {
    if (raw == null || String(raw).trim() === '') return '';
    var n = Number(String(raw).trim().replace(/,/g, ''));
    if (!isFinite(n) || n < 0.01 || n > 99999) return '';
    return n.toFixed(2);
  }

  function formatGrantLabel(days, hours) {
    var d = parseInt(days, 10) || 0;
    var h = parseInt(hours, 10) || 0;
    if (d <= 0 && h <= 0) return '';
    if (d > 0 && h > 0) return d + '天' + h + '小时';
    if (d > 0) return d + '天';
    return h + '小时';
  }

  /**
   * 渠道「心理价」= 划线对照原价（list_amount）；「价格」仍为实付价。
   * 与全站支付套餐字段语义相反：全站是价格=原价、心理价=实付。
   */
  function parseListAmount(raw) {
    return parseAmount(raw);
  }

  function applyListAmountField(target, raw) {
    var list = parseListAmount(raw);
    if (list) target.list_amount = list;
  }

  /**
   * 清洗渠道专属套餐覆盖：金额 / 心理价(划线) / 天数 / 小时 / 名称。
   * 兼容旧格式 { sku_id: "199.00" }；新格式 { sku_id: { amount, list_amount, grant_days, grant_hours, label } }。
   * 也可传拆开字段 price_week / psych_week / days_week / hours_week / label_week …
   */
  function normalizeSkuPrices(raw) {
    var src = raw;
    if (src == null || src === '') return {};
    if (typeof src === 'string') {
      try {
        src = JSON.parse(src);
      } catch (e) {
        return {};
      }
    }
    if (typeof src !== 'object' || Array.isArray(src)) return {};

    var bucket = {};
    function ensure(id) {
      if (!bucket[id]) bucket[id] = {};
      return bucket[id];
    }

    /* 拆开字段：price_week / psych_week|list_week / days_week / hours_week / label_week */
    CHANNEL_SKU_IDS.forEach(function (id) {
      var meta = CHANNEL_SKU_META[id];
      var key = meta.key;
      var amt = parseAmount(src['price_' + key] != null ? src['price_' + key] : src[key]);
      var listRaw =
        src['psych_' + key] != null
          ? src['psych_' + key]
          : src['list_' + key] != null
            ? src['list_' + key]
            : '';
      var days = parseNonNegInt(src['days_' + key], 3650);
      var hours = parseNonNegInt(src['hours_' + key], 23);
      var label =
        src['label_' + key] != null ? String(src['label_' + key]).trim().slice(0, 32) : '';
      if (amt) ensure(id).amount = amt;
      if (listRaw !== '' && listRaw != null) applyListAmountField(ensure(id), listRaw);
      if (days != null) ensure(id).grant_days = days;
      if (hours != null) ensure(id).grant_hours = hours;
      if (label) ensure(id).label = label;
    });

    /* sku_slots: [{ id|slot, amount, list_amount|psych_amount, grant_days, grant_hours, label }] */
    if (Array.isArray(src.sku_slots)) {
      src.sku_slots.forEach(function (slot, idx) {
        if (!slot || typeof slot !== 'object') return;
        var id = String(slot.id || CHANNEL_SKU_IDS[idx] || '').trim();
        if (CHANNEL_SKU_IDS.indexOf(id) < 0) return;
        var amt = parseAmount(slot.amount);
        var listSlot =
          slot.list_amount != null
            ? slot.list_amount
            : slot.psych_amount != null
              ? slot.psych_amount
              : '';
        var days = parseNonNegInt(slot.grant_days, 3650);
        var hours = parseNonNegInt(slot.grant_hours, 23);
        var label = slot.label != null ? String(slot.label).trim().slice(0, 32) : '';
        if (amt) ensure(id).amount = amt;
        if (listSlot !== '' && listSlot != null) applyListAmountField(ensure(id), listSlot);
        if (days != null) ensure(id).grant_days = days;
        if (hours != null) ensure(id).grant_hours = hours;
        if (label) ensure(id).label = label;
      });
    }

    Object.keys(src).forEach(function (k) {
      var aliases = {
        week: 'sku_300_7d',
        week_amount: 'sku_300_7d',
        sku_week: 'sku_300_7d',
        biweek: 'sku_348_14d',
        biweek_amount: 'sku_348_14d',
        sku_biweek: 'sku_348_14d',
        month: 'sku_398_30d',
        month_amount: 'sku_398_30d',
        sku_month: 'sku_398_30d',
        t4: 'sku_ch_t4',
        t4_amount: 'sku_ch_t4',
        sku_t4: 'sku_ch_t4',
        t5: 'sku_ch_t5',
        t5_amount: 'sku_ch_t5',
        sku_t5: 'sku_ch_t5'
      };
      if (
        k.indexOf('price_') === 0 ||
        k.indexOf('days_') === 0 ||
        k.indexOf('hours_') === 0 ||
        k.indexOf('label_') === 0 ||
        k.indexOf('psych_') === 0 ||
        k.indexOf('list_') === 0
      ) {
        return;
      }
      if (k === 'sku_slots') return;
      var id = aliases[k] || k;
      if (CHANNEL_SKU_IDS.indexOf(id) < 0) return;
      var v = src[k];
      if (v == null || v === '') return;
      if (typeof v === 'object' && !Array.isArray(v)) {
        var amtO = parseAmount(v.amount);
        var listO =
          v.list_amount != null ? v.list_amount : v.psych_amount != null ? v.psych_amount : '';
        var daysO = parseNonNegInt(v.grant_days, 3650);
        var hoursO = parseNonNegInt(v.grant_hours, 23);
        var labelO = v.label != null ? String(v.label).trim().slice(0, 32) : '';
        if (amtO) ensure(id).amount = amtO;
        if (listO !== '' && listO != null) applyListAmountField(ensure(id), listO);
        if (daysO != null) ensure(id).grant_days = daysO;
        if (hoursO != null) ensure(id).grant_hours = hoursO;
        if (labelO) ensure(id).label = labelO;
        return;
      }
      /* 旧格式：纯金额字符串 */
      var amtS = parseAmount(v);
      if (amtS) ensure(id).amount = amtS;
    });

    var out = {};
    Object.keys(bucket).forEach(function (id) {
      var o = bucket[id];
      var hasAmt = !!o.amount;
      var hasList = !!o.list_amount;
      var hasDur = o.grant_days != null || o.grant_hours != null;
      var hasLabel = !!o.label;
      if (!hasAmt && !hasList && !hasDur && !hasLabel) return;
      /* 只改时长时也要落库 */
      if (hasDur) {
        if (o.grant_days == null) o.grant_days = 0;
        if (o.grant_hours == null) o.grant_hours = 0;
        if ((o.grant_days || 0) + (o.grant_hours || 0) <= 0 && !hasAmt && !hasList && !hasLabel) {
          return;
        }
      }
      out[id] = o;
    });
    return out;
  }

  function skuPricesHasAny(map) {
    return !!(map && typeof map === 'object' && Object.keys(map).length);
  }

  /** API/表单展示用扁平字段 */
  function flattenSkuPrices(prices) {
    var p = prices || {};
    function slot(id) {
      var o = p[id];
      if (o == null) {
        return { amount: '', list_amount: '', grant_days: '', grant_hours: '', label: '' };
      }
      if (typeof o !== 'object') {
        return {
          amount: String(o),
          list_amount: '',
          grant_days: '',
          grant_hours: '',
          label: ''
        };
      }
      return {
        amount: o.amount != null ? String(o.amount) : '',
        list_amount: o.list_amount != null ? String(o.list_amount) : '',
        grant_days: o.grant_days != null ? String(o.grant_days) : '',
        grant_hours: o.grant_hours != null ? String(o.grant_hours) : '',
        label: o.label != null ? String(o.label) : ''
      };
    }
    var out = {};
    CHANNEL_SKU_IDS.forEach(function (id) {
      var meta = CHANNEL_SKU_META[id];
      var s = slot(id);
      out['price_' + meta.key] = s.amount;
      out['psych_' + meta.key] = s.list_amount;
      out['list_' + meta.key] = s.list_amount;
      out['days_' + meta.key] = s.grant_days;
      out['hours_' + meta.key] = s.grant_hours;
      out['label_' + meta.key] = s.label;
    });
    return out;
  }

  function mapChannelRow(r) {
    var abc = effectivePricingAbc(r.default_pricing_abc);
    var prices = normalizeSkuPrices(r.sku_prices_json);
    var flat = flattenSkuPrices(prices);
    var row = {
      channel_id: String(r.channel_id || ''),
      owner_admin_username: String(r.owner_admin_username || ''),
      default_pricing_abc: abc,
      hide_self_serve_pay: false,
      code_only: false,
      enabled: Number(r.enabled) === 1,
      note: r.note != null ? String(r.note) : '',
      android_apk_url:
        r.android_apk_url != null && String(r.android_apk_url).trim() !== ''
          ? String(r.android_apk_url).trim()
          : '',
      ios_mobileconfig_url:
        r.ios_mobileconfig_url != null && String(r.ios_mobileconfig_url).trim() !== ''
          ? String(r.ios_mobileconfig_url).trim()
          : '',
      sku_prices: prices,
      has_channel_prices: skuPricesHasAny(prices),
      created_at: r.created_at,
      updated_at: r.updated_at
    };
    Object.keys(flat).forEach(function (k) {
      row[k] = flat[k];
    });
    return row;
  }

  async function ensurePackageUrlColumns() {
    var pool = getPool();
    try {
      await pool.execute(
        `ALTER TABLE agent_channels
         ADD COLUMN android_apk_url VARCHAR(2048) NULL
         COMMENT '渠道专用 APK（uploads/… 或 https）' AFTER note`
      );
    } catch (e) {
      if (!(e && (e.code === 'ER_DUP_FIELDNAME' || e.errno === 1060))) throw e;
    }
    try {
      await pool.execute(
        `ALTER TABLE agent_channels
         ADD COLUMN ios_mobileconfig_url VARCHAR(2048) NULL
         COMMENT '渠道专用 mobileconfig（uploads/… 或 https）' AFTER android_apk_url`
      );
    } catch (e2) {
      if (!(e2 && (e2.code === 'ER_DUP_FIELDNAME' || e2.errno === 1060))) throw e2;
    }
    try {
      await pool.execute(
        `ALTER TABLE agent_channels
         ADD COLUMN sku_prices_json TEXT NULL
         COMMENT '渠道专属价 JSON' AFTER ios_mobileconfig_url`
      );
    } catch (e3) {
      if (!(e3 && (e3.code === 'ER_DUP_FIELDNAME' || e3.errno === 1060))) throw e3;
    }
  }

  async function listChannels() {
    await ensureTable();
    await ensurePackageUrlColumns();
    var pool = getPool();
    const [rows] = await pool.execute(
      `SELECT channel_id, owner_admin_username, default_pricing_abc, hide_self_serve_pay,
              enabled, note, android_apk_url, ios_mobileconfig_url, sku_prices_json,
              created_at, updated_at
       FROM agent_channels
       ORDER BY updated_at DESC, channel_id ASC`
    );
    return (rows || []).map(mapChannelRow);
  }

  async function getChannelById(channelId) {
    var id = sanitizeSalesChannelId(channelId);
    if (!id) return null;
    await ensureTable();
    await ensurePackageUrlColumns();
    var pool = getPool();
    const [rows] = await pool.execute(
      `SELECT channel_id, owner_admin_username, default_pricing_abc, hide_self_serve_pay, enabled, note,
              android_apk_url, ios_mobileconfig_url, sku_prices_json
       FROM agent_channels WHERE channel_id = ? LIMIT 1`,
      [id]
    );
    if (!rows || !rows.length) return null;
    return mapChannelRow(rows[0]);
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
    /* 平台自有渠道可留空下属代理 */
    var owner = normalizeOwner(input && input.owner_admin_username);
    var hideSelf = normalizeHideSelfServePay(
      input && input.hide_self_serve_pay,
      input && input.default_pricing_abc
    );
    /* 全站支付宝：渠道默认 A；显式 B 保留；c/仅激活码不再写入 */
    var abc = effectivePricingAbc(input && input.default_pricing_abc);
    var enabled = input && input.enabled === false ? 0 : 1;
    var note = normalizeNote(input && input.note);
    var androidUrl = normalizePackageUrl(input && input.android_apk_url);
    var iosUrl = normalizePackageUrl(input && input.ios_mobileconfig_url);
    var priceSrc = input && input.sku_prices != null ? input.sku_prices : null;
    if (priceSrc == null) {
      priceSrc = { sku_slots: input && input.sku_slots };
      CHANNEL_SKU_IDS.forEach(function (id) {
        var key = CHANNEL_SKU_META[id].key;
        priceSrc['price_' + key] = input && input['price_' + key];
        priceSrc['psych_' + key] =
          input && (input['psych_' + key] != null ? input['psych_' + key] : input['list_' + key]);
        priceSrc['days_' + key] = input && input['days_' + key];
        priceSrc['hours_' + key] = input && input['hours_' + key];
        priceSrc['label_' + key] = input && input['label_' + key];
      });
    }
    var prices = normalizeSkuPrices(priceSrc);
    var pricesJson = skuPricesHasAny(prices) ? JSON.stringify(prices) : null;
    if (!channelId) {
      var err = new Error('渠道 ID 无效（仅字母数字下划线连字符，最长 64）');
      err.code = 'INVALID_CHANNEL';
      throw err;
    }
    if (
      (input &&
        input.android_apk_url != null &&
        String(input.android_apk_url).trim() !== '' &&
        !androidUrl) ||
      (input &&
        input.ios_mobileconfig_url != null &&
        String(input.ios_mobileconfig_url).trim() !== '' &&
        !iosUrl)
    ) {
      var errUrl = new Error('安装包地址无效（请使用 uploads/… 或 http(s) 完整链接）');
      errUrl.code = 'INVALID_PACKAGE_URL';
      throw errUrl;
    }
    await ensureTable();
    await ensurePackageUrlColumns();
    var pool = getPool();
    await pool.execute(
      `INSERT INTO agent_channels
         (channel_id, owner_admin_username, default_pricing_abc, hide_self_serve_pay, enabled, note,
          android_apk_url, ios_mobileconfig_url, sku_prices_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         owner_admin_username = VALUES(owner_admin_username),
         default_pricing_abc = VALUES(default_pricing_abc),
         hide_self_serve_pay = VALUES(hide_self_serve_pay),
         enabled = VALUES(enabled),
         note = VALUES(note),
         android_apk_url = VALUES(android_apk_url),
         ios_mobileconfig_url = VALUES(ios_mobileconfig_url),
         sku_prices_json = VALUES(sku_prices_json)`,
      [
        channelId,
        owner,
        abc,
        hideSelf ? 1 : 0,
        enabled,
        note,
        androidUrl || null,
        iosUrl || null,
        pricesJson
      ]
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
    ensurePackageUrlColumns: ensurePackageUrlColumns,
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
    effectivePricingAbc: effectivePricingAbc,
    normalizePackageUrl: normalizePackageUrl,
    normalizeSkuPrices: normalizeSkuPrices,
    formatGrantLabel: formatGrantLabel,
    CHANNEL_SKU_IDS: CHANNEL_SKU_IDS
  };
}

module.exports = { createAgentChannels: createAgentChannels };
