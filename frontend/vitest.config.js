import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'public/js/tax-year.js',
        'public/js/admin-analytics-period.js',
        'public/js/bank_card_bins.js',
        'public/js/shenbao_jilu_store.js'
      ],
      /* IIFE 脚本经 eval 加载时 V8 覆盖率为 0；门槛仅后端强制 */
    }
  }
});
