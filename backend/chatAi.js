'use strict';

/**
 * OpenAI 兼容协议的客服 AI（DeepSeek / OpenAI / 通义等均可）。
 * 密钥仅从环境变量读取，禁止写入后台设置。
 */

function envText(name) {
  return String(process.env[name] || '').trim();
}

/** 判断客服 AI 是否已配置 API Key */
function isConfigured() {
  return !!envText('CHAT_AI_API_KEY');
}

/** 返回可对外展示的 AI 配置状态 */
function getPublicStatus() {
  var base = envText('CHAT_AI_BASE_URL') || 'https://api.deepseek.com';
  var host = '';
  try {
    host = new URL(base).host;
  } catch (e) {
    host = base.replace(/^https?:\/\//i, '').split('/')[0];
  }
  return {
    configured: isConfigured(),
    model: envText('CHAT_AI_MODEL') || 'deepseek-chat',
    base_host: host
  };
}

/** 清洗并截断 AI 回复文本 */
function sanitizeReplyText(raw, maxLen) {
  var s = raw != null ? String(raw).trim() : '';
  s = s.replace(/\u0000/g, '');
  var lim = maxLen != null ? maxLen : 2000;
  if (s.length > lim) s = s.substring(0, lim);
  return s;
}

/**
 * @param {{ systemPrompt: string, messages: Array<{role:string,content:string}> }} opts
 * @returns {Promise<string>}
 */
async function generateReply(opts) {
  var apiKey = envText('CHAT_AI_API_KEY');
  if (!apiKey) {
    throw new Error('未配置 CHAT_AI_API_KEY');
  }
  var base = (envText('CHAT_AI_BASE_URL') || 'https://api.deepseek.com').replace(/\/+$/, '');
  var model = envText('CHAT_AI_MODEL') || 'deepseek-chat';
  var timeoutMs = parseInt(process.env.CHAT_AI_TIMEOUT_MS || '20000', 10) || 20000;
  var systemPrompt = sanitizeReplyText(opts && opts.systemPrompt, 4000);
  if (!systemPrompt) {
    throw new Error('系统提示词为空');
  }
  var history = Array.isArray(opts && opts.messages) ? opts.messages : [];
  var apiMessages = [{ role: 'system', content: systemPrompt }];
  history.forEach(function (m) {
    if (!m || !m.content) return;
    var role = m.role === 'assistant' || m.role === 'user' ? m.role : 'user';
    var content = sanitizeReplyText(m.content, 2000);
    if (!content) return;
    apiMessages.push({ role: role, content: content });
  });
  if (apiMessages.length < 2) {
    throw new Error('无有效对话上下文');
  }

  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = null;
  if (controller) {
    timer = setTimeout(function () {
      try {
        controller.abort();
      } catch (e) {}
    }, timeoutMs);
  }

  var url = base + '/v1/chat/completions';
  var res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: apiMessages,
        temperature: 0.4,
        max_tokens: 800
      }),
      signal: controller ? controller.signal : undefined
    });
  } finally {
    if (timer) clearTimeout(timer);
  }

  var rawText = await res.text();
  var data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    var errMsg =
      (data && (data.error && data.error.message ? data.error.message : data.message)) ||
      'AI 接口 HTTP ' + res.status;
    throw new Error(String(errMsg).substring(0, 200));
  }
  var choice =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;
  var text = sanitizeReplyText(choice, 2000);
  if (!text) {
    throw new Error('AI 返回空内容');
  }
  return text;
}

module.exports = {
  isConfigured: isConfigured,
  getPublicStatus: getPublicStatus,
  sanitizeReplyText: sanitizeReplyText,
  generateReply: generateReply
};
