'use strict';

const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/legacy/pricingAb.js',
        'src/legacy/inviteReward.js',
        'src/legacy/agentChannels.js',
        'src/admin/menuRegistry.js',
        'src/shared/signedAssets.js',
        'src/shared/settingsPolicy.js',
        'src/shared/plainPassword.js',
        'src/shared/rateLimit.js',
        'src/domain/**/*.js',
        'alipay.js',
        'register-guard.js',
        'bank_card_bins.js',
        'dbLogRetention.js',
        'chatAi.js',
        'src/admin/sbdyDemo.js',
        'serverMonitor.js'
      ],
      thresholds: {
        lines: 50,
        functions: 40,
        statements: 50
      }
    }
  }
});
