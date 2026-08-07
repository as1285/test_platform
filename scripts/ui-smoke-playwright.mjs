#!/usr/bin/env node
/**
 * @deprecated 请使用 ./scripts/ui-smoke-playwright.sh（默认 Docker，无需本机 Chromium）
 */
console.error('[ui-smoke] 请运行: ./scripts/ui-smoke-playwright.sh');
console.error('[ui-smoke] 本机模式: UI_SMOKE_LOCAL=1 ./scripts/ui-smoke-playwright.sh');
console.error('[ui-smoke] 强制 node 回退: UI_SMOKE_NODE_FALLBACK=1 ./scripts/ui-smoke-playwright.sh');
process.exit(2);
