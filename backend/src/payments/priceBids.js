/**
 * 心理价出价（议价）：犹豫用户在支付页提交理想价。
 * ≥ 底价线自动写入 user_price_offers 立即生效；低于底价线进后台人工审。
 */
'use strict';

var SETTING_KEY_PRICE_BID = 'price_bid_config';

/** 现售三档默认自动通过线（元）；有配置时优先于目录价百分比 */
var DEFAULT_FLOOR_BY_SKU = {
  sku_300_7d: 120,
  sku_348_14d: 199,
  sku_398_30d: 298
};

var DEFAULT_BID_CONFIG = {
  enabled: true,
  /* 无按套餐金额时的回退：目录价百分比 */
  floor_pct: 60,
  /* 按套餐自动通过线（元） */
  floor_by_sku: Object.assign({}, DEFAULT_FLOOR_BY_SKU),
  /* 全局最低出价（元），低于此直接拒收 */
  min_amount: 30,
  /* 24h 内可提交次数 */
  daily_limit: 1
};

function clampInt(v, lo, hi, dft) {
  var n = parseInt(v, 10);
  if (!isFinite(n)) return dft;
  return Math.min(hi, Math.max(lo, n));
}

function clampMoney(v, dft) {
  var n = Number(v);
  if (!isFinite(n) || n <= 0) return dft;
  if (n > 99999) n = 99999;
  return Math.round(n * 100) / 100;
}

function normalizeFloorBySku(raw) {
  var src = raw && typeof raw === 'object' ? raw : {};
  var out = {};
  var keys = Object.keys(DEFAULT_FLOOR_BY_SKU);
  for (var i = 0; i < keys.length; i++) {
    var id = keys[i];
    out[id] = clampMoney(
      src[id] != null ? src[id] : DEFAULT_FLOOR_BY_SKU[id],
      DEFAULT_FLOOR_BY_SKU[id]
    );
  }
  return out;
}

function normalizeBidConfig(raw) {
  var o = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: o.enabled !== false && o.enabled !== 0 && o.enabled !== '0',
    floor_pct: clampInt(o.floor_pct, 1, 100, DEFAULT_BID_CONFIG.floor_pct),
    floor_by_sku: normalizeFloorBySku(o.floor_by_sku),
    min_amount: clampInt(o.min_amount, 1, 99999, DEFAULT_BID_CONFIG.min_amount),
    daily_limit: clampInt(o.daily_limit, 1, 10, DEFAULT_BID_CONFIG.daily_limit)
  };
}

/** 自动通过线：优先套餐固定金额，否则目录价 × floor_pct，且不低于全局最低出价 */
function resolveAutoFloor(cfg, skuId, listAmount) {
  var c = cfg || DEFAULT_BID_CONFIG;
  var id = String(skuId || '').trim();
  var bySku = c.floor_by_sku && c.floor_by_sku[id] != null ? Number(c.floor_by_sku[id]) : NaN;
  var floor;
  if (isFinite(bySku) && bySku > 0) {
    floor = bySku;
  } else {
    floor = (isFinite(listAmount) ? listAmount : 0) * ((c.floor_pct || 60) / 100);
  }
  return Math.max(c.min_amount || 0, floor);
}

function plainBidRow(row) {
  if (!row) return null;
  return {
    id: row.id != null ? Number(row.id) : 0,
    username: String(row.username || ''),
    sku_id: String(row.sku_id || ''),
    sku_label: String(row.sku_label || ''),
    list_amount: row.list_amount != null ? String(row.list_amount) : '',
    bid_amount: row.bid_amount != null ? String(row.bid_amount) : '',
    note: row.note != null ? String(row.note) : '',
    status: String(row.status || 'pending'),
    accepted_amount: row.accepted_amount != null ? String(row.accepted_amount) : '',
    auto: !!(row.auto === 1 || row.auto === true || row.auto === '1'),
    reviewed_by: row.reviewed_by != null ? String(row.reviewed_by) : '',
    reviewed_at: row.reviewed_at || null,
    created_at: row.created_at || null
  };
}

