'use strict';

const fs = require('fs');
const path = require('path');
const {
  requireOptional,
  createNoopPurchaseUxMonitor,
  requireOptionalPurchaseUxMonitor
} = require('../../src/shared/optionalRootModule');

describe('optionalRootModule soft-load', () => {
  it('returns stub when module path is missing', () => {
    var stub = { ok: true };
    var out = requireOptional('./definitely-missing-module-xyz', stub, 'test-missing');
    expect(out).toBe(stub);
  });

  it('purchaseUx stub has schedule + record hooks', () => {
    var stub = createNoopPurchaseUxMonitor();
    expect(typeof stub.recordFromTrack).toBe('function');
    expect(typeof stub.schedulePurchaseUxMonitor).toBe('function');
    expect(function () {
      stub.recordFromTrack({}, 'x', {}, null);
      stub.schedulePurchaseUxMonitor(function () {
        return null;
      });
    }).not.toThrow();
  });

  it('loads real purchaseUxMonitor when present on disk', () => {
    var realPath = path.join(__dirname, '../../purchaseUxMonitor.js');
    expect(fs.existsSync(realPath)).toBe(true);
    var mod = requireOptionalPurchaseUxMonitor();
    expect(typeof mod.schedulePurchaseUxMonitor).toBe('function');
    expect(typeof mod.recordFromTrack).toBe('function');
    expect(Array.isArray(mod.ALERT_EVENT_KEYS)).toBe(true);
  });

  it('Dockerfile copies purchaseUxMonitor.js so image boot does not miss it', () => {
    var docker = fs.readFileSync(path.join(__dirname, '../../Dockerfile'), 'utf8');
    expect(docker).toMatch(/COPY[^\n]*purchaseUxMonitor\.js/);
  });
});
