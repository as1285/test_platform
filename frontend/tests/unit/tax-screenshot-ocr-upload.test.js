import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const authSrc = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const bootSrc = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const batchSrc = readFileSync(
  resolve(__dirname, '../../public/js/consult-batch-tax.js'),
  'utf8'
);
const html = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
const loaderSrc = readFileSync(
  resolve(__dirname, '../../public/js/admin/loader.js'),
  'utf8'
);

function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error(name + ' not found');
  let i = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error(name + ' body not closed');
  return src.slice(start, end);
}

describe('tax screenshot OCR upload multipart', () => {
  let mergeAuthRequestHeaders;
  let friendlyConsultTaxError;

  beforeAll(() => {
    // eslint-disable-next-line no-new-func
    mergeAuthRequestHeaders = new Function(
      extractFn(authSrc, 'isFormDataBody') +
        '\n' +
        extractFn(authSrc, 'mergeAuthRequestHeaders') +
        '; return mergeAuthRequestHeaders;'
    )();
    // eslint-disable-next-line no-new-func
    friendlyConsultTaxError = new Function(
      extractFn(batchSrc, 'friendlyConsultTaxError') + '; return friendlyConsultTaxError;'
    )();
  });

  it('cache-busts consult and admin loader together', () => {
    expect(html).toContain('consult-batch-tax.js?v=20260907-tax-ux');
    expect(loaderSrc).toContain('consult-batch-tax.js?v=20260907-tax-ux');
  });

  it('uploads OCR with raw fetch so multipart keeps its boundary', () => {
    const start = batchSrc.indexOf('function uploadTaxScreenshotForOcr');
    const end = batchSrc.indexOf('function bindTaxScreenshotOcrUi');
    const fn = batchSrc.slice(start, end);
    expect(fn).toContain("fetch('/api/tax/screenshot-ocr'");
    expect(fn).toContain('勿用 authFetch');
    expect(fn).not.toContain('window.authFetch');
    expect(fn).not.toContain('fetchFn(');
    expect(fn).toContain("fd.append('file'");
  });

  it('strips application/json when authFetch body is FormData', () => {
    const fd = new FormData();
    fd.append('file', new Blob(['x'], { type: 'image/jpeg' }), 'a.jpg');
    const headers = mergeAuthRequestHeaders(
      { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      { body: fd }
    );
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers['content-type']).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer t');

    const jsonHeaders = mergeAuthRequestHeaders(
      { 'Content-Type': 'application/json' },
      { body: JSON.stringify({ a: 1 }) }
    );
    expect(jsonHeaders['Content-Type']).toBe('application/json');
  });

  it('auth-boot stub also skips JSON content-type for FormData', () => {
    expect(bootSrc).toContain('opts.body instanceof FormData');
    expect(bootSrc).toContain("delete headers['Content-Type']");
  });

  it('hides raw JSON parse errors in the 请核对 dialog', () => {
    expect(
      friendlyConsultTaxError("Unexpected token '-', '------WebK'... is not valid JSON")
    ).toBe('截图上传失败，请重新选择图片后重试');
    expect(friendlyConsultTaxError('network_timeout')).toBe(
      '识别超时，请换更清晰或更小的截图后重试'
    );
  });
});
