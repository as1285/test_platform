'use strict';

const menuRegistry = require('../../src/admin/menuRegistry');

describe('backend smoke', () => {
  it('loads menuRegistry exports', () => {
    expect(typeof menuRegistry.buildMenuTreeForAdmin).toBe('function');
    expect(Array.isArray(menuRegistry.ADMIN_MENU_GROUPS)).toBe(true);
  });
});
