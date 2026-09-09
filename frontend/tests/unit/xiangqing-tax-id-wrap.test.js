import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8');

describe('收入纳税明细详情标签换行', () => {
  it('基础情况标签默认单行，仅识别号在「识别号」前换行', () => {
    expect(html).toMatch(/\.info-label\s*\{[^}]*white-space:\s*nowrap/);
    expect(html).toContain('info-label--tax-id');
    expect(html).toContain('扣缴义务人纳税人<br>识别号：');
    expect(html).toMatch(/\.info-label--tax-id\s*\{[^}]*white-space:\s*normal/);
  });
});
