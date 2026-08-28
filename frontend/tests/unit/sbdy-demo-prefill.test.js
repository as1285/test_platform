import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const sbdyCode = readFileSync(
  resolve(__dirname, '../../public/js/admin/modules/sbdy-demo.js'),
  'utf8'
);

function recordsFor(company, credit, authority, startYm, endYm, extra) {
  const out = [];
  let [year, month] = startYm.split('-').map(Number);
  const [endYear, endMonth] = endYm.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(
      Object.assign(
        {
          year,
          month,
          company_name: company,
          company_tax_id: credit,
          tax_authority: authority
        },
        extra || {}
      )
    );
    month += 1;
    if (month > 12) {
      year += 1;
      month = 1;
    }
  }
  return out;
}

describe('社保演示预填分段', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="sbdyRegionZj" type="radio" checked>
      <input id="sbdyRegionJs" type="radio">
      <input id="sbdyPrefillUser" value="13555226712">
      <input id="sbdyPrefillStart" type="month" value="2024-08">
      <input id="sbdyPrefillEnd" type="month" value="2026-07">
      <button id="sbdyPrefillBtn" type="button">预填</button>
      <input id="sbdyName">
      <input id="sbdyIdNumber">
      <select id="sbdyGender"><option value="女">女</option><option value="男">男</option></select>
      <input id="sbdyCompany">
      <input id="sbdyCredit">
      <input id="sbdyArea" value="余杭区">
      <input id="sbdyBase" value="4879">
      <input id="sbdyPeriodStart" type="month">
      <input id="sbdyPeriodEnd" type="month">
      <span id="sbdyDemoStatus"></span>
      <div id="sbdySegments"></div>
      <table><tbody id="sbdyDemoListTbody"></tbody></table>
    `;
    delete window.AdminModules;
    delete window.loadSbdyDemoPage;
  });

  it('浙江版排除外地税务记录并收窄实际缴费区间', async () => {
    const duplicateCredit = '91330110MADG8JH092';
    const taxRecords = recordsFor(
      '杭州华鲜高新技术有限公司',
      duplicateCredit,
      '国家税务总局杭州市余杭区税务局',
      '2025-04',
      '2026-07'
    ).concat(
      recordsFor(
        '青岛智腾微电子科技有限公司',
        duplicateCredit,
        '国家税务总局青岛市城阳区税务局',
        '2024-08',
        '2025-03'
      )
    );

    window.adminFetch = vi.fn((url) => {
      if (String(url).includes('/prefill?')) {
        return Promise.resolve({
          status: 200,
          json: () =>
            Promise.resolve({
              code: 200,
              data: {
                user: {
                  real_name: '王龙雪',
                  user_tax_id: '371323199701195223'
                },
                employers: [],
                tax_records: taxRecords
              }
            })
        });
      }
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ code: 200, data: { list: [] } })
      });
    });

    // eslint-disable-next-line no-eval
    eval(sbdyCode);
    window.AdminModules['sbdy-demo'].loadPage();
    document.getElementById('sbdyPrefillBtn').click();

    await vi.waitFor(() => {
      expect(document.querySelectorAll('.sbdy-seg-row')).toHaveLength(1);
    });

    const localRow = document.querySelector('.sbdy-seg-row');
    expect(document.getElementById('sbdyCompany').value).toBe('');
    expect(document.getElementById('sbdyCredit').value).toBe('');
    expect(localRow.querySelector('.seg-company').value).toBe(
      '杭州华鲜高新技术有限公司'
    );
    expect(localRow.querySelector('.seg-credit').value).toBe(duplicateCredit);
    expect(localRow.querySelector('.seg-area').value).toBe('余杭区');
    expect(localRow.querySelector('.seg-start').value).toBe('2025-04');
    expect(localRow.querySelector('.seg-end').value).toBe('2026-07');
    expect(document.getElementById('sbdyPeriodStart').value).toBe('2024-08');
    expect(document.getElementById('sbdyPeriodEnd').value).toBe('2026-07');
    expect(document.getElementById('sbdyDemoStatus').textContent).toContain(
      '浙江记录 16 个月'
    );
    expect(document.getElementById('sbdyDemoStatus').textContent).toContain(
      '已排除外地 8 个月'
    );
  });

  it('浙江预填按各公司个税推算各段缴费基数，不套统一基数', async () => {
    const taxRecords = recordsFor(
      '杭州华鲜高新技术有限公司',
      '91330110MADG8JH092',
      '国家税务总局杭州市余杭区税务局',
      '2025-04',
      '2026-06',
      { income: '5000.00', pension_insurance: '400.00', income_subtype: '正常工资薪金' }
    )
      .concat([
        {
          year: 2025,
          month: 12,
          company_name: '杭州华鲜高新技术有限公司',
          company_tax_id: '91330110MADG8JH092',
          tax_authority: '国家税务总局杭州市余杭区税务局',
          income: '20000.00',
          pension_insurance: '0.00',
          income_subtype: '全年一次性奖金收入'
        }
      ])
      .concat(
        recordsFor(
          '杭州圆趣企业运营管理有限公司',
          '91330109MAETP27PX2',
          '国家税务总局杭州市萧山区税务局',
          '2026-07',
          '2026-07',
          { income: '4986.00', pension_insurance: '398.88', income_subtype: '正常工资薪金' }
        )
      );

    window.adminFetch = vi.fn((url) => {
      if (String(url).includes('/prefill?')) {
        return Promise.resolve({
          status: 200,
          json: () =>
            Promise.resolve({
              code: 200,
              data: {
                user: {
                  real_name: '王龙雪',
                  user_tax_id: '371323199701195223'
                },
                employers: [],
                tax_records: taxRecords
              }
            })
        });
      }
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ code: 200, data: { list: [] } })
      });
    });

    // eslint-disable-next-line no-eval
    eval(sbdyCode);
    window.AdminModules['sbdy-demo'].loadPage();
    document.getElementById('sbdyPrefillBtn').click();

    await vi.waitFor(() => {
      expect(document.querySelectorAll('.sbdy-seg-row')).toHaveLength(2);
    });

    const rows = document.querySelectorAll('.sbdy-seg-row');
    expect(rows[0].querySelector('.seg-company').value).toBe(
      '杭州华鲜高新技术有限公司'
    );
    expect(Number(rows[0].querySelector('.seg-base').value)).toBe(5000);
    expect(rows[1].querySelector('.seg-company').value).toBe(
      '杭州圆趣企业运营管理有限公司'
    );
    expect(Number(rows[1].querySelector('.seg-base').value)).toBe(4986);
    expect(Number(document.getElementById('sbdyBase').value)).toBe(4986);
  });

  it('江苏多公司分段时上方保留最近单位作为现参保单位', async () => {
    document.getElementById('sbdyRegionZj').checked = false;
    document.getElementById('sbdyRegionJs').checked = true;
    document.getElementById('sbdyPrefillStart').value = '2025-01';
    document.getElementById('sbdyPrefillEnd').value = '2025-04';
    const taxRecords = recordsFor(
      '南京旧单位有限公司',
      '91320100OLD0000001',
      '国家税务总局南京市税务局',
      '2025-01',
      '2025-02'
    ).concat(
      recordsFor(
        '南京贝奇尔机械有限公司',
        '91320100NEW0000002',
        '国家税务总局南京市税务局',
        '2025-03',
        '2025-04'
      )
    );

    window.adminFetch = vi.fn((url) => {
      if (String(url).includes('/prefill?')) {
        return Promise.resolve({
          status: 200,
          json: () =>
            Promise.resolve({
              code: 200,
              data: {
                user: {
                  real_name: '樊宣',
                  user_tax_id: '342501199307088233'
                },
                employers: [],
                tax_records: taxRecords
              }
            })
        });
      }
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ code: 200, data: { list: [] } })
      });
    });

    // eslint-disable-next-line no-eval
    eval(sbdyCode);
    window.AdminModules['sbdy-demo'].loadPage();
    document.getElementById('sbdyPrefillBtn').click();

    await vi.waitFor(() => {
      expect(document.querySelectorAll('.sbdy-seg-row')).toHaveLength(2);
    });
    expect(document.getElementById('sbdyCompany').value).toBe(
      '南京贝奇尔机械有限公司'
    );
  });

  it('粘贴模版缺少身份证号时按地区和性别生成合法默认值', () => {
    // eslint-disable-next-line no-eval
    eval(sbdyCode);
    const parsed = window.AdminModules['sbdy-demo'].parsePasteTemplate(`
姓名：潘心茹
性别：女
时间：2025.7-2026.6
深圳社保
公司名称：深圳市前海寻文化科技有限公司
`);

    expect(parsed.error).toBeUndefined();
    expect(parsed.id_number_defaulted).toBe(true);
    expect(parsed.id_number).toMatch(/^440305\d{11}[\dX]$/);
    expect(Number(parsed.id_number.charAt(16)) % 2).toBe(0);

    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checks = '10X98765432';
    const sum = weights.reduce(
      (total, weight, index) => total + Number(parsed.id_number.charAt(index)) * weight,
      0
    );
    expect(parsed.id_number.charAt(17)).toBe(checks.charAt(sum % 11));
  });

  it('最近生成列表可删除并刷新', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    window.adminFetch = vi.fn((url, opts) => {
      if (String(url).includes('/delete')) {
        expect(opts && opts.method).toBe('POST');
        expect(JSON.parse(opts.body).id).toBe(42);
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ code: 200, msg: '已删除', data: { id: 42 } })
        });
      }
      if (String(url).includes('/list')) {
        const alreadyDeleted = window.adminFetch.mock.calls.some((c) =>
          String(c[0]).includes('/delete')
        );
        return Promise.resolve({
          status: 200,
          json: () =>
            Promise.resolve({
              code: 200,
              data: {
                list: alreadyDeleted
                  ? []
                  : [
                      {
                        id: 42,
                        name: '王龙雪',
                        id_number: '371323199701195223',
                        company_name: '杭州圆趣企业运营管理有限公司',
                        region: 'zj',
                        auth_code: 'SBDYTEST',
                        created_at: '2026-08-28 10:56:23',
                        links: {
                          show_url: '/taxmock/SBDYTEST/show.pdf',
                          verify_url: '/taxmock/SBDYTEST/verify'
                        }
                      }
                    ]
              }
            })
        });
      }
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ code: 200, data: {} })
      });
    });

    // eslint-disable-next-line no-eval
    eval(sbdyCode);
    window.AdminModules['sbdy-demo'].loadPage();

    await vi.waitFor(() => {
      expect(document.querySelector('.sbdy-demo-del')).toBeTruthy();
    });
    document.querySelector('.sbdy-demo-del').click();

    await vi.waitFor(() => {
      expect(document.getElementById('sbdyDemoListTbody').textContent).toContain('暂无记录');
    });
    expect(confirmSpy).toHaveBeenCalled();
    expect(
      window.adminFetch.mock.calls.some((c) => String(c[0]).includes('/delete'))
    ).toBe(true);
    confirmSpy.mockRestore();
  });
});
