import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

beforeAll(() => {
  const auth = readFileSync(resolve(__dirname, '../../public/js/admin_auth.js'), 'utf8');
  // eslint-disable-next-line no-eval
  eval(auth);
});

function mockRes(status, body) {
  return {
    status: status,
    text: function () {
      return Promise.resolve(body);
    }
  };
}

describe('adminParseJson', () => {
  it('exposes helper', () => {
    expect(typeof window.adminParseJson).toBe('function');
  });

  it('parses JSON', async () => {
    const j = await window.adminParseJson(mockRes(200, '{"code":200,"data":{"sent":1}}'));
    expect(j.code).toBe(200);
    expect(j.data.sent).toBe(1);
  });

  it('turns HTML 404 into readable error', async () => {
    const html =
      '<!DOCTYPE html>\n<html lang="en">\n<head>\n<title>Error</title></head><body><pre>Cannot GET /api/admin/emails/send</pre></body></html>';
    await expect(window.adminParseJson(mockRes(404, html))).rejects.toThrow(/接口异常（HTTP 404）/);
  });

  it('turns empty body into readable error', async () => {
    await expect(window.adminParseJson(mockRes(502, '   '))).rejects.toThrow(/服务器无响应/);
  });
});
