/**
 * 税务记录 + 用户注册/登录 API
 * 数据持久化：JSON 文件（Docker 中挂载 /data）
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'tax_data.json');
const USERS_FILE = process.env.USERS_FILE || path.join(__dirname, 'data', 'users.json');
const PORT = parseInt(process.env.PORT || '3000', 10);

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readData() {
  try {
    ensureDataDir();
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('readData', e);
    return {};
  }
}

function writeData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getRecords(userId, year) {
  const all = readData();
  const uid = String(userId || '');
  let list = all[uid] ? [...all[uid]] : [];
  if (year != null && year !== '') {
    const y = parseInt(year, 10);
    list = list.filter(function (r) {
      return parseInt(r.year, 10) === y;
    });
  }
  var income = 0;
  var tax = 0;
  list.forEach(function (r) {
    income += parseFloat(r.income) || 0;
    tax += parseFloat(r.tax_reported) || 0;
  });
  list.sort(function (a, b) {
    if (b.year !== a.year) return b.year - a.year;
    return (b.month || 0) - (a.month || 0);
  });
  return {
    income_total: income.toFixed(2),
    tax_total: tax.toFixed(2),
    records: list
  };
}

function saveRecord(userId, record) {
  const all = readData();
  const uid = String(userId || '');
  if (!uid) throw new Error('user_id required');
  if (!all[uid]) all[uid] = [];
  var id = record.id != null ? String(record.id) : 'tr_' + Date.now();
  var rec = Object.assign({}, record, { id: id });
  var idx = all[uid].findIndex(function (x) {
    return String(x.id) === String(id);
  });
  if (idx >= 0) {
    all[uid][idx] = rec;
  } else {
    all[uid].unshift(rec);
  }
  writeData(all);
  return { id: id };
}

function deleteRecord(userId, id) {
  const all = readData();
  const uid = String(userId || '');
  if (!all[uid]) return;
  all[uid] = all[uid].filter(function (x) {
    return String(x.id) !== String(id);
  });
  writeData(all);
}

function getTaxRecordById(userId, id) {
  const all = readData();
  const uid = String(userId || '');
  if (!uid || id == null || id === '') return null;
  const list = all[uid] || [];
  return list.find(function (x) {
    return String(x.id) === String(id);
  }) || null;
}

function formatTaxAmt(v, defaultStr) {
  if (v == null || v === '') return defaultStr;
  const n = parseFloat(String(v).replace(/,/g, ''));
  if (Number.isNaN(n)) return defaultStr;
  return n.toFixed(2);
}

/** 与前端 xiangqing.html / 原站 detail 接口字段对齐 */
function formatTaxDetailResponse(rec, userIdStr) {
  const y = rec.year != null ? parseInt(rec.year, 10) : null;
  const m = rec.month != null ? parseInt(rec.month, 10) : null;
  let taxPeriod = rec.tax_period;
  if (!taxPeriod && y != null && m != null) {
    taxPeriod = y + '-' + (m < 10 ? '0' + m : String(m));
  }
  return {
    id: rec.id,
    admin_id: 0,
    user_id: userIdStr,
    year: y,
    month: m,
    income_type: rec.income_type || '工资薪金',
    income_subtype: rec.income_subtype || '正常工资薪金',
    company_name: rec.company_name || '',
    company_tax_id: rec.company_tax_id || '',
    tax_authority: rec.tax_authority || '',
    report_channel: rec.report_channel || '其他',
    report_date: rec.report_date || '',
    tax_period: taxPeriod || '',
    income: formatTaxAmt(rec.income, '0.00'),
    tax_reported: formatTaxAmt(rec.tax_reported, '0.00'),
    income_this_period: formatTaxAmt(rec.income_this_period, '0.00'),
    tax_free_income: formatTaxAmt(rec.tax_free_income, '0.00'),
    deduction_fee: formatTaxAmt(rec.deduction_fee, '5000.00'),
    special_deduction: formatTaxAmt(rec.special_deduction, '0.00'),
    other_deduction: formatTaxAmt(rec.other_deduction, '0.00'),
    donation_deduction: formatTaxAmt(rec.donation_deduction, '0.00'),
    pension_insurance: formatTaxAmt(rec.pension_insurance, '0.00'),
    medical_insurance: formatTaxAmt(rec.medical_insurance, '0.00'),
    unemployment_insurance: formatTaxAmt(rec.unemployment_insurance, '0.00'),
    housing_fund: formatTaxAmt(rec.housing_fund, '0.00'),
    created_at: rec.created_at || '',
    updated_at: rec.updated_at || ''
  };
}

