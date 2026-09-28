'use strict';

function clearMod(id) {
  try {
    delete require.cache[require.resolve(id)];
  } catch (e) {}
}

function loadPlainPassword(mode) {
  process.env.JWT_SECRET = 'unit-test-jwt';
  process.env.REGISTER_STORE_PLAIN_PASSWORD = mode;
  clearMod('../../src/shared/config');
  clearMod('../../src/shared/plainPassword');
  return require('../../src/shared/plainPassword');
}

describe('plainPassword', () => {
  afterEach(() => {
    delete process.env.REGISTER_STORE_PLAIN_PASSWORD;
  });

  it('off mode stores null', () => {
    const pp = loadPlainPassword('0');
    expect(pp.plainPasswordMode()).toBe('off');
    expect(pp.encodePlainPasswordForStore('secret')).toBe(null);
  });

  it('plain mode stores truncated plaintext', () => {
    const pp = loadPlainPassword('plain');
    expect(pp.plainPasswordMode()).toBe('plain');
    expect(pp.encodePlainPasswordForStore('hello')).toBe('hello');
    expect(pp.decodePlainPasswordForDisplay('hello')).toBe('hello');
  });

  it('encrypt mode round-trips', () => {
    const pp = loadPlainPassword('encrypt');
    expect(pp.plainPasswordMode()).toBe('encrypt');
    const enc = pp.encodePlainPasswordForStore('p@ssw0rd');
    expect(typeof enc).toBe('string');
    expect(enc).toMatch(/^enc:/);
    expect(pp.decodePlainPasswordForDisplay(enc)).toBe('p@ssw0rd');
  });

  it('bad ciphertext returns empty', () => {
    const pp = loadPlainPassword('encrypt');
    expect(pp.decodePlainPasswordForDisplay('enc:bad:data:xx')).toBe('');
  });
});
