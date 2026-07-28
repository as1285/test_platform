/**
 * 运营备数导入（P0）：Excel/CSV → 建用户 / 写个税 / 直接开通。
 * 标准模板：按年份分块，每月一行（税前收入 / 社保公积金 / 其他扣除 / 扣税 / 公司名称）。
 * 亦兼容旧版扁平行列表。
 * 冲突策略：覆盖（同用户名覆盖资料与密码；同用户+年月覆盖未删除个税）。
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const { getPool } = require('../shared/db');

var MAX_ROWS = 2000;
var TEMPLATE_ASSET = path.join(__dirname, '../../assets/user_prep_import_template.xlsx');

/** 块模板底部资料区标签（A 列标签 → B 列值） */
var PROFILE_LABEL_MAP = {
  用户名: 'username',
  账号: 'username',
  username: 'username',
  密码: 'password',
  password: 'password',
  姓名: 'real_name',
  真实姓名: 'real_name',
  real_name: 'real_name',
  证件号: 'tax_id',
  身份证号: 'tax_id',
  证件号码: 'tax_id',
  tax_id: 'tax_id',
  性别: 'gender',
  gender: 'gender',
  开通天数: 'grant_days',
  有效天数: 'grant_days',
  grant_days: 'grant_days'
};

/** Excel/CSV 上传（内存，不走图片白名单） */
var prepUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    var name = String((file && file.originalname) || '').toLowerCase();
    var ok =
      /\.xlsx?$/.test(name) ||
      /\.csv$/.test(name) ||
      /\.xls$/.test(name) ||
      (file &&
        /spreadsheet|excel|csv|octet-stream/i.test(String(file.mimetype || '')));
    cb(ok ? null : new Error('仅支持 .xlsx / .xls / .csv'), ok);
  }
});

/** 扁平行表头别名 → 规范字段 */
var HEADER_MAP = {
  用户名: 'username',
  账号: 'username',
  username: 'username',
  密码: 'password',
  password: 'password',
  姓名: 'real_name',
  真实姓名: 'real_name',
  real_name: 'real_name',
  证件号: 'tax_id',
  身份证号: 'tax_id',
  证件号码: 'tax_id',
  tax_id: 'tax_id',
  性别: 'gender',
  gender: 'gender',
  开通天数: 'grant_days',
  有效天数: 'grant_days',
  grant_days: 'grant_days',
  年: 'year',
  年份: 'year',
  year: 'year',
  月: 'month',
  月份: 'month',
  month: 'month',
  扣缴单位: 'company_name',
  单位名称: 'company_name',
  公司名称: 'company_name',
  company_name: 'company_name',
  单位税号: 'company_tax_id',
  税号: 'company_tax_id',
  company_tax_id: 'company_tax_id',
  收入: 'income',
  税前收入: 'income',
  应税收入: 'income',
  income: 'income',
  已申报税额: 'tax_reported',
  税额: 'tax_reported',
  扣税: 'tax_reported',
  tax_reported: 'tax_reported',
  本期收入: 'income_this_period',
  income_this_period: 'income_this_period',
  免税收入: 'tax_free_income',
  tax_free_income: 'tax_free_income',
  减除费用: 'deduction_fee',
  deduction_fee: 'deduction_fee',
  专项扣除: 'special_deduction',
  社保公积金扣费: 'special_deduction',
  special_deduction: 'special_deduction',
  其他扣除: 'other_deduction',
  other_deduction: 'other_deduction',
  捐赠扣除: 'donation_deduction',
  donation_deduction: 'donation_deduction',
  养老保险: 'pension_insurance',
  pension_insurance: 'pension_insurance',
  医疗保险: 'medical_insurance',
  medical_insurance: 'medical_insurance',
  失业保险: 'unemployment_insurance',
  unemployment_insurance: 'unemployment_insurance',
  住房公积金: 'housing_fund',
  公积金: 'housing_fund',
  housing_fund: 'housing_fund',
  所得项目: 'income_type',
  income_type: 'income_type',
  所得细分: 'income_subtype',
  income_subtype: 'income_subtype',
  主管税务机关: 'tax_authority',
  tax_authority: 'tax_authority',
  申报渠道: 'report_channel',
  report_channel: 'report_channel',
  申报日期: 'report_date',
  report_date: 'report_date',
  税款所属期: 'tax_period',
  tax_period: 'tax_period'
};

