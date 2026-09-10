'use strict';

const fs = require('fs');
const path = require('path');

const monolith = fs.readFileSync(
  path.join(__dirname, '../../src/legacy/monolith.js'),
  'utf8'
);

describe('安装统计注册按 IP 去重', () => {
  it('安装引导统计用同 IP 去重子查询，不再 COUNT(*) 账号', () => {
    expect(monolith).toContain('userRegisterDistinctIpInnerSql');
    expect(monolith).toContain('registerIpInner');
    expect(monolith).toContain('FROM ${registerIpInner} t');
    expect(monolith).not.toMatch(
      /const \[regDailyRows\] = await conn\.query\(\s*`SELECT \$\{cnUserDay\} AS d, COUNT\(\*\) AS registered/
    );
  });

  it('注册分析按时段/平台也走同 IP 去重', () => {
    expect(monolith).toContain('registerTimeInner');
    expect(monolith).toContain('seenRegisterPerson');
    expect(monolith).toContain('同注册 IP 只计 1 人');
  });
});
