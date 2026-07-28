'use strict';
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

var asset = path.join(__dirname, '../assets/user_prep_import_template.xlsx');
var wb = XLSX.readFile(asset);
var name = wb.SheetNames[0];
var ws = wb.Sheets[name];
var m = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
var bankIdx = -1;
var i;
for (i = 0; i < m.length; i++) {
  if (String(m[i][0] || '').trim() === '银行名称') {
    bankIdx = i;
    break;
  }
}
var insert = [
  ['用户名', 'demo001', '', ''],
  ['密码', 'Pass1234', '', ''],
  ['证件号', '', '', ''],
  ['性别', '男', '', ''],
  ['开通天数', '', '', '']
];
if (bankIdx >= 0) {
  m.splice.apply(m, [bankIdx, 0].concat(insert));
} else {
  insert.forEach(function (row) {
    m.push(row);
  });
}
var nws = XLSX.utils.aoa_to_sheet(m);
var nwb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(nwb, nws, '备数模板');
fs.writeFileSync(asset, XLSX.write(nwb, { type: 'buffer', bookType: 'xlsx' }));
console.log('patched', asset, 'rows', m.length);
