import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');

describe('iOS home a6 card size', () => {
  it('shrinks all Apple models to official 3.1 columns, not 2.75', () => {
    expect(shouye).toMatch(/html\.app-ios-client \.sy-apk-hitem\s*\{[^}]*\/ 3\.1\)/);
    expect(shouye).toContain('html.app-ios-client .sy-apk-hitem');
    expect(shouye).toContain('max-width: 118px !important');
    expect(shouye).not.toMatch(/html\.app-ios-iphone15promax \.sy-apk-hitem/);
  });
});
