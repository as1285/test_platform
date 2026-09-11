'use strict';

const {
  compareSameMonth,
  planMonthReorder
} = require('../../src/tax/taxRecordListOrder');

describe('taxRecordListOrder', () => {
  const july = [
    { id: 'a', income_subtype: '正常工资薪金', list_order: 0 },
    { id: 'b', income_subtype: '正常工资薪金', list_order: 0 }
  ];

  it('keeps id order when list_order is unset', () => {
    const sorted = july.slice().sort(compareSameMonth);
    expect(sorted.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('puts 全年一次性奖金 after salary when list_order ties', () => {
    const rows = [
      { id: 'bonus', income_subtype: '全年一次性奖金收入', list_order: 0 },
      { id: 'pay', income_subtype: '正常工资薪金', list_order: 0 }
    ];
    expect(rows.slice().sort(compareSameMonth).map((r) => r.id)).toEqual(['pay', 'bonus']);
  });

  it('swaps two same-month rows and writes sequential list_order', () => {
    const down = planMonthReorder(july, 'a', 'down');
    expect(down.ok).toBe(true);
    expect(down.updates).toEqual([
      { id: 'b', list_order: 0 },
      { id: 'a', list_order: 1 }
    ]);
    const up = planMonthReorder(july, 'b', 'up');
    expect(up.ok).toBe(true);
    expect(up.updates).toEqual([
      { id: 'b', list_order: 0 },
      { id: 'a', list_order: 1 }
    ]);
  });

  it('rejects moving past the ends or a bad direction', () => {
    expect(planMonthReorder(july, 'a', 'up').ok).toBe(false);
    expect(planMonthReorder(july, 'b', 'down').ok).toBe(false);
    expect(planMonthReorder(july, 'a', 'left').ok).toBe(false);
    expect(planMonthReorder(july, 'missing', 'up').ok).toBe(false);
  });
});
