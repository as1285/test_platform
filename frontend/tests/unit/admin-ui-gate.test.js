import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');
const nginx = readFileSync(resolve(root, 'nginx.conf'), 'utf8');
const auth = readFileSync(resolve(root, 'public/js/admin_auth.js'), 'utf8');
const login = readFileSync(resolve(root, 'public/js/admin/login.js'), 'utf8');
const assemble = readFileSync(resolve(root, 'scripts/assemble-site.mjs'), 'utf8');

describe('admin static files require login cookie', () => {
  it('nginx auth_request gates panel assets', () => {
    expect(nginx).toContain('auth_request /__admin_ui_auth');
    expect(nginx).toContain('/api/admin/ui-asset-auth');
    expect(nginx).toContain('location = /admin_panel.html');
    expect(nginx).toContain('location = /js/admin_panel.js');
    expect(nginx).toContain('location = /js/admin/login.js');
  });

  it('login and logout attach the ui cookie', () => {
    expect(auth).toContain('/api/admin/ui-cookie');
    expect(auth).toContain('/api/admin/logout');
    expect(auth).toContain("credentials: 'include'");
    expect(login).toContain("credentials: 'include'");
  });

  it('assemble fails the build if core js is not minified', () => {
    expect(assemble).toContain('assertCoreJsProtected');
    expect(assemble).toContain("'js/auth.js'");
    expect(assemble).toContain("'js/admin_panel.js'");
  });
});
