/** 在线客服模块（按需加载） */
        var chatAdminPage = 1;
        var chatAdminLimit = 20;
        var chatAdminActiveId = 0;
        var chatAdminLastMsgId = 0;
        var chatAdminKnownIds = {};
        var chatAdminPollTimer = null;
        var chatAdminSending = false;
        var chatAutoReplyDefaults = { welcome: '', reply: '', ai_prompt: '' };

        function escapeChatHtml(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function formatChatTime(iso) {
            if (!iso) return '';
            try {
                var d = new Date(iso);
                if (isNaN(d.getTime())) return '';
                var pad = function (n) {
                    return n < 10 ? '0' + n : String(n);
                };
                return (
                    pad(d.getMonth() + 1) +
                    '-' +
                    pad(d.getDate()) +
                    ' ' +
                    pad(d.getHours()) +
                    ':' +
                    pad(d.getMinutes())
                );
            } catch (e) {
                return '';
            }
        }

        function stopAdminChatPoll() {
            if (chatAdminPollTimer) {
                clearInterval(chatAdminPollTimer);
                chatAdminPollTimer = null;
            }
        }

        function startAdminChatPoll() {
            stopAdminChatPoll();
            chatAdminPollTimer = setInterval(function () {
                if (normalizeAdminPage(location.hash) !== 'chat') {
                    stopAdminChatPoll();
                    return;
                }
                loadAdminChatConversations(chatAdminPage, true);
                if (chatAdminActiveId) {
                    loadAdminChatThread(chatAdminActiveId, true);
                }
            }, 4000);
        }

        function updateChatAiStatusHint(ai) {
            var hint = document.getElementById('chatAiStatusHint');
            if (!hint) return;
            if (!ai || !ai.configured) {
                hint.textContent =
                    '未检测到 CHAT_AI_API_KEY：请在服务器 .env 配置密钥后重新部署后端；当前开启仅保存开关，不会实际调用。';
                hint.style.color = '#b45309';
                return;
            }
            hint.textContent =
                '已配置 · 模型 ' +
                (ai.model || '-') +
                ' · 接口 ' +
                (ai.base_host || '-') +
                '（密钥仅存环境变量，不会显示在此）';
            hint.style.color = '#047857';
        }

        function loadAdminChatAutoReply() {
            adminFetch('api/admin/chat/auto-reply')
                .then(function (r) {
                    return r.json();
                })
                .then(function (body) {
                    if (!body || body.code !== 200 || !body.data) return;
                    var d = body.data;
                    if (d.defaults) {
                        chatAutoReplyDefaults = {
                            welcome: d.defaults.welcome || '',
                            reply: d.defaults.reply || '',
                            ai_prompt: d.defaults.ai_prompt || ''
                        };
                    }
                    var w = document.getElementById('chatAutoReplyWelcome');
                    var rp = document.getElementById('chatAutoReplyReply');
                    var aiEn = document.getElementById('chatAiEnabled');
                    var aiPrompt = document.getElementById('chatAiPrompt');
                    if (w) w.value = d.welcome != null ? String(d.welcome) : '';
                    if (rp) rp.value = d.reply != null ? String(d.reply) : '';
                    if (aiEn) aiEn.checked = !!d.ai_enabled;
                    if (aiPrompt) {
                        aiPrompt.value =
                            d.ai_prompt != null ? String(d.ai_prompt) : chatAutoReplyDefaults.ai_prompt || '';
                    }
                    updateChatAiStatusHint(d.ai);
                })
                .catch(function () {});
        }

        function saveAdminChatAutoReply() {
            var w = document.getElementById('chatAutoReplyWelcome');
            var rp = document.getElementById('chatAutoReplyReply');
            var aiEn = document.getElementById('chatAiEnabled');
            var aiPrompt = document.getElementById('chatAiPrompt');
            var btn = document.getElementById('btnSaveChatAutoReply');
            if (btn) btn.disabled = true;
            adminFetch('api/admin/chat/auto-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    welcome: w ? w.value : '',
                    reply: rp ? rp.value : '',
                    ai_enabled: !!(aiEn && aiEn.checked),
                    ai_prompt: aiPrompt ? aiPrompt.value : ''
                })
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (body) {
                    if (!body || body.code !== 200) {
                        throw new Error((body && body.msg) || '保存失败');
                    }
                    alert('客服自动回复设置已保存');
                    if (body.data) {
                        if (w && body.data.welcome != null) w.value = String(body.data.welcome);
                        if (rp && body.data.reply != null) rp.value = String(body.data.reply);
                        if (aiEn) aiEn.checked = !!body.data.ai_enabled;
                        if (aiPrompt && body.data.ai_prompt != null) {
                            aiPrompt.value = String(body.data.ai_prompt);
                        }
                        updateChatAiStatusHint(body.data.ai);
                    }
                })
                .catch(function (e) {
                    alert(String(e && e.message ? e.message : e) || '保存失败');
                })
                .then(function () {
                    if (btn) btn.disabled = false;
                });
        }

        function loadAdminChatConversations(page, quiet) {
            if (page != null) {
                chatAdminPage = Math.max(1, parseInt(page, 10) || 1);
            }
            var unreadEl = document.getElementById('chatAdminFilterUnread');
            var qEl = document.getElementById('chatAdminSearchQ');
            var unread = unreadEl ? unreadEl.value : '';
            var q = qEl ? String(qEl.value || '').trim() : '';
            var url =
                'api/admin/chat/conversations?page=' +
                encodeURIComponent(chatAdminPage) +
                '&limit=' +
                encodeURIComponent(chatAdminLimit);
            if (unread === '1') url += '&unread=1';
            if (q) url += '&q=' + encodeURIComponent(q);
            if (!quiet) {
                document.getElementById('chatAdminConvTbody').innerHTML =
                    '<tr><td colspan="3">加载中…</td></tr>';
            }
            adminFetch(url)
                .then(function (r) {
                    return r.json();
                })
                .then(function (body) {
                    if (!body || body.code !== 200) {
                        throw new Error((body && body.msg) || '加载失败');
                    }
                    var data = body.data || {};
                    var items = Array.isArray(data.items) ? data.items : [];
                    var total = Number(data.total) || 0;
                    var tp = Number(data.total_pages) || 1;
                    document.getElementById('chatAdminPageInfo').textContent =
                        '第 ' + chatAdminPage + ' / ' + tp + ' 页 · 共 ' + total + ' 条';
                    var prev = document.getElementById('chatAdminPrev');
                    var next = document.getElementById('chatAdminNext');
                    if (prev) prev.disabled = chatAdminPage <= 1;
                    if (next) next.disabled = chatAdminPage >= tp;
                    if (!items.length) {
                        document.getElementById('chatAdminConvTbody').innerHTML =
                            '<tr><td colspan="3">暂无会话</td></tr>';
                        return;
                    }
                    var html = items
                        .map(function (r) {
                            var unreadN = Number(r.admin_unread) || 0;
                            var activeCls = Number(r.id) === chatAdminActiveId ? ' is-active' : '';
                            var preview = escapeChatHtml(r.last_message_preview || '（暂无消息）');
                            var name = escapeChatHtml(r.real_name_snapshot || '—');
                            return (
                                '<tr class="chat-conv-row' +
                                activeCls +
                                '" data-conv-id="' +
                                Number(r.id) +
                                '">' +
                                '<td><div>' +
                                escapeChatHtml(r.user_id || '') +
                                '</div><div style="color:#888;font-size:12px;">' +
                                name +
                                (r.account_active ? '' : ' · 未激活') +
                                '</div></td>' +
                                '<td>' +
                                (unreadN > 0
                                    ? '<span class="admin-chat-unread">' + unreadN + '</span>'
                                    : '—') +
                                '</td>' +
                                '<td><div style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                                preview +
                                '</div><div style="color:#999;font-size:11px;">' +
                                escapeChatHtml(formatChatTime(r.last_message_at)) +
                                '</div></td></tr>'
                            );
                        })
                        .join('');
                    document.getElementById('chatAdminConvTbody').innerHTML = html;
                })
                .catch(function (e) {
                    if (!quiet) {
                        document.getElementById('chatAdminConvTbody').innerHTML =
                            '<tr><td colspan="3">' +
                            escapeChatHtml(String(e && e.message ? e.message : e)) +
                            '</td></tr>';
                    }
                });
        }

        function appendAdminChatMessages(messages, forceScroll) {
            var bodyEl = document.getElementById('chatAdminThreadBody');
            if (!bodyEl || !messages || !messages.length) return;
            var nearBottom =
                bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 90;
            messages.forEach(function (m) {
                var id = Number(m.id);
                if (!id || chatAdminKnownIds[id]) return;
                chatAdminKnownIds[id] = 1;
                if (id > chatAdminLastMsgId) chatAdminLastMsgId = id;
                var isAdmin = m.sender_role === 'admin' || m.sender_role === 'system';
                var isAi = m.sender_id === 'ai_reply';
                var row = document.createElement('div');
                row.className =
                    'admin-chat-bubble-row ' + (isAdmin ? 'me' : 'them') + (isAi ? ' ai' : '');
                var who =
                    m.sender_id === 'ai_reply'
                        ? 'AI 客服'
                        : m.sender_role === 'system' || m.sender_id === 'auto_reply'
                          ? '自动回复'
                          : isAdmin
                            ? '客服'
                            : '用户';
                row.innerHTML =
                    '<div><div class="admin-chat-bubble">' +
                    escapeChatHtml(m.content) +
                    '</div><div class="admin-chat-bubble-meta">' +
                    escapeChatHtml(formatChatTime(m.created_at)) +
                    ' · ' +
                    who +
                    '</div></div>';
                bodyEl.appendChild(row);
            });
            if (forceScroll || nearBottom) {
                bodyEl.scrollTop = bodyEl.scrollHeight;
            }
        }

        function loadAdminChatThread(conversationId, isPoll) {
            var cid = Number(conversationId) || 0;
            if (!cid) return;
            var url =
                'api/admin/chat/messages?conversation_id=' +
                encodeURIComponent(cid) +
                (isPoll && chatAdminLastMsgId > 0
                    ? '&after_id=' + encodeURIComponent(chatAdminLastMsgId)
                    : '');
            adminFetch(url)
                .then(function (r) {
                    return r.json();
                })
                .then(function (body) {
                    if (!body || body.code !== 200) {
                        throw new Error((body && body.msg) || '加载失败');
                    }
                    var data = body.data || {};
                    var conv = data.conversation || {};
                    chatAdminActiveId = Number(conv.id) || cid;
                    var titleEl = document.getElementById('chatAdminThreadTitle');
                    if (titleEl) {
                        titleEl.textContent =
                            (conv.user_id || '') +
                            ' · ' +
                            (conv.real_name_snapshot || '—') +
                            (conv.account_active ? ' · 已激活' : ' · 未激活') +
                            (conv.bot_paused ? ' · AI 已暂停' : '');
                    }
                    var resumeBtn = document.getElementById('chatAdminResumeAiBtn');
                    if (resumeBtn) {
                        if (conv.bot_paused) {
                            resumeBtn.hidden = false;
                        } else {
                            resumeBtn.hidden = true;
                        }
                    }
                    var input = document.getElementById('chatAdminInput');
                    var sendBtn = document.getElementById('chatAdminSendBtn');
                    if (input) input.disabled = false;
                    if (sendBtn) sendBtn.disabled = false;
                    if (!isPoll) {
                        chatAdminKnownIds = {};
                        chatAdminLastMsgId = 0;
                        var bodyEl = document.getElementById('chatAdminThreadBody');
                        if (bodyEl) bodyEl.innerHTML = '';
                    }
                    appendAdminChatMessages(data.messages || [], !isPoll);
                })
                .catch(function (e) {
                    if (!isPoll) {
                        alert(String(e && e.message ? e.message : e) || '加载会话失败');
                    }
                });
        }

        function resumeAdminChatAi() {
            if (!chatAdminActiveId) return;
            var resumeBtn = document.getElementById('chatAdminResumeAiBtn');
            if (resumeBtn) resumeBtn.disabled = true;
            adminFetch('api/admin/chat/bot-paused', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: chatAdminActiveId,
                    bot_paused: false
                })
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (body) {
                    if (!body || body.code !== 200) {
                        throw new Error((body && body.msg) || '操作失败');
                    }
                    var conv = (body.data && body.data.conversation) || {};
                    var titleEl = document.getElementById('chatAdminThreadTitle');
                    if (titleEl && conv.user_id) {
                        titleEl.textContent =
                            (conv.user_id || '') +
                            ' · ' +
                            (conv.real_name_snapshot || '—') +
                            (conv.account_active ? ' · 已激活' : ' · 未激活');
                    }
                    if (resumeBtn) resumeBtn.hidden = true;
                })
                .catch(function (e) {
                    alert(String(e && e.message ? e.message : e) || '恢复失败');
                })
                .then(function () {
                    if (resumeBtn) resumeBtn.disabled = false;
                });
        }

        function sendAdminChatMessage() {
            if (chatAdminSending || !chatAdminActiveId) return;
            var input = document.getElementById('chatAdminInput');
            var content = input ? String(input.value || '').trim() : '';
            if (!content) return;
            chatAdminSending = true;
            var sendBtn = document.getElementById('chatAdminSendBtn');
            if (sendBtn) sendBtn.disabled = true;
            adminFetch('api/admin/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: chatAdminActiveId,
                    content: content
                })
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (body) {
                    if (!body || body.code !== 200) {
                        throw new Error((body && body.msg) || '发送失败');
                    }
                    if (input) input.value = '';
                    if (body.data && body.data.message) {
                        appendAdminChatMessages([body.data.message], true);
                    }
                    if (body.data && body.data.conversation) {
                        var conv = body.data.conversation;
                        var titleEl = document.getElementById('chatAdminThreadTitle');
                        if (titleEl) {
                            titleEl.textContent =
                                (conv.user_id || '') +
                                ' · ' +
                                (conv.real_name_snapshot || '—') +
                                (conv.account_active ? ' · 已激活' : ' · 未激活') +
                                (conv.bot_paused ? ' · AI 已暂停' : '');
                        }
                        var resumeBtn = document.getElementById('chatAdminResumeAiBtn');
                        if (resumeBtn) resumeBtn.hidden = !conv.bot_paused;
                    }
                    loadAdminChatConversations(chatAdminPage, true);
                })
                .catch(function (e) {
                    alert(String(e && e.message ? e.message : e) || '发送失败');
                })
                .then(function () {
                    chatAdminSending = false;
                    if (sendBtn) sendBtn.disabled = false;
                    if (input) input.focus();
                });
        }