function createPriceBids(deps) {
  var pool = deps.pool;
  var normalizeAmount = deps.normalizeAmount;
  var offers = deps.offers;
  var notifyUser = typeof deps.notifyUser === 'function' ? deps.notifyUser : null;
  var tableReady = false;

  async function ensureTable() {
    if (tableReady) return;
    await pool.execute(
      'CREATE TABLE IF NOT EXISTS user_price_bids (' +
        'id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,' +
        "username VARCHAR(255) NOT NULL COMMENT '出价账号'," +
        "sku_id VARCHAR(64) NOT NULL COMMENT '目标套餐'," +
        "sku_label VARCHAR(64) DEFAULT NULL COMMENT '套餐名快照'," +
        "list_amount DECIMAL(10,2) DEFAULT NULL COMMENT '出价时目录价'," +
        "bid_amount DECIMAL(10,2) NOT NULL COMMENT '用户心理价'," +
        "note VARCHAR(255) DEFAULT NULL COMMENT '用户留言'," +
        "status VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending/accepted/rejected'," +
        "accepted_amount DECIMAL(10,2) DEFAULT NULL COMMENT '成交价'," +
        "auto TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=自动通过'," +
        'reviewed_by VARCHAR(64) DEFAULT NULL,' +
        'reviewed_at DATETIME DEFAULT NULL,' +
        'created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,' +
        'updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,' +
        'KEY idx_upb_status_created (status, created_at),' +
        'KEY idx_upb_user (username)' +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付页心理价出价'"
    );
    tableReady = true;
  }

  async function loadConfig() {
    try {
      const [rows] = await pool.execute(
        'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
        [SETTING_KEY_PRICE_BID]
      );
      if (!rows.length || !rows[0].setting_value) return normalizeBidConfig(null);
      return normalizeBidConfig(JSON.parse(String(rows[0].setting_value)));
    } catch (e) {
      return normalizeBidConfig(null);
    }
  }

  async function saveConfig(raw) {
    var cfg = normalizeBidConfig(raw);
    await pool.execute(
      'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ' +
        'ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP',
      [SETTING_KEY_PRICE_BID, JSON.stringify(cfg)]
    );
    return cfg;
  }

  /** 出价目标套餐：优先用户指定，否则取现售最便宜档 */
  async function resolveTargetSku(skuId) {
    var skus = await offers.listOfferableSkusLive();
    if (!skus || !skus.length) return null;
    var id = String(skuId || '').trim();
    if (id) {
      for (var i = 0; i < skus.length; i++) {
        if (skus[i].id === id) return skus[i];
      }
    }
    var best = skus[0];
    for (var j = 1; j < skus.length; j++) {
      if (Number(skus[j].amount) < Number(best.amount)) best = skus[j];
    }
    return best;
  }

  async function getLatestBid(username) {
    await ensureTable();
    var u = String(username || '').trim();
    if (!u) return null;
    const [rows] = await pool.execute(
      'SELECT * FROM user_price_bids WHERE username = ? ORDER BY id DESC LIMIT 1',
      [u]
    );
    return rows.length ? plainBidRow(rows[0]) : null;
  }

  /**
   * 返回拦截出价：注册 48h 内且多次进入支付页。
   * visit_count 统计 track_purchase_page_view（含本页已上报的）。
   */
  async function getBackPromptContext(username) {
    var u = String(username || '').trim();
    var out = {
      within_48h: false,
      hours_since_register: null,
      visit_count: 0,
      eligible: false,
      registered_at: null
    };
    if (!u) return out;
    try {
      const [urows] = await pool.execute(
        'SELECT created_at FROM users WHERE username = ? LIMIT 1',
        [u]
      );
      if (!urows.length || !urows[0].created_at) return out;
      var created = new Date(urows[0].created_at);
      if (isNaN(created.getTime())) return out;
      out.registered_at = created.toISOString();
      var hours = (Date.now() - created.getTime()) / 3600000;
      out.hours_since_register = Math.round(hours * 10) / 10;
      out.within_48h = hours >= 0 && hours < 48;
    } catch (eUser) {
      return out;
    }
    try {
      const [vrows] = await pool.execute(
        `SELECT COUNT(*) AS n FROM user_page_events
         WHERE username = ?
           AND route_key LIKE '%track_purchase_page_view%'`,
        [u]
      );
      out.visit_count = vrows[0] && vrows[0].n != null ? Number(vrows[0].n) || 0 : 0;
    } catch (eVis) {
      out.visit_count = 0;
    }
    out.eligible = !!(out.within_48h && out.visit_count >= 2);
    return out;
  }

  async function acceptToOffer(bid, amount, reviewer, isAuto) {
    var label = (bid.sku_label ? String(bid.sku_label) : '') + '·心理价特惠';
    await offers.upsertOffer(
      bid.username,
      {
        sku_id: bid.sku_id,
        amount: amount,
        label: label.slice(0, 64),
        note: ('心理价#' + bid.id + (isAuto ? ' 自动通过' : ' 人工通过')).slice(0, 255)
      },
      reviewer
    );
    await pool.execute(
      'UPDATE user_price_bids SET status = ?, accepted_amount = ?, auto = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      ['accepted', amount, isAuto ? 1 : 0, reviewer, bid.id]
    );
    if (notifyUser) {
      try {
        var notifyOut = await notifyUser(
          bid.username,
          '你的心理价已通过',
          '你提交的「' +
            (bid.sku_label || '开通套餐') +
            '」心理价 ¥' +
            amount +
            ' 已通过，现在购买页已按该价格生效，随时可开通。',
          'purchase.html?from=price_bid'
        );
        return notifyOut && typeof notifyOut === 'object' ? notifyOut : { email_sent: false };
      } catch (eMsg) {
        /* 消息失败不阻塞放价 */
        return { email_sent: false, reason: 'notify_error' };
      }
    }
    return { email_sent: false, reason: 'no_notify' };
  }

  /**
   * 提交心理价。
   * 返回 { status: 'accepted'|'pending', accepted_amount?, floor_hint? }
   */
  async function submitBid(username, input) {
    await ensureTable();
    var u = String(username || '').trim();
    if (!u) {
      var e0 = new Error('请先登录');
      e0.statusCode = 401;
      throw e0;
    }
    var cfg = await loadConfig();
    if (!cfg.enabled) {
      var e1 = new Error('当前暂未开放出价');
      e1.statusCode = 403;
      throw e1;
    }
    var sku = await resolveTargetSku(input && input.sku_id);
    if (!sku) {
      var e2 = new Error('暂无可出价的套餐');
      e2.statusCode = 400;
      throw e2;
    }
    var amount = normalizeAmount(input && input.amount);
    var num = Number(amount);
    if (!amount || !isFinite(num) || num <= 0) {
      var e3 = new Error('请填写有效价格');
      e3.statusCode = 400;
      throw e3;
    }
    if (num < cfg.min_amount) {
      var e4 = new Error('出价不能低于 ' + cfg.min_amount + ' 元');
      e4.statusCode = 400;
      e4.floor_hint = String(cfg.min_amount);
      throw e4;
    }
    var listAmount = Number(sku.amount);
    if (isFinite(listAmount) && num >= listAmount) {
      var e5 = new Error('出价已不低于现价 ¥' + sku.amount + '，直接购买即可');
      e5.statusCode = 400;
      throw e5;
    }
    /* 已有待审出价：允许改价重提（更新原记录，不占新的每日次数） */
    const [pendingRows] = await pool.execute(
      "SELECT * FROM user_price_bids WHERE username = ? AND status = 'pending' ORDER BY id DESC LIMIT 1",
      [u]
    );
    var note = input && input.note != null ? String(input.note).trim().slice(0, 255) : '';
    var floor = resolveAutoFloor(cfg, sku.id, listAmount);
    if (pendingRows.length) {
      var pending = plainBidRow(pendingRows[0]);
      await pool.execute(
        'UPDATE user_price_bids SET sku_id = ?, sku_label = ?, list_amount = ?, bid_amount = ?, note = ? WHERE id = ? AND status = \'pending\'',
        [
          sku.id,
          sku.label || null,
          isFinite(listAmount) ? sku.amount : null,
          amount,
          note || null,
          pending.id
        ]
      );
      var updatedBid = {
        id: pending.id,
        username: u,
        sku_id: sku.id,
        sku_label: sku.label || '',
        bid_amount: amount
      };
      if (isFinite(listAmount) && num >= floor) {
        await acceptToOffer(updatedBid, amount, 'price-bid-auto', true);
        return {
          status: 'accepted',
          accepted_amount: amount,
          sku_label: sku.label || '',
          updated: true
        };
      }
      return {
        status: 'pending',
        sku_label: sku.label || '',
        floor_hint: String(Math.round(floor)),
        updated: true,
        bid_amount: amount
      };
    }
    const [recent] = await pool.execute(
      'SELECT COUNT(*) AS n FROM user_price_bids WHERE username = ? AND created_at >= NOW() - INTERVAL 1 DAY',
      [u]
    );
    if (recent[0].n >= cfg.daily_limit) {
      var e7 = new Error('今天的出价次数已用完，明天再来吧');
      e7.statusCode = 429;
      throw e7;
    }
    const [ins] = await pool.execute(
      'INSERT INTO user_price_bids (username, sku_id, sku_label, list_amount, bid_amount, note) VALUES (?, ?, ?, ?, ?, ?)',
      [u, sku.id, sku.label || null, isFinite(listAmount) ? sku.amount : null, amount, note || null]
    );
    var bid = {
      id: ins.insertId,
      username: u,
      sku_id: sku.id,
      sku_label: sku.label || '',
      bid_amount: amount
    };
    if (isFinite(listAmount) && num >= floor) {
      await acceptToOffer(bid, amount, 'price-bid-auto', true);
      return { status: 'accepted', accepted_amount: amount, sku_label: sku.label || '', updated: false };
    }
    return {
      status: 'pending',
      sku_label: sku.label || '',
      floor_hint: String(Math.round(floor)),
      updated: false,
      bid_amount: amount
    };
  }

  async function listBids(opts) {
    await ensureTable();
    var status = String((opts && opts.status) || 'pending').trim();
    var allowed = { pending: 1, accepted: 1, rejected: 1, all: 1 };
    if (!allowed[status]) status = 'pending';
    var limit = clampInt(opts && opts.limit, 1, 500, 200);
    var rows;
    if (status === 'all') {
      [rows] = await pool.execute(
        'SELECT * FROM user_price_bids ORDER BY id DESC LIMIT ' + limit
      );
    } else {
      [rows] = await pool.execute(
        'SELECT * FROM user_price_bids WHERE status = ? ORDER BY id DESC LIMIT ' + limit,
        [status]
      );
    }
    const [cnt] = await pool.execute(
      "SELECT SUM(status='pending') AS pending, SUM(status='accepted') AS accepted, SUM(status='rejected') AS rejected FROM user_price_bids"
    );
    return {
      items: rows.map(plainBidRow),
      counts: {
        pending: Number(cnt[0].pending || 0),
        accepted: Number(cnt[0].accepted || 0),
        rejected: Number(cnt[0].rejected || 0)
      }
    };
  }

  /** 人工审核：accept 可带 counter 价（默认按用户出价成交），reject 驳回 */
  async function reviewBid(opts) {
    await ensureTable();
    var id = parseInt(opts && opts.id, 10);
    var action = String((opts && opts.action) || '').trim();
    var admin = String((opts && opts.admin) || 'admin').trim().slice(0, 64);
    if (!id || (action !== 'accept' && action !== 'reject')) {
      var e0 = new Error('参数不完整');
      e0.statusCode = 400;
      throw e0;
    }
    const [rows] = await pool.execute('SELECT * FROM user_price_bids WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      var e1 = new Error('出价不存在');
      e1.statusCode = 404;
      throw e1;
    }
    var bid = plainBidRow(rows[0]);
    if (bid.status !== 'pending') {
      var e2 = new Error('该出价已处理（' + bid.status + '）');
      e2.statusCode = 409;
      throw e2;
    }
    if (action === 'accept') {
      var amount = normalizeAmount(
        opts && opts.amount != null && String(opts.amount).trim() !== ''
          ? opts.amount
          : bid.bid_amount
      );
      if (!amount || !isFinite(Number(amount)) || Number(amount) <= 0) {
        var e3 = new Error('成交价无效');
        e3.statusCode = 400;
        throw e3;
      }
      var acceptNotify = await acceptToOffer(bid, amount, admin, false);
      return {
        id: id,
        status: 'accepted',
        accepted_amount: amount,
        email_sent: !!(acceptNotify && acceptNotify.email_sent),
        email_reason: (acceptNotify && acceptNotify.reason) || ''
      };
    }
    await pool.execute(
      "UPDATE user_price_bids SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
      [admin, id]
    );
    var rejectEmailSent = false;
    var rejectEmailReason = '';
    if (notifyUser) {
      try {
        var rejectNotify = await notifyUser(
          bid.username,
          '关于你提交的心理价',
          '你提交的「' +
            (bid.sku_label || '开通套餐') +
            '」心理价 ¥' +
            bid.bid_amount +
            ' 与当前价差距较大，这次没有通过。现价开通即可使用全部功能。',
          'purchase.html?from=price_bid'
        );
        rejectEmailSent = !!(rejectNotify && rejectNotify.email_sent);
        rejectEmailReason = (rejectNotify && rejectNotify.reason) || '';
      } catch (eMsg) {}
    }
    return {
      id: id,
      status: 'rejected',
      email_sent: rejectEmailSent,
      email_reason: rejectEmailReason
    };
  }

  return {
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    submitBid: submitBid,
    getLatestBid: getLatestBid,
    getBackPromptContext: getBackPromptContext,
    listBids: listBids,
    reviewBid: reviewBid
  };
}

module.exports = {
  createPriceBids: createPriceBids,
  normalizeBidConfig: normalizeBidConfig,
  resolveAutoFloor: resolveAutoFloor,
  DEFAULT_BID_CONFIG: DEFAULT_BID_CONFIG,
  DEFAULT_FLOOR_BY_SKU: DEFAULT_FLOOR_BY_SKU
};