var TEMPLATE_HEADERS = [
  '用户名',
  '密码',
  '姓名',
  '证件号',
  '性别',
  '开通天数',
  '年',
  '月',
  '扣缴单位',
  '单位税号',
  '收入',
  '已申报税额',
  '本期收入',
  '专项扣除',
  '养老保险',
  '医疗保险',
  '失业保险',
  '住房公积金'
];

var SAMPLE_ROW = [
  'demo001',
  'Pass1234',
  '张三',
  '330106199001011234',
  '男',
  '',
  2025,
  1,
  '示例科技有限公司',
  '91330100MA2XXXXX1A',
  12000,
  120,
  12000,
  0,
  960,
  240,
  60,
  1440
];

function hashPasswordWithSalt(password, saltBuf) {
  return crypto.scryptSync(password, saltBuf, 64).toString('hex');
}

function cellStr(v) {
  if (v == null) return '';
  if (typeof v === 'number' && isFinite(v)) {
    if (Math.abs(v) >= 1e15) return String(v);
    if (Number.isInteger(v)) return String(v);
    return String(v);
  }
  return String(v).trim();
}

function parseMoney(v, fallback) {
  if (v == null || v === '') return fallback;
  var s = cellStr(v).replace(/,/g, '').replace(/￥/g, '').replace(/元/g, '');
  if (s === '') return fallback;
  var n = Number(s);
  return isFinite(n) ? n : fallback;
}

function hasMoneyValue(v) {
  if (v == null || v === '') return false;
  var n = parseMoney(v, null);
  return n != null && n !== 0;
}

function parseGender(v) {
  var s = cellStr(v);
  if (!s) return 1;
  if (s === '2' || s === '女' || s.toLowerCase() === 'f' || s.toLowerCase() === 'female') return 2;
  if (s === '1' || s === '男' || s.toLowerCase() === 'm' || s.toLowerCase() === 'male') return 1;
  return 1;
}

function parseGrantDays(v) {
  var s = cellStr(v);
  if (!s) return null;
  var n = parseInt(s, 10);
  if (!isFinite(n) || n <= 0) return null;
  return n;
}

function normalizeHeader(h) {
  var key = cellStr(h).replace(/^\uFEFF/, '');
  return HEADER_MAP[key] || null;
}

function validateUsername(username) {
  var u = cellStr(username);
  if (!u) return '用户名不能为空';
  if (u.length < 3 || u.length > 64) return '用户名长度需 3–64';
  if (!/^[A-Za-z0-9_\u4e00-\u9fa5.-]+$/.test(u)) return '用户名含非法字符';
  return '';
}

function validatePassword(password, required) {
  var p = cellStr(password);
  if (!p) return required ? '新建账号必须填写密码' : '';
  if (p.length < 4 || p.length > 64) return '密码长度需 4–64';
  return '';
}

function matrixRowHasYearBlock(line) {
  var a = cellStr(line[0]);
  return /^\d{4}年$/.test(a);
}

function isBlockFormatMatrix(matrix) {
  if (!matrix || !matrix.length) return false;
  var i;
  for (i = 0; i < matrix.length; i++) {
    if (matrixRowHasYearBlock(matrix[i] || [])) return true;
  }
  return false;
}

/** 从 buffer 解析全部工作表 */
function workbookToSheets(buf) {
  var wb = XLSX.read(buf, { type: 'buffer', cellDates: true, raw: false });
  var out = [];
  (wb.SheetNames || []).forEach(function (name) {
    var sheet = wb.Sheets[name];
    if (!sheet) return;
    out.push({
      name: name,
      matrix: XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
    });
  });
  return out;
}

