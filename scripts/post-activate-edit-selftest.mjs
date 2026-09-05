/**
 * 支付成功后编辑引导静态自检
 * node scripts/post-activate-edit-selftest.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function ok(label) {
  passed++;
  console.log('[post-activate-edit] ok', label);
}
function fail(label, detail) {
  failed++;
  console.error('[post-activate-edit] FAIL', label, detail || '');
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function mustInclude(rel, needles, label) {
  const src = read(rel);
  const miss = needles.filter((k) => !src.includes(k));
  if (!miss.length) ok(label);
  else fail(label, 'missing in ' + rel + ': ' + miss.join(', '));
}

mustInclude(
  'frontend/activate_success.html',
  ['onboarding=edit', '去编辑个税记录', 'cg_post_activate_pending'],
  'activate success page branches to edit'
);
mustInclude(
  'frontend/public/js/conversion-guide.js',
  [
    'goEditTaxRecords',
    'runPostActivateEditOnboarding',
    'POST_ACTIVATE_PENDING_KEY',
    '点下方记录卡片即可修改',
    '#recordListMount .record-card'
  ],
  'conversion guide edit onboarding'
);
mustInclude(
  'frontend/purchase.html',
  ['activeUserBackHref', 'consult.html?tab=records'],
  'purchase back to tax records'
);
mustInclude(
  'frontend/public/js/consult-records.js',
  ['syncConsultEditGuideAfterRecordsLoad'],
  'records list triggers edit guide'
);

(function testActiveUserBackHrefLogic() {
  const purchase = read('frontend/purchase.html');
  if (
    purchase.includes('function activeUserBackHref()') &&
    purchase.includes("return 'consult.html?tab=records'") &&
    purchase.includes('tax_record_count')
  ) {
    ok('activeUserBackHref prefers records when tax exists');
  } else {
    fail('activeUserBackHref prefers records when tax exists');
  }
})();

console.log(`[post-activate-edit] done passed=${passed} failed=${failed}`);
process.exit(failed ? 1 : 0);
