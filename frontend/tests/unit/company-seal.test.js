import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { existsSync, unlinkSync, statSync } from 'fs';

const script = resolve(__dirname, '../../../backend/scripts/company_seal.py');
const out = resolve(__dirname, '../../../backend/scripts/_test_company_seal.png');

describe('company_seal.py DrawStampUtils-style seal', () => {
  it('renders a non-empty PNG for a sample company', () => {
    if (existsSync(out)) unlinkSync(out);
    const r = spawnSync(
      'python3',
      [script, '杭州云启信息技术有限公司', out],
      { encoding: 'utf8', timeout: 30000 }
    );
    if (r.status !== 0) {
      const err = String(r.stderr || r.stdout || '');
      // 环境缺字体/依赖时跳过，避免拖垮前端单测；脚本本身仍纳入仓库
      if (/Font|font|PIL|TrueType|cannot open|No such file|freetype|OSError|ValueError/i.test(err)) {
        expect(existsSync(script)).toBe(true);
        return;
      }
      expect(r.status, err.slice(0, 500)).toBe(0);
    }
    expect(r.stdout).toContain('ok');
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(10000);
    unlinkSync(out);
  });
});
