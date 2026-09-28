/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  insertBeforeLastCloseTag,
  injectSiteConfig,
  injectForensicMark,
  injectShell
} from '../../scripts/assemble-site.mjs';

const frontendRoot = resolve(__dirname, '../..');

function extractInlineScripts(html) {
  const out = [];
  const re = /<script(\b[^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const body = m[2] || '';
    if (!body.trim()) continue;
    out.push({
      line: html.slice(0, m.index).split('\n').length,
      start: m.index,
      end: m.index + m[0].length,
      body
    });
  }
  return out;
}

describe('assemble 注入不能插进内联脚本', () => {
  it('插到最后一个闭合标签前，而不是脚本字符串里的第一处', () => {
    const html =
      '<html><head><script>document.write("x</head><body></body></html>");</script></head>' +
      '<body><script>var a="</body>";</script></body></html>';
    const withCfg = injectSiteConfig(html);
    expect(withCfg).toContain('<script src="/js/site-config.js"></script>\n</head>');
    expect(withCfg).not.toMatch(/document\.write\("x<script src="\/js\/site-config/);

    const withMark = injectForensicMark(html);
    expect(withMark).toMatch(/forensic-mark\.js" defer><\/script>\n<\/body>/);
    expect(withMark).not.toMatch(/var a="<script src="\/js\/forensic-mark/);

    const withShell = injectShell(html, '<script src="/js/app/ui.js"></script>');
    expect(withShell).toContain('TAX_APP_SHELL_START');
    expect(withShell.indexOf('TAX_APP_SHELL_START')).toBeGreaterThan(withShell.indexOf('document.write'));
  });

  it('insertBeforeLastCloseTag 忽略脚本里先出现的同名标签', () => {
    const html = '<script>"</body>"</script></body>';
    const out = insertBeforeLastCloseTag(html, '</body>', 'INJECT');
    expect(out).toBe('<script>"</body>"</script>INJECT</body>');
  });

  it('源码 HTML 内联脚本不再出现未拆开的 </body></head></html>', () => {
    const pages = readdirSync(frontendRoot).filter((name) => name.endsWith('.html'));
    const hits = [];
    for (const name of pages) {
      const html = readFileSync(resolve(frontendRoot, name), 'utf8');
      for (const script of extractInlineScripts(html)) {
        const raw = script.body.match(/<\/(?:body|head|html)>/gi) || [];
        if (raw.length) {
          hits.push(`${name}:${script.line} ${raw.join(' ')}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
