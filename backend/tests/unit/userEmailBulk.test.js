const {
  isValidUserEmail,
  buildEmailBodies,
  buildCtaUrl
} = require('../../src/admin/userEmailBulk');

describe('userEmailBulk helpers', () => {
  test('isValidUserEmail accepts common addresses', () => {
    expect(isValidUserEmail('a@qq.com')).toBe(true);
    expect(isValidUserEmail('  name@126.com ')).toBe(true);
    expect(isValidUserEmail('bad')).toBe(false);
    expect(isValidUserEmail('a@b')).toBe(false);
    expect(isValidUserEmail('')).toBe(false);
  });

  test('buildEmailBodies includes CTA and unsubscribe hint', () => {
    var bodies = buildEmailBodies('标题', '正文一行', 'https://example.com/purchase.html');
    expect(bodies.subject).toBe('标题');
    expect(bodies.text).toContain('打开链接：https://example.com/purchase.html');
    expect(bodies.html).toContain('前往查看');
    expect(bodies.html).toContain('清空邮箱');
  });

  test('buildCtaUrl joins public origin', () => {
    expect(buildCtaUrl({ publicSiteUrl: 'https://a.example.com/' }, 'purchase.html')).toBe(
      'https://a.example.com/purchase.html'
    );
    expect(buildCtaUrl({ publicSiteUrl: '' }, 'purchase.html')).toBe('purchase.html');
  });
});
