'use strict';


describe('chatAi', () => {
  const prev = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...prev };
    delete process.env.CHAT_AI_API_KEY;
  });
  afterEach(() => {
    process.env = { ...prev };
    vi.unstubAllGlobals();
  });

  it('sanitizeReplyText trims and truncates', () => {
    const chatAi = require('../../chatAi');
    expect(chatAi.sanitizeReplyText('  hi  ')).toBe('hi');
    expect(chatAi.sanitizeReplyText('x'.repeat(50), 10).length).toBe(10);
    expect(chatAi.sanitizeReplyText('a\u0000b')).toBe('ab');
  });

  it('isConfigured reflects API key', () => {
    let chatAi = require('../../chatAi');
    expect(chatAi.isConfigured()).toBe(false);
    process.env.CHAT_AI_API_KEY = 'sk-test';
    vi.resetModules();
    chatAi = require('../../chatAi');
    expect(chatAi.isConfigured()).toBe(true);
    expect(chatAi.getPublicStatus().configured).toBe(true);
  });

  it('generateReply mocks fetch success', async () => {
    process.env.CHAT_AI_API_KEY = 'sk-test';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ choices: [{ message: { content: '  您好  ' } }] })
      }))
    );
    const chatAi = require('../../chatAi');
    const text = await chatAi.generateReply({
      systemPrompt: '你是客服',
      messages: [{ role: 'user', content: '你好' }]
    });
    expect(text).toBe('您好');
  });

  it('generateReply rejects invalid JSON body', async () => {
    process.env.CHAT_AI_API_KEY = 'sk-test';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => 'not-json'
      }))
    );
    const chatAi = require('../../chatAi');
    await expect(
      chatAi.generateReply({
        systemPrompt: 'sys',
        messages: [{ role: 'user', content: 'hi' }]
      })
    ).rejects.toThrow(/空内容|AI/);
  });
});