/* ---------- 用户注册/登录（密码 scrypt 存储） ---------- */

function readUsers() {
  try {
    ensureDataDir();
    if (!fs.existsSync(USERS_FILE)) return { users: {} };
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) {
    console.error('readUsers', e);
    return { users: {} };
  }
}

function writeUsers(data) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function hashPassword(password, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function validateUsername(u) {
  if (!u || typeof u !== 'string') return '账号不能为空';
  u = u.trim();
  if (u.length < 3 || u.length > 32) return '账号长度为 3～32 位';
  if (!/^[\dA-Za-z@._-]+$/.test(u)) return '账号仅支持数字、字母及 . _ - @';
  return null;
}

function validatePassword(p) {
  if (!p || typeof p !== 'string') return '密码不能为空';
  if (p.length < 6 || p.length > 64) return '密码长度为 6～64 位';
  return null;
}

function registerUser(username, password, realName) {
  var u = validateUsername(username);
  if (u) throw new Error(u);
  var p = validatePassword(password);
  if (p) throw new Error(p);
  username = username.trim();
  var store = readUsers();
  if (store.users[username]) {
    throw new Error('该账号已注册');
  }
  var saltBuf = crypto.randomBytes(16);
  var saltHex = saltBuf.toString('hex');
  var hash = crypto.scryptSync(password, saltBuf, 64).toString('hex');
  var name = (realName && String(realName).trim()) || username;
  store.users[username] = {
    salt: saltHex,
    hash: hash,
    real_name: name,
    user_id: username,
    created_at: new Date().toISOString()
  };
  writeUsers(store);
  return { user_id: username, real_name: name, username: username };
}

function loginUser(username, password) {
  var u = validateUsername(username);
  if (u) throw new Error(u);
  if (!password) throw new Error('请输入密码');
  username = username.trim();
  var store = readUsers();
  var rec = store.users[username];
  if (!rec) {
    throw new Error('账号或密码错误');
  }
  var check = hashPassword(password, rec.salt);
  if (check !== rec.hash) {
    throw new Error('账号或密码错误');
  }
  return {
    user_id: rec.user_id || username,
    real_name: rec.real_name || username,
    username: username
  };
}

/** 供 mine.html / watermark.js：GET api/user.php?action=info&user_id= */
function getUserInfoForApi(userId) {
  if (userId == null || String(userId).trim() === '') {
    return null;
  }
  var uid = String(userId).trim();
  var store = readUsers();
  var rec = store.users[uid];
  var defaults = {
    real_name: uid,
    tax_id: '620000000000000000',
    employer_count: 0,
    family_count: 0,
    bank_card_count: 0,
    gender: 1,
    watermark_enabled: false,
    employers: []
  };
  if (!rec) {
    return defaults;
  }
  return {
    real_name: rec.real_name != null ? String(rec.real_name) : uid,
    tax_id: rec.tax_id != null ? String(rec.tax_id) : defaults.tax_id,
    employer_count: rec.employer_count != null ? Number(rec.employer_count) : 0,
    family_count: rec.family_count != null ? Number(rec.family_count) : 0,
    bank_card_count: rec.bank_card_count != null ? Number(rec.bank_card_count) : 0,
    gender: rec.gender != null ? Number(rec.gender) : 1,
    watermark_enabled: Boolean(rec.watermark_enabled),
    employers: rec.employers || []
  };
}

function handleUserGet(req, res) {
  var action = req.query.action;
  if (action !== 'info' && action !== 'employers') {
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  }
  var userId = req.query.user_id;
  if (userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  try {
    var data = getUserInfoForApi(userId);
    if (!data) {
      return res.status(400).json({ code: 400, msg: 'user_id required' });
    }
    if (action === 'employers') {
      res.json({ code: 200, data: { employers: data.employers } });
    } else {
      res.json({ code: 200, data: data });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function handleUserPost(req, res) {
  var body = req.body || {};
  var action = body.action;
  var userId = body.user_id || req.query.user_id;
  
  try {
    if (action === 'add_employer') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      
      var employerData = {
        company_name: body.company_name || '',
        credit_code: body.credit_code || '',
        position: body.position || '',
        hire_date: body.hire_date || '',
        leave_date: body.leave_date || '',
        status: body.status || '1'
      };
      
      var store = readUsers();
      var uid = String(userId);
      if (!store.users[uid]) {
        store.users[uid] = {
          real_name: uid,
          tax_id: '620000000000000000',
          employer_count: 0,
          family_count: 0,
          bank_card_count: 0,
          gender: 1,
          watermark_enabled: false,
          employers: []
        };
      }
      
      if (!store.users[uid].employers) {
        store.users[uid].employers = [];
      }
      
      // 添加新的任职受雇记录
      employerData.id = 'emp_' + Date.now();
      store.users[uid].employers.push(employerData);
      
      // 更新任职受雇数量
      store.users[uid].employer_count = store.users[uid].employers.length;
      
      writeUsers(store);
      
      return res.json({ code: 200, data: { success: true, employer: employerData } });
    }
    
    if (action === 'save_profile') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        
        var store = readUsers();
        var uid = String(userId);
        if (!store.users[uid]) {
          store.users[uid] = {
            real_name: uid,
            tax_id: '620000000000000000',
            employer_count: 0,
            family_count: 0,
            bank_card_count: 0,
            gender: 1,
            watermark_enabled: false,
            employers: []
          };
        }
        
        if (body.real_name != null) {
          store.users[uid].real_name = String(body.real_name);
        }
        if (body.tax_id != null) {
          store.users[uid].tax_id = String(body.tax_id);
        }
        if (body.gender != null) {
          store.users[uid].gender = Number(body.gender);
        }
        if (body.employer_count != null) {
          store.users[uid].employer_count = Number(body.employer_count);
        }
        if (body.family_count != null) {
          store.users[uid].family_count = Number(body.family_count);
        }
        if (body.bank_card_count != null) {
          store.users[uid].bank_card_count = Number(body.bank_card_count);
        }
        
        writeUsers(store);
        
        return res.json({ code: 200, data: { success: true } });
      }
      
      if (action === 'delete_employer') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        if (!body.employer_id) {
          return res.status(400).json({ code: 400, msg: 'employer_id required' });
        }
        
        var store = readUsers();
        var uid = String(userId);
        if (!store.users[uid] || !store.users[uid].employers) {
          return res.status(404).json({ code: 404, msg: 'user or employers not found' });
        }
        
        // 过滤掉要删除的记录
        store.users[uid].employers = store.users[uid].employers.filter(emp => emp.id !== body.employer_id);
        
        // 更新任职受雇数量
        store.users[uid].employer_count = store.users[uid].employers.length;
        
        writeUsers(store);
        
        return res.json({ code: 200, data: { success: true } });
      }
      
      return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

function handleTaxGet(req, res) {
  var action = req.query.action;
  if (action === 'detail') {
    var userId = req.query.user_id;
    var rid = req.query.id;
    if (userId == null || userId === '' || rid == null || rid === '') {
      return res.status(400).json({ code: 400, msg: 'user_id and id required' });
    }
    try {
      var rec = getTaxRecordById(userId, rid);
      if (!rec) {
        return res.status(404).json({ code: 404, msg: '记录不存在' });
      }
      return res.json({
        code: 200,
        msg: '成功',
        data: formatTaxDetailResponse(rec, String(userId))
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ code: 500, msg: String(e.message) });
    }
  }
  if (action !== 'records') {
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  }
  var userId = req.query.user_id;
  if (userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  var year = req.query.year;
  try {
    var data = getRecords(userId, year);
    res.json({ code: 200, data: data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function handleTaxPost(req, res) {
  var body = req.body || {};
  var action = body.action;
  var userId = body.user_id;

  try {
    if (action === 'save_record' || action === 'add_record') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var record = body.record;
      if (!record || typeof record !== 'object') {
        return res.status(400).json({ code: 400, msg: 'record required' });
      }
      var out = saveRecord(userId, record);
      return res.json({ code: 200, data: out });
    }
    if (action === 'delete_record') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var id = body.id;
      if (id == null) {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      deleteRecord(userId, id);
      return res.json({ code: 200, data: {} });
    }
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

app.get('/api/tax.php', handleTaxGet);
app.post('/api/tax.php', handleTaxPost);
app.get('/api/user.php', handleUserGet);
app.post('/api/user.php', handleUserPost);
app.get('/user.php', handleUserGet);
app.post('/user.php', handleUserPost);

function handleAuthPost(req, res) {
  var body = req.body || {};
  var action = body.action;
  try {
    if (action === 'register') {
      var out = registerUser(body.username, body.password, body.real_name);
      return res.json({ code: 200, data: out });
    }
    if (action === 'login') {
      var out2 = loginUser(body.username, body.password);
      return res.json({ code: 200, data: out2 });
    }
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    return res.status(400).json({ code: 400, msg: e.message || String(e) });
  }
}

app.post('/api/auth.php', handleAuthPost);
app.post('/auth.php', handleAuthPost);

app.get('/health', function (req, res) {
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', function () {
  console.log('api listening on ' + PORT + ', tax: ' + DATA_FILE + ', users: ' + USERS_FILE);
});
