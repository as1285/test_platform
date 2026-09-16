import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const install = readFileSync(resolve(__dirname, '../../install_guide.html'), 'utf8');
const nginx = readFileSync(resolve(__dirname, '../../nginx.conf'), 'utf8');

describe('安装页 Android APK 下载不走 WebView blob', () => {
  it('不再给本站 APK 按钮设 download 属性', () => {
    expect(install).toContain('不设 download=geshui.apk');
    expect(install).not.toContain("a.setAttribute('download', 'geshui.apk')");
  });

  it('nginx 把带文件名的签名下载路径交给后端', () => {
    expect(nginx).toContain('location ^~ /api/public/asset');
    expect(nginx).not.toMatch(/location = \/api\/public\/asset \{/);
  });
});
