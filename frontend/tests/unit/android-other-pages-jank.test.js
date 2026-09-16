import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const frontend = resolve(__dirname, '../..');
const read = (name) => readFileSync(resolve(frontend, name), 'utf8');

const boot = read('public/js/auth-boot.js');
const pages = {
  shouye: read('shouye.html'),
  daiban: read('daiban.html'),
  bancha: read('bancha.html'),
  message: read('message.html'),
  mine: read('mine.html'),
  consult: read('consult.html'),
  najilu: read('najilu.html'),
  zhongdian: read('zhongdian_fuwu.html'),
  zonghe: read('zonghe.html'),
  shuiming: read('shuiming.html'),
  shuimingResult: read('shuiming_result.html'),
  xiangqing: read('xiangqing.html'),
  purchase: read('purchase.html'),
  messageDetail: read('message_detail.html'),
  faceLogin: read('face_login.html'),
  gerenxinxi: read('gerenxinxi.html'),
  personalInfo: read('personal_info.html')
};

const ANDROID_OVERFLOW = /html\.app-android-client[\s\S]{0,80}overflow-x:\s*hidden/;

describe('安卓其它页：横向裁切 + 降优先级脚本', () => {
  it('auth-boot 只给安卓注入横向 overflow 裁切，不碰 iOS', () => {
    expect(boot).toContain('function clipAndroidHorizontalOverflow()');
    expect(boot).toContain("id = 'androidPageOverflowClip'");
    expect(boot).toContain(
      'html.app-android-client,html.app-android-client body{overflow-x:hidden;max-width:100%;}'
    );
    expect(boot).toContain("classList.contains('app-android-client')");
    expect(boot).toContain('clipAndroidHorizontalOverflow();');
    const markIdx = boot.indexOf('markViewportChromeClasses();');
    const clipIdx = boot.indexOf('clipAndroidHorizontalOverflow();');
    expect(markIdx).toBeGreaterThan(0);
    expect(clipIdx).toBeGreaterThan(markIdx);
    expect(boot).toContain('不作用于 iOS');
  });

  it('底栏 / 常用页拉到带裁切的 auth-boot，auth.js 降低优先级', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(html, name).toContain('auth-boot.js?v=20260916-android-pages');
      expect(html, name).toMatch(/auth\.js\?v=[^"]+" defer fetchpriority="low"/);
    });
  });

  it('办税、待办、消息、我的、咨询、纳税记录、综合所得只裁安卓横溢', () => {
    expect(pages.daiban).toMatch(ANDROID_OVERFLOW);
    expect(pages.bancha).toMatch(ANDROID_OVERFLOW);
    expect(pages.message).toMatch(ANDROID_OVERFLOW);
    expect(pages.mine).toMatch(ANDROID_OVERFLOW);
    expect(pages.consult).toMatch(ANDROID_OVERFLOW);
    expect(pages.najilu).toMatch(ANDROID_OVERFLOW);
    expect(pages.zhongdian).toMatch(ANDROID_OVERFLOW);
    expect(pages.zonghe).toMatch(ANDROID_OVERFLOW);
    expect(pages.mine).toContain('勿在 body 上 overflow-x:hidden');
    expect(pages.mine).toContain('html.app-android-client body.page-mine');
    expect(pages.mine).not.toMatch(/\n\s*body\s*\{[^}]*\n\s*overflow-x:\s*hidden/);
  });

  it('咨询页壳脚本 defer，办查页预加载横幅并懒加载折下图标', () => {
    expect(pages.consult).toContain('<script src="/js/app/ui.js" defer></script>');
    expect(pages.consult).toContain('<script src="/js/app/nav.js" defer></script>');
    expect(pages.consult).toContain('<script src="/js/app/core.js" defer></script>');
    expect(pages.bancha).toContain('preload" as="image" href="img/bancha/banner-zonghe.png"');
    expect(pages.bancha).toContain('preload" as="image" href="img/bancha/banner-zxk.png"');
    expect(pages.bancha).toMatch(/src="img\/bancha\/cx-shuiming\.png"[^>]*loading="lazy"/);
    expect(pages.bancha).toMatch(/src="img\/bancha\/fp-saoma\.png"[^>]*loading="lazy"/);
    expect(pages.bancha).toMatch(/src="img\/bancha\/gz-redian\.png"[^>]*loading="lazy"/);
    expect((pages.bancha.match(/img\/bancha\/(?:cx|fp|gz)-[^"]+"[^>]*loading="lazy"/g) || []).length).toBeGreaterThanOrEqual(16);
  });

  it('重点服务页 home-services 仍在文末同步加载，不 defer', () => {
    expect(pages.zhongdian).toMatch(/home-services\.js\?v=20260908-apk-icons"><\/script>/);
    expect(pages.zhongdian).not.toMatch(/home-services\.js[^"]*" defer/);
  });
});
