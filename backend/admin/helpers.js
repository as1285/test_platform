'use strict';

const { ADMIN_MENU_KEYS } = require('./constants');

var jwt;
var JWT_SECRET;

function initAdminHelpers(deps) {
  jwt = deps.jwt;
  JWT_SECRET = deps.JWT_SECRET;
}

function normalizeAdminMenuList(rawMenus, isSuper) {
  if (isSuper) {
    return ADMIN_MENU_KEYS.slice();
  }
  var src = Array.isArray(rawMenus) ? rawMenus : [];
  var seen = {};
  var out = [];
  src.forEach(function (m) {
    var key = String(m || '').trim();
    if (!key || ADMIN_MENU_KEYS.indexOf(key) < 0 || seen[key]) {
      return;
    }
    seen[key] = true;
    out.push(key);
  });
  return out;
}

function signAdminToken(username) {
  return jwt.sign({ role: 'admin', sub: String(username || '') }, JWT_SECRET, { expiresIn: '12h' });
}

async function loadAdminAccountByUsername(conn, username) {
  const [rows] = await conn.execute(
    'SELECT id, username, full_name, salt, hash, is_super, banned, created_at FROM admin_accounts WHERE username = ? LIMIT 1',
    [username]
  );
  if (!rows.length) {
    return null;
  }
  var row = rows[0];
  const [menuRows] = await conn.execute(
    'SELECT menu_key FROM admin_account_menus WHERE admin_id = ? ORDER BY menu_key ASC',
    [row.id]
  );
  return {
    id: Number(row.id) || 0,
    username: String(row.username),
    full_name: row.full_name != null ? String(row.full_name) : '',
    salt: row.salt != null ? String(row.salt) : '',
    hash: row.hash != null ? String(row.hash) : '',
    is_super: row.is_super === 1 || row.is_super === true,
    banned: row.banned === 1 || row.banned === true,
    created_at: row.created_at ? row.created_at.toISOString() : '',
    menus: normalizeAdminMenuList(
      menuRows.map(function (m) {
        return m.menu_key;
      }),
      row.is_super === 1 || row.is_super === true
    )
  };
}

module.exports = {
  initAdminHelpers,
  normalizeAdminMenuList,
  signAdminToken,
  loadAdminAccountByUsername
};
