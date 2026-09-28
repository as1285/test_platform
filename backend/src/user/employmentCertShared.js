/**
 * 离职/在职证明共用：最后一家公司选择（个税最近月份优先，再任职时间）。
 */
function clean(s) {
  return String(s == null ? '' : s).trim();
}

function dateKey(raw) {
  var s = clean(raw);
  var m = s.match(/(\d{4})\D+(\d{1,2})(?:\D+(\d{1,2}))?/);
  if (!m) return 0;
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3] || 1);
}

function ymKey(year, month) {
  var y = Number(year);
  var mo = Number(month);
  if (!y || !mo) return 0;
  return y * 100 + mo;
}

function formatYmDay(year, month, day) {
  return String(year) + '/' + String(Number(month)) + '/' + String(Number(day));
}

function lastDayOfMonth(year, month) {
  return new Date(Number(year), Number(month), 0).getDate();
}

function employerIsCurrent(row) {
  var st = row && row.status;
  if (st === 1 || st === '1' || st === '在职') return true;
  return !clean(row && row.leave_date);
}

function employerRecency(row) {
  var leave = dateKey(row && row.leave_date);
  var hire = dateKey(row && row.hire_date);
  var current = employerIsCurrent(row) ? 100000000 : 0;
  return current + Math.max(leave, hire);
}

/** 当前最后一家公司：优先个税最近月份对应单位，否则取任职里最近一段。 */
function pickLastCompany(employers, taxRecords) {
  var list = Array.isArray(employers) ? employers : [];
  var taxes = Array.isArray(taxRecords) ? taxRecords : [];
  var company = '';
  var firstYm = 0;
  var lastYm = 0;
  var i;
  for (i = 0; i < taxes.length; i++) {
    var cn = clean(taxes[i] && taxes[i].company_name);
    var k = ymKey(taxes[i] && taxes[i].year, taxes[i] && taxes[i].month);
    if (!cn || !k) continue;
    if (!company) {
      company = cn;
      firstYm = k;
      lastYm = k;
      continue;
    }
    if (cn !== company) continue;
    if (k < firstYm) firstYm = k;
    if (k > lastYm) lastYm = k;
  }

  var match = null;
  if (company) {
    for (i = 0; i < list.length; i++) {
      if (clean(list[i] && list[i].company_name) === company) {
        match = list[i];
        break;
      }
    }
  }
  if (!match && list.length) {
    match = list.slice().sort(function (a, b) {
      return employerRecency(b) - employerRecency(a);
    })[0];
    company = clean(match && match.company_name);
  }

  var hire = '';
  var leave = '';
  if (firstYm) {
    hire = formatYmDay(Math.floor(firstYm / 100), firstYm % 100, 1);
  }
  if (lastYm) {
    var ly = Math.floor(lastYm / 100);
    var lm = lastYm % 100;
    leave = formatYmDay(ly, lm, lastDayOfMonth(ly, lm));
  }
  if (match) {
    if (!company) company = clean(match.company_name);
    if (clean(match.hire_date)) hire = clean(match.hire_date);
    if (clean(match.leave_date)) leave = clean(match.leave_date);
    else if (employerIsCurrent(match)) leave = '';
  }

  return {
    company_name: company,
    position: match ? clean(match.position) : '',
    hire_date: hire,
    leave_date: leave,
    match: match || null
  };
}

/**
 * 在职证明预填：优先无离职/在职雇主，否则回退 pickLastCompany。
 */
function pickZaizhiCompany(employers, taxRecords) {
  var list = Array.isArray(employers) ? employers : [];
  var current = list
    .filter(function (row) {
      return employerIsCurrent(row) && clean(row && row.company_name);
    })
    .sort(function (a, b) {
      return employerRecency(b) - employerRecency(a);
    })[0];
  if (current) {
    return {
      company_name: clean(current.company_name),
      position: clean(current.position),
      hire_date: clean(current.hire_date),
      leave_date: '',
      match: current
    };
  }
  var last = pickLastCompany(employers, taxRecords);
  return {
    company_name: last.company_name,
    position: last.position,
    hire_date: last.hire_date,
    leave_date: '',
    match: last.match
  };
}

function genderFromIdNumber(idNumber) {
  var s = String(idNumber || '').replace(/[^0-9Xx]/g, '');
  var d = '';
  if (s.length >= 18) d = s.charAt(16);
  else if (s.length === 15) d = s.charAt(14);
  if (!d || !/\d/.test(d)) return '';
  return Number(d) % 2 === 1 ? '男' : '女';
}

module.exports = {
  clean: clean,
  dateKey: dateKey,
  employerIsCurrent: employerIsCurrent,
  employerRecency: employerRecency,
  pickLastCompany: pickLastCompany,
  pickZaizhiCompany: pickZaizhiCompany,
  genderFromIdNumber: genderFromIdNumber
};
