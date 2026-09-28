import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const indirectEval = eval;

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0));
}

function bootMessageBadge() {
  document.body.innerHTML =
    '<div class="bottom-nav">' +
    '<a href="message.html" class="nav-item"><div class="nav-icon"></div></a>' +
    '</div>';
  indirectEval(readFileSync(resolve(__dirname, '../../public/js/message-badge.js'), 'utf8'));
  if (typeof window.refreshMessageUnreadBadge === 'function') {
    window.refreshMessageUnreadBadge();
  }
}

describe('message-badge.js', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.refreshMessageUnreadBadge;
    delete window.authFetch;
  });

  it('shows badge when unread_count > 0', async () => {
    window.authFetch = vi.fn().mockResolvedValue({
      json: async () => ({ code: 200, data: { unread: 5 } })
    });
    bootMessageBadge();
    await flushPromises();
    const badge = document.querySelector('.nav-unread-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('5');
    expect(badge.getAttribute('aria-label')).toBe('未读消息');
  });

  it('caps badge at 99+', async () => {
    window.authFetch = vi.fn().mockResolvedValue({
      json: async () => ({ code: 200, data: { unread: 120 } })
    });
    bootMessageBadge();
    await flushPromises();
    expect(document.querySelector('.nav-unread-badge').textContent).toBe('99+');
  });

  it('removes badge when unread is 0', async () => {
    window.authFetch = vi.fn().mockResolvedValue({
      json: async () => ({ code: 200, data: { unread: 2 } })
    });
    bootMessageBadge();
    await flushPromises();
    expect(document.querySelector('.nav-unread-badge')).toBeTruthy();
    window.authFetch.mockResolvedValue({
      json: async () => ({ code: 200, data: { unread: 0 } })
    });
    window.refreshMessageUnreadBadge();
    await flushPromises();
    expect(document.querySelector('.nav-unread-badge')).toBeFalsy();
  });

  it('no-op without authFetch', () => {
    document.body.innerHTML =
      '<div class="bottom-nav"><a href="message.html" class="nav-item"><div class="nav-icon"></div></a></div>';
    indirectEval(readFileSync(resolve(__dirname, '../../public/js/message-badge.js'), 'utf8'));
    expect(document.querySelector('.nav-unread-badge')).toBeFalsy();
  });
});