/** 从 buffer/path 解析为二维表（首 sheet，兼容旧逻辑） */
function sheetToMatrix(buf) {
  var sheets = workbookToSheets(buf);
  return sheets.length ? sheets[0].matrix : [];
}

function parseProfileFromBlockMatrix(matrix) {
  var profile = {};
  var i;
  for (i = 0; i < matrix.length; i++) {
    var line = matrix[i] || [];
    var label = cellStr(line[0]).replace(/^\uFEFF/, '');
    var field = PROFILE_LABEL_MAP[label];
    if (!field) continue;
    profile[field] = line[1];
  }
  return profile;
}

function monthRowHasData(line) {
  return (
    hasMoneyValue(line[1]) ||
    hasMoneyValue(line[2]) ||
    hasMoneyValue(line[3]) ||
    hasMoneyValue(line[4]) ||
    cellStr(line[6]) !== ''
  );
}

/** 0727 块模板：按年份 + 每月一行展开为扁平行 */
function blockMatrixToRows(matrix, sheetName, sheetIndex) {
  var profile = parseProfileFromBlockMatrix(matrix);
  var username = cellStr(profile.username);
  var currentYear = null;
  var monthMap = {};
  var taxRows = [];
  var i;
  var lineNoBase = sheetIndex * 10000;

  for (i = 0; i < matrix.length; i++) {
    var line = matrix[i] || [];
    var colA = cellStr(line[0]);
    if (!colA) continue;

    var yearMatch = /^(\d{4})年$/.exec(colA);
    if (yearMatch) {
      currentYear = parseInt(yearMatch[1], 10);
      continue;
    }

    var monthMatch = /^(\d{1,2})月$/.exec(colA);
    if (monthMatch && currentYear) {
      if (!monthRowHasData(line)) continue;
      var month = parseInt(monthMatch[1], 10);
      if (month < 1 || month > 12) continue;
      var key = currentYear + '-' + month;
      monthMap[key] = {
        _line: i + 1,
        username: username,
        password: profile.password,
        real_name: profile.real_name,
        tax_id: profile.tax_id,
        gender: profile.gender,
        grant_days: profile.grant_days,
        year: currentYear,
        month: month,
        income: line[1],
        special_deduction: line[2],
        other_deduction: line[3],
        tax_reported: line[4],
        company_name: line[6]
      };
      continue;
    }
  }

  Object.keys(monthMap).forEach(function (k) {
    taxRows.push(monthMap[k]);
  });
  taxRows.sort(function (a, b) {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  if (!taxRows.length && !username && !cellStr(profile.real_name)) {
    return { error: '', rows: [], skip: true };
  }

  if (!username) {
    return {
      error:
        '工作表「' +
        sheetName +
        '」缺少「用户名」（请在底部资料区 A 列填写「用户名」、B 列填账号）',
      rows: []
    };
  }

  if (!taxRows.length) {
    taxRows.push({
      _line: lineNoBase + 1,
      username: username,
      password: profile.password,
      real_name: profile.real_name,
      tax_id: profile.tax_id,
      gender: profile.gender,
      grant_days: profile.grant_days
    });
  } else {
    taxRows.forEach(function (row, idx) {
      row._line = lineNoBase + (row._line || idx + 1);
      if (!cellStr(row.real_name) && profile.real_name) row.real_name = profile.real_name;
      if (!cellStr(row.password) && profile.password) row.password = profile.password;
      if (!cellStr(row.tax_id) && profile.tax_id) row.tax_id = profile.tax_id;
      if (row.gender == null && profile.gender != null) row.gender = profile.gender;
      if (row.grant_days == null && profile.grant_days != null) row.grant_days = profile.grant_days;
    });
  }

  return { error: '', rows: taxRows, skip: false };
}

function matrixToFlatRows(matrix) {
  if (!matrix || !matrix.length) {
    return { error: '文件为空', rows: [] };
  }
  var headerLine = matrix[0] || [];
  var fields = [];
  var i;
  for (i = 0; i < headerLine.length; i++) {
    fields.push(normalizeHeader(headerLine[i]));
  }
  if (fields.indexOf('username') < 0) {
    return { error: '缺少「用户名」列', rows: [] };
  }
  var rows = [];
  for (i = 1; i < matrix.length; i++) {
    var line = matrix[i] || [];
    var allEmpty = true;
    var j;
    for (j = 0; j < line.length; j++) {
      if (cellStr(line[j]) !== '') {
        allEmpty = false;
        break;
      }
    }
    if (allEmpty) continue;
    var obj = { _line: i + 1 };
    for (j = 0; j < fields.length; j++) {
      if (!fields[j]) continue;
      obj[fields[j]] = line[j];
    }
    rows.push(obj);
  }
  if (rows.length > MAX_ROWS) {
    return { error: '单次最多 ' + MAX_ROWS + ' 行数据', rows: [] };
  }
  return { error: '', rows: rows };
}

function bufferToImportRows(buf) {
  var sheets = workbookToSheets(buf);
  if (!sheets.length) {
    return { error: '文件为空', rows: [] };
  }

  if (isBlockFormatMatrix(sheets[0].matrix)) {
    var allRows = [];
    var seenUser = {};
    var si;
    for (si = 0; si < sheets.length; si++) {
      var sh = sheets[si];
      if (!isBlockFormatMatrix(sh.matrix)) continue;
      var parsed = blockMatrixToRows(sh.matrix, sh.name, si + 1);
      if (parsed.error) return { error: parsed.error, rows: [] };
      if (parsed.skip) continue;
      var uname = cellStr((parsed.rows[0] && parsed.rows[0].username) || '');
      if (uname && seenUser[uname]) continue;
      if (uname) seenUser[uname] = 1;
      allRows = allRows.concat(parsed.rows);
    }
    if (!allRows.length) {
      return { error: '未解析到有效数据（请填写用户名与至少一条月度收入）', rows: [] };
    }
    if (allRows.length > MAX_ROWS) {
      return { error: '单次最多 ' + MAX_ROWS + ' 行数据', rows: [] };
    }
    return { error: '', rows: allRows, format: 'block' };
  }

  if (sheets.length > 1) {
    return { error: '扁平行模板仅支持单工作表', rows: [] };
  }
  var flat = matrixToFlatRows(sheets[0].matrix);
  flat.format = 'flat';
  return flat;
}

function matrixToRows(matrix) {
  return bufferToImportRows(
    XLSX.write(
      {
        SheetNames: ['s'],
        Sheets: { s: XLSX.utils.aoa_to_sheet(matrix) }
      },
      { type: 'buffer', bookType: 'xlsx' }
    )
  );
}

function normalizeImportRow(raw) {
  var username = cellStr(raw.username);
  var password = cellStr(raw.password);
  var year = parseInt(cellStr(raw.year), 10);
  var month = parseInt(cellStr(raw.month), 10);
  var income = parseMoney(raw.income, null);
  var err = validateUsername(username);
  if (err) return { error: err };

  var hasTax = !!(year && month);
  if (hasTax) {
    if (!year || year < 2000 || year > 2100) return { error: '年份不合法' };
    if (!month || month < 1 || month > 12) return { error: '月份不合法' };
  }

  var incomeVal = income != null ? income : 0;
  var incomeThis =
    raw.income_this_period != null && cellStr(raw.income_this_period) !== ''
      ? parseMoney(raw.income_this_period, incomeVal)
      : incomeVal;
  var specialDed =
    raw.special_deduction != null && cellStr(raw.special_deduction) !== ''
      ? parseMoney(raw.special_deduction, 0)
      : 0;

  return {
    error: '',
    username: username,
    password: password,
    real_name: cellStr(raw.real_name) || username,
    tax_id: cellStr(raw.tax_id),
    gender: parseGender(raw.gender),
    grant_days: parseGrantDays(raw.grant_days),
    tax: hasTax
      ? {
          year: year,
          month: month,
          company_name: cellStr(raw.company_name),
          company_tax_id: cellStr(raw.company_tax_id),
          income: incomeVal,
          tax_reported: parseMoney(raw.tax_reported, 0),
          income_this_period: incomeThis,
          tax_free_income: parseMoney(raw.tax_free_income, 0),
          deduction_fee: parseMoney(raw.deduction_fee, 5000),
          special_deduction: specialDed,
          other_deduction: parseMoney(raw.other_deduction, 0),
          donation_deduction: parseMoney(raw.donation_deduction, 0),
          pension_insurance: parseMoney(raw.pension_insurance, 0),
          medical_insurance: parseMoney(raw.medical_insurance, 0),
          unemployment_insurance: parseMoney(raw.unemployment_insurance, 0),
          housing_fund: parseMoney(raw.housing_fund, 0),
          income_type: cellStr(raw.income_type) || '工资薪金',
          income_subtype: cellStr(raw.income_subtype) || '正常工资薪金',
          tax_authority: cellStr(raw.tax_authority),
          report_channel: cellStr(raw.report_channel) || '其他',
          report_date: cellStr(raw.report_date),
          tax_period:
            cellStr(raw.tax_period) ||
            year + '-' + String(month).padStart(2, '0')
        }
      : null
  };
}

async function upsertUser(conn, row) {
  const [existing] = await conn.execute(
    'SELECT username, salt, hash FROM users WHERE username = ? LIMIT 1',
    [row.username]
  );
  var created = !existing.length;
  var pwdErr = validatePassword(row.password, created);
  if (pwdErr) throw new Error(pwdErr);

  var grantDays = row.grant_days;
  var activationKind = grantDays ? 'trial' : 'permanent';
  var activeUntil = null;
  if (grantDays) {
    activeUntil = new Date(Date.now() + grantDays * 24 * 60 * 60 * 1000);
  }

  if (created) {
    var saltBuf = crypto.randomBytes(16);
    var saltHex = saltBuf.toString('hex');
    var hash = hashPasswordWithSalt(row.password, saltBuf);
    await conn.execute(
      `INSERT INTO users (
         username, salt, hash, real_name, tax_id, gender,
         account_active, banned, user_type, plain_password,
         activation_kind, active_until, register_source_channel
       ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?, ?, 'prep_import')`,
      [
        row.username,
        saltHex,
        hash,
        row.real_name,
        row.tax_id || null,
        row.gender,
        row.password,
        activationKind,
        activeUntil
      ]
    );
    return { created: true, overwritten: false };
  }

  var sets = [
    'real_name = ?',
    'tax_id = ?',
    'gender = ?',
    'account_active = 1',
    'banned = 0',
    'activation_kind = ?',
    'active_until = ?'
  ];
  var params = [row.real_name, row.tax_id || null, row.gender, activationKind, activeUntil];
  if (row.password) {
    var saltBuf2 = crypto.randomBytes(16);
    sets.push('salt = ?', 'hash = ?', 'plain_password = ?');
    params.push(saltBuf2.toString('hex'), hashPasswordWithSalt(row.password, saltBuf2), row.password);
  }
  params.push(row.username);
  await conn.execute('UPDATE users SET ' + sets.join(', ') + ' WHERE username = ?', params);
  return { created: false, overwritten: true };
}

async function upsertTax(conn, username, tax) {
  if (!tax) return { written: false, overwritten: false };
  const [rows] = await conn.execute(
    `SELECT id FROM tax_records
     WHERE user_id = ? AND year = ? AND month = ? AND deleted_at IS NULL
     ORDER BY updated_at DESC, id DESC LIMIT 1`,
    [username, tax.year, tax.month]
  );
  var period = tax.tax_period || tax.year + '-' + String(tax.month).padStart(2, '0');
  if (rows.length) {
    var id = rows[0].id;
    await conn.execute(
      `UPDATE tax_records SET
         income_type = ?, income_subtype = ?,
         company_name = ?, company_tax_id = ?, tax_authority = ?,
         report_channel = ?, report_date = ?, tax_period = ?,
         income = ?, tax_reported = ?, income_this_period = ?,
         tax_free_income = ?, deduction_fee = ?, special_deduction = ?,
         other_deduction = ?, donation_deduction = ?,
         pension_insurance = ?, medical_insurance = ?,
         unemployment_insurance = ?, housing_fund = ?,
         deleted_at = NULL, updated_at = NOW(3)
       WHERE id = ? AND user_id = ?`,
      [
        tax.income_type,
        tax.income_subtype,
        tax.company_name,
        tax.company_tax_id,
        tax.tax_authority,
        tax.report_channel,
        tax.report_date,
        period,
        tax.income,
        tax.tax_reported,
        tax.income_this_period,
        tax.tax_free_income,
        tax.deduction_fee,
        tax.special_deduction,
        tax.other_deduction,
        tax.donation_deduction,
        tax.pension_insurance,
        tax.medical_insurance,
        tax.unemployment_insurance,
        tax.housing_fund,
        id,
        username
      ]
    );
    return { written: true, overwritten: true, id: id };
  }
  var newId = 'tr_' + crypto.randomBytes(12).toString('hex');
  await conn.execute(
    `INSERT INTO tax_records (
       id, user_id, year, month, income_type, income_subtype,
       company_name, company_tax_id, tax_authority,
       report_channel, report_date, tax_period,
       income, tax_reported, income_this_period,
       tax_free_income, deduction_fee, special_deduction,
       other_deduction, donation_deduction,
       pension_insurance, medical_insurance,
       unemployment_insurance, housing_fund
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      username,
      tax.year,
      tax.month,
      tax.income_type,
      tax.income_subtype,
      tax.company_name,
      tax.company_tax_id,
      tax.tax_authority,
      tax.report_channel,
      tax.report_date,
      period,
      tax.income,
      tax.tax_reported,
      tax.income_this_period,
      tax.tax_free_income,
      tax.deduction_fee,
      tax.special_deduction,
      tax.other_deduction,
      tax.donation_deduction,
      tax.pension_insurance,
      tax.medical_insurance,
      tax.unemployment_insurance,
      tax.housing_fund
    ]
  );
  return { written: true, overwritten: false, id: newId };
}

function buildLegacyFlatTemplateBuffer() {
  var ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, SAMPLE_ROW]);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '备数导入');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function buildTemplateBuffer() {
  try {
    if (fs.existsSync(TEMPLATE_ASSET)) {
      return fs.readFileSync(TEMPLATE_ASSET);
    }
  } catch (eAsset) {
    console.error('[user-prep] template asset', eAsset);
  }
  return buildLegacyFlatTemplateBuffer();
}

async function handleAdminUserPrepTemplate(req, res) {
  try {
    var buf = buildTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="user_prep_import_template.xlsx"'
    );
    return res.status(200).end(buf);
  } catch (e) {
    console.error('[user-prep] template', e);
    return res.status(500).json({ code: 500, msg: '模板生成失败' });
  }
}

async function handleAdminUserPrepPreview(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ code: 400, msg: '请上传 Excel/CSV 文件' });
    }
    var parsed = bufferToImportRows(req.file.buffer);
    if (parsed.error) {
      return res.status(400).json({ code: 400, msg: parsed.error });
    }
    var preview = [];
    var errors = [];
    var users = {};
    var i;
    for (i = 0; i < parsed.rows.length; i++) {
      var n = normalizeImportRow(parsed.rows[i]);
      if (n.error) {
        errors.push({ line: parsed.rows[i]._line, msg: n.error });
        continue;
      }
      users[n.username] = 1;
      preview.push({
        line: parsed.rows[i]._line,
        username: n.username,
        real_name: n.real_name,
        tax_id: n.tax_id,
        gender: n.gender === 2 ? '女' : '男',
        grant_days: n.grant_days == null ? '永久' : n.grant_days,
        year: n.tax ? n.tax.year : '',
        month: n.tax ? n.tax.month : '',
        company_name: n.tax ? n.tax.company_name : '',
        income: n.tax ? n.tax.income : '',
        special_deduction: n.tax ? n.tax.special_deduction : ''
      });
    }
    return res.json({
      code: 200,
      data: {
        conflict_policy: 'overwrite',
        format: parsed.format || 'flat',
        row_count: parsed.rows.length,
        user_count: Object.keys(users).length,
        preview: preview.slice(0, 50),
        preview_truncated: preview.length > 50,
        errors: errors.slice(0, 50),
        error_count: errors.length
      }
    });
  } catch (e) {
    console.error('[user-prep] preview', e);
    return res.status(500).json({ code: 500, msg: '预览失败：' + String(e.message || e) });
  }
}

async function handleAdminUserPrepImport(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ code: 400, msg: '请上传 Excel/CSV 文件' });
    }
    var parsed = bufferToImportRows(req.file.buffer);
    if (parsed.error) {
      return res.status(400).json({ code: 400, msg: parsed.error });
    }

    var pool = getPool();
    var conn = await pool.getConnection();
    var createdUsers = 0;
    var overwrittenUsers = 0;
    var taxInserted = 0;
    var taxOverwritten = 0;
    var fail = [];
    var accountOut = {};

    try {
      await conn.beginTransaction();
      var i;
      for (i = 0; i < parsed.rows.length; i++) {
        var raw = parsed.rows[i];
        var n = normalizeImportRow(raw);
        if (n.error) {
          fail.push({ line: raw._line, username: cellStr(raw.username), msg: n.error });
          continue;
        }
        try {
          var ures = await upsertUser(conn, n);
          if (ures.created) createdUsers++;
          else if (ures.overwritten) overwrittenUsers++;
          if (!accountOut[n.username]) {
            accountOut[n.username] = {
              username: n.username,
              password: n.password || '(未改密码)',
              real_name: n.real_name,
              created: ures.created
            };
          } else if (n.password) {
            accountOut[n.username].password = n.password;
          }
          if (n.tax) {
            var tres = await upsertTax(conn, n.username, n.tax);
            if (tres.written) {
              if (tres.overwritten) taxOverwritten++;
              else taxInserted++;
            }
          }
        } catch (rowErr) {
          fail.push({
            line: raw._line,
            username: n.username,
            msg: String(rowErr.message || rowErr)
          });
        }
      }
      if (fail.length && fail.length === parsed.rows.length) {
        await conn.rollback();
        return res.status(400).json({
          code: 400,
          msg: '全部行失败，未写入',
          data: { errors: fail.slice(0, 80), error_count: fail.length }
        });
      }
      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch (e2) {}
      throw e;
    } finally {
      conn.release();
    }

    var accounts = Object.keys(accountOut).map(function (k) {
      return accountOut[k];
    });
    return res.json({
      code: 200,
      data: {
        conflict_policy: 'overwrite',
        format: parsed.format || 'flat',
        created_users: createdUsers,
        overwritten_users: overwrittenUsers,
        tax_inserted: taxInserted,
        tax_overwritten: taxOverwritten,
        error_count: fail.length,
        errors: fail.slice(0, 80),
        accounts: accounts
      }
    });
  } catch (e) {
    console.error('[user-prep] import', e);
    return res.status(500).json({ code: 500, msg: '导入失败：' + String(e.message || e) });
  }
}

function getHandlers() {
  return {
    handleAdminUserPrepTemplate: handleAdminUserPrepTemplate,
    handleAdminUserPrepPreview: handleAdminUserPrepPreview,
    handleAdminUserPrepImport: handleAdminUserPrepImport
  };
}

function getMiddleware() {
  return { prepUpload: prepUpload };
}

module.exports = {
  getHandlers: getHandlers,
  getMiddleware: getMiddleware,
  HEADER_MAP: HEADER_MAP,
  TEMPLATE_HEADERS: TEMPLATE_HEADERS,
  bufferToImportRows: bufferToImportRows,
  blockMatrixToRows: blockMatrixToRows
};
