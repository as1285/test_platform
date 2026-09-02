import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const shared = require('../../../backend/src/user/employmentCertShared.js');

describe('employmentCertShared pickLastCompany / pickZaizhiCompany', () => {
  it('prefers tax company month range for last company', () => {
    const employers = [
      {
        company_name: '甲公司',
        position: '经理',
        hire_date: '2023/1/1',
        leave_date: '2024/6/30',
        status: 0
      },
      {
        company_name: '乙公司',
        position: '职员',
        hire_date: '2024/7/1',
        leave_date: '',
        status: 1
      }
    ];
    const taxes = [
      { company_name: '甲公司', year: 2024, month: 5 },
      { company_name: '甲公司', year: 2024, month: 6 }
    ];
    const last = shared.pickLastCompany(employers, taxes);
    expect(last.company_name).toBe('甲公司');
    expect(last.position).toBe('经理');
  });

  it('zaizhi prefers current employer over tax last company', () => {
    const employers = [
      {
        company_name: '旧公司',
        position: '助理',
        hire_date: '2022/1/1',
        leave_date: '2023/12/31',
        status: 0
      },
      {
        company_name: '现公司',
        position: '工程师',
        hire_date: '2024/1/1',
        leave_date: '',
        status: '在职'
      }
    ];
    const taxes = [{ company_name: '旧公司', year: 2025, month: 8 }];
    const z = shared.pickZaizhiCompany(employers, taxes);
    expect(z.company_name).toBe('现公司');
    expect(z.position).toBe('工程师');
    expect(z.leave_date).toBe('');
  });

  it('genderFromIdNumber reads 18-digit id', () => {
    expect(shared.genderFromIdNumber('110101199001011234')).toBe('男');
    expect(shared.genderFromIdNumber('11010119900101122X')).toBe('女');
  });
});

describe('employment-cert frontend shell', () => {
  it('exposes initEmploymentCertPage and both pages wire it', () => {
    const js = readFileSync(
      resolve(__dirname, '../../public/js/employment-cert-page.js'),
      'utf8'
    );
    expect(js).toContain('function initEmploymentCertPage');
    expect(js).toContain('quickGenerate');
    expect(js).toContain('payload.quick = true');
    expect(js).toContain('androidSaveLocal');
    expect(js).toContain('TaxNativeSave');
    expect(js).toContain('dl=1');
    expect(js).toContain('保存到手机');

    const lizhi = readFileSync(resolve(__dirname, '../../lizhi_cert.html'), 'utf8');
    const zaizhi = readFileSync(resolve(__dirname, '../../zaizhi_cert.html'), 'utf8');
    expect(lizhi).toContain('employment-cert-page.js');
    expect(lizhi).toContain("product: 'lizhi_cert'");
    expect(lizhi).toContain('btnLizhiQuick');
    expect(zaizhi).toContain('employment-cert-page.js');
    expect(zaizhi).toContain("product: 'zaizhi_cert'");
    expect(zaizhi).toContain('一键生成最近任职公司');
    expect(zaizhi).toContain('btnLizhiQuick');
  });
});
