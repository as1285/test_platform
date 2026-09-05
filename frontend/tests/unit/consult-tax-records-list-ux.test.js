import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const indirectEval = eval;
const html = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
const css = readFileSync(resolve(__dirname, '../../css/consult.css'), 'utf8');
const recordsSrc = readFileSync(resolve(__dirname, '../../public/js/consult-records.js'), 'utf8');
const guideSrc = readFileSync(resolve(__dirname, '../../public/js/conversion-guide.js'), 'utf8');

function loadListHelpers() {
  indirectEval(recordsSrc.split('function editRecord(id)')[0]);
}

function sampleRecords() {
  return [
    {
      id: 'r-1',
      year: 2026,
      month: 6,
      income_type: '工资薪金',
      report_date: '2026-07-15',
      company_name: '深圳市拓保软件有限公司南京分公司',
      income: '13000.00',
      tax_reported: '204.87'
    },
    {
      id: 'r-2',
      year: 2026,
      month: 5,
      income_type: '工资薪金',
      report_date: '2026-06-15',
      company_name: '示例公司',
      income: '12000.00',
      tax_reported: '150.00'
    }
  ];
}

describe('consult 税务记录列表：点卡片编辑 + 管理态删除', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="taxRecordsListCard">' +
      '<button type="button" id="btnTaxRecordsManage" aria-expanded="false" aria-pressed="false">管理</button>' +
      '<div id="taxRecordsManageMenu" hidden></div>' +
      '<p id="taxRecordsManageHint" hidden></p>' +
      '<div id="recordListMount"></div>' +
      '</div>';
    window.editRecord = vi.fn();
    window.deleteRecord = vi.fn();
    loadListHelpers();
  });

  it('keeps header 回填修改 / 管理 and cache-busts touched assets', () => {
    expect(html).toContain('回填修改');
    expect(html).toContain('id="btnTaxRecordsManage"');
    expect(html).toContain('id="taxRecordsManageHint"');
    expect(html).toContain('tax-records-manage-toolbar');
    expect(html).toContain('consult.css?v=20260905-list-compat');
    expect(html).toContain('consult-records.js?v=20260905-list-tap');
    expect(html).toContain('consult-batch-tax.js?v=20260905-list-tap');
    expect(html).toContain('id="compatBugRecordsEntry"');
    expect(html).toContain('兼容问题反馈');
    expect(html).toContain('按模板生成个税');
    expect(html).toContain('id="batchTaxCollapseBtn"');
    expect(html).toContain('id="batch_submit_employments_btn"');
  });

  it('default cards keep month/type/company/income and drop dual primary buttons', () => {
    window.renderListFromArray(sampleRecords());
    const mount = document.getElementById('recordListMount');
    expect(mount.querySelectorAll('.record-card').length).toBe(2);
    expect(mount.textContent).toContain('2026年6月 - 工资薪金');
    expect(mount.textContent).toContain('深圳市拓保软件有限公司南京分公司');
    expect(mount.textContent).toContain('收入：13000.00元');
    expect(mount.textContent).toContain('已申报税额：204.87元');
    expect(mount.innerHTML).not.toContain('>编辑<');
    expect(mount.querySelector('.list-item-actions')).toBeNull();
    const card = mount.querySelector('.record-card');
    expect(card.classList.contains('is-tappable')).toBe(true);
    expect(card.getAttribute('data-record-id')).toBe('r-1');
    expect(card.getAttribute('role')).toBe('button');
    const delBtn = mount.querySelector('[data-record-delete="r-1"]');
    expect(delBtn).toBeTruthy();
    expect(delBtn.hidden).toBe(true);
  });

  it('tapping a card opens edit; delete stays behind 管理 mode', () => {
    window.renderListFromArray(sampleRecords());
    const mount = document.getElementById('recordListMount');
    mount.querySelector('.record-card').click();
    expect(window.editRecord).toHaveBeenCalledWith('r-1');

    expect(window.isTaxRecordsManageMode()).toBe(false);
    expect(document.getElementById('taxRecordsListCard').classList.contains('is-managing')).toBe(
      false
    );
    window.toggleTaxRecordsManageMode();
    expect(window.isTaxRecordsManageMode()).toBe(true);
    expect(document.getElementById('taxRecordsListCard').classList.contains('is-managing')).toBe(
      true
    );
    expect(document.getElementById('btnTaxRecordsManage').textContent).toBe('完成');
    expect(document.getElementById('taxRecordsManageMenu').hidden).toBe(false);
    expect(document.getElementById('taxRecordsManageHint').hidden).toBe(false);
    expect(mount.querySelector('[data-record-delete="r-2"]').hidden).toBe(false);

    mount.querySelector('[data-record-delete="r-2"]').click();
    expect(window.deleteRecord).toHaveBeenCalledWith('r-2');
    expect(window.editRecord).toHaveBeenCalledTimes(1);
  });

  it('styles hide per-row delete until manage mode and keep a tappable chevron', () => {
    expect(css).toContain('#taxRecordsListCard.is-managing .record-card-delete');
    expect(css).toContain('.record-card.is-tappable');
    expect(css).toContain('#taxRecordsListCard.is-managing .tax-records-manage-toolbar');
  });

  it('updates post-activate copy to tap-card instead of 右侧编辑', () => {
    expect(guideSrc).toContain('#recordListMount .record-card');
    expect(guideSrc).toContain('点下方记录卡片即可修改');
    expect(guideSrc).toContain('点这条记录即可修改');
    expect(guideSrc).not.toContain('点每条记录右侧的「编辑」');
    expect(guideSrc).not.toContain('list-item-actions .btn-primary');
  });
});
