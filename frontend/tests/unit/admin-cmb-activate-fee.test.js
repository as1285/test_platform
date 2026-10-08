import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const frontend = resolve(__dirname, '../..');
const adminHtml = readFileSync(resolve(frontend, 'admin_panel.html'), 'utf8');
const adminJs = readFileSync(resolve(frontend, 'public/js/admin_panel.js'), 'utf8');

describe('admin cmb activate fee settings', () => {
  it('renders amount and grant days inputs with save button', () => {
    expect(adminHtml).toContain('id="cmbActivateFeeAmount"');
    expect(adminHtml).toContain('id="cmbActivateFeeDays"');
    expect(adminHtml).toContain('id="btnSaveCmbActivateFee"');
    expect(adminHtml).toMatch(/招商银行模拟器/);
  });

  it('wires collect/apply/save for cmb_activate_fee', () => {
    expect(adminJs).toContain('applyCmbActivateFeeToForm');
    expect(adminJs).toContain('collectCmbActivateFeeFromForm');
    expect(adminJs).toContain('cmb_activate_fee');
    expect(adminJs).toContain('btnSaveCmbActivateFee');
  });
});
