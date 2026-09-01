import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pagePerf = readFileSync(resolve(__dirname, '../../public/js/page-perf.js'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const monolith = readFileSync(resolve(__dirname, '../../../backend/src/legacy/monolith.js'), 'utf8');

describe('page load perf tracking', () => {
  it('page-perf.js collects navigation timing and reports track_page_load_perf', () => {
    expect(pagePerf).toContain('track_page_load_perf');
    expect(pagePerf).toContain('dom_ready_ms');
    expect(pagePerf).toContain('fcp_ms');
    expect(pagePerf).toContain('load_ms');
    expect(pagePerf).toContain('device_model');
    expect(pagePerf).toContain('first-contentful-paint');
  });

  it('auth.js injects page-perf async', () => {
    expect(auth).toContain('injectPagePerf');
    expect(auth).toContain('/js/page-perf.js');
  });

  it('backend retains and stores track_page_load_perf', () => {
    expect(monolith).toContain('track_page_load_perf');
    expect(monolith).toContain('parsePageLoadPerfMeta');
    expect(monolith).toContain('handleAdminPageLoadPerfStats');
    expect(monolith).toContain("act.indexOf('track_page_load_') === 0");
  });
});
