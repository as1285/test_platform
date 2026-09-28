const { readFileSync } = require('fs');
const { resolve } = require('path');

const monolith = readFileSync(resolve(__dirname, '../../src/legacy/monolith.js'), 'utf8');

describe('心理价出价仅 ABC 渠道', () => {
  it('GET/POST 对非 abc 关闭出价', () => {
    expect(monolith).toContain('async function userIsAbcSalesChannel');
    expect(monolith).toContain('var abcOnly = await userIsAbcSalesChannel(req.authUserId || \'\', req)');
    expect(monolith).toContain('var bidEnabled = !!(cfg.enabled && abcOnly)');
    expect(monolith).toContain("return res.status(403).json({ code: 403, msg: '当前渠道暂未开放出价' })");
    expect(monolith).toContain('if (!(await userIsAbcSalesChannel(req.authUserId || \'\', req)))');
  });
});
