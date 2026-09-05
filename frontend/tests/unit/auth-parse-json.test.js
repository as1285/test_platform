import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

beforeAll(() => {
  const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
  const start = auth.indexOf('function authParseJson(r, fallbackMsg)');
  if (start < 0) throw new Error('authParseJson not found in auth.js');
  // grab function body by brace matching
  let i = auth.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (; i < auth.length; i++) {
    const ch = auth[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error('authParseJson body not closed');
  const src = auth.slice(start, end);
  // eslint-disable-next-line no-new-func
  const fn = new Function(`${src}; return authParseJson;`);
  globalThis.authParseJson = fn();
});

function mockRes(status, body) {
  return {
    status: status,
    text: function () {
      return Promise.resolve(body);
    }
  };
}

describe('authParseJson', () => {
  it('exposes helper', () => {
    expect(typeof globalThis.authParseJson).toBe('function');
  });

  it('parses JSON', async () => {
    const j = await globalThis.authParseJson(mockRes(200, '{"code":200,"data":{"ok":1}}'));
    expect(j.code).toBe(200);
    expect(j.data.ok).toBe(1);
  });

  it('turns HTML 50x into readable error', async () => {
    const html = '<!DOCTYPE html>\n<html>\n<head>\n<title>Error</title></head><body>Error</body></html>';
    await expect(globalThis.authParseJson(mockRes(502, html))).rejects.toThrow(/服务暂时不可用/);
  });

  it('turns empty body into readable error', async () => {
    await expect(globalThis.authParseJson(mockRes(502, '   '))).rejects.toThrow(/服务器无响应/);
  });
});
