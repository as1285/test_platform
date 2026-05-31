/* admin/pages/feedback.js — feedback page */
var feedbackAdminPage = 1;
var feedbackAdminLimit = 15;
var feedbackAdminLastItems = [];
var feedbackReplyEditingId = null;

function closeFeedbackReplyModal() {
    var bd = document.getElementById('feedbackReplyBackdrop');
    if (bd) {
        bd.setAttribute('hidden', '');
    }
    feedbackReplyEditingId = null;
}

function openFeedbackReplyModal(row) {
    feedbackReplyEditingId = row.id;
    var meta =
        'ID #' +
        row.id +
        ' · 账号 ' +
        (row.user_id || '') +
        ' · ' +
        (row.real_name_snapshot || '—') +
        '\n\n用户原文：\n' +
        (row.content || '');
    document.getElementById('feedbackReplyMeta').textContent = meta;
    document.getElementById('feedbackReplyText').value =
        row.admin_reply != null ? String(row.admin_reply) : '';
    var bd = document.getElementById('feedbackReplyBackdrop');
    if (bd) {
        bd.removeAttribute('hidden');
    }
}

function loadAdminFeedbackPage(page) {
    if (page != null && isFinite(page)) {
        feedbackAdminPage = Math.max(1, parseInt(page, 10) || 1);
    }
    var typeF = document.getElementById('feedbackFilterType');
    var t = typeF ? typeF.value : '';
    var q =
        'api/admin/feedback?page=' +
        encodeURIComponent(feedbackAdminPage) +
        '&limit=' +
        encodeURIComponent(feedbackAdminLimit);
    if (t) {
        q += '&type=' + encodeURIComponent(t);
    }
    document.getElementById('feedbackAdminTbody').innerHTML =
        '<tr><td colspan="9">加载中…</td></tr>';
    adminFetch(q)
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                document.getElementById('feedbackAdminTbody').innerHTML =
                    '<tr><td colspan="9">' + esc(j.msg || '加载失败') + '</td></tr>';
                return;
            }
            var items = j.data.items || [];
            feedbackAdminLastItems = items;
            var total = j.data.total != null ? Number(j.data.total) : 0;
            var tp = j.data.total_pages != null ? Number(j.data.total_pages) : 1;
            if (tp < 1) {
                tp = 1;
            }
            document.getElementById('feedbackAdminPageInfo').textContent =
                '第 ' + feedbackAdminPage + ' / ' + tp + ' 页 · 共 ' + total + ' 条';
            var prev = document.getElementById('feedbackAdminPrev');
            var next = document.getElementById('feedbackAdminNext');
            if (prev) {
                prev.disabled = feedbackAdminPage <= 1;
            }
            if (next) {
                next.disabled = feedbackAdminPage >= tp;
            }
            var html = '';
            if (!items.length) {
                html = '<tr><td colspan="9">暂无数据</td></tr>';
            } else {
                items.forEach(function (r) {
                    var typLabel = r.feedback_type === 'bug' ? 'BUG' : '意见优化';
                    var snippet = String(r.content || '');
                    if (snippet.length > 100) {
                        snippet = snippet.substring(0, 100) + '…';
                    }
                    var hasReply = r.admin_reply && String(r.admin_reply).trim();
                    var repSnippet = hasReply ? String(r.admin_reply) : '';
                    if (repSnippet.length > 60) {
                        repSnippet = repSnippet.substring(0, 60) + '…';
                    }
                    html += '<tr>';
                    html += '<td>' + esc(String(r.id)) + '</td>';
                    html += '<td class="cell-break">' + esc(r.user_id || '') + '</td>';
                    html += '<td>' + esc(r.real_name_snapshot || '—') + '</td>';
                    html += '<td>' + esc(typLabel) + '</td>';
                    html += '<td class="cell-break">' + esc(snippet) + '</td>';
                    html += '<td>' + esc(formatDt(r.created_at)) + '</td>';
                    html += '<td>' + esc(hasReply ? '已回复' : '待回复') + '</td>';
                    html +=
                        '<td class="cell-break">' + esc(hasReply ? repSnippet : '—') + '</td>';
                    html +=
                        '<td><button type="button" class="btn-sm btn-copy" data-feedback-id="' +
                        esc(String(r.id)) +
                        '">' +
                        esc(hasReply ? '修改回复' : '回复') +
                        '</button></td>';
                    html += '</tr>';
                });
            }
            document.getElementById('feedbackAdminTbody').innerHTML = html;
        })
        .catch(function () {
            document.getElementById('feedbackAdminTbody').innerHTML =
                '<tr><td colspan="9">网络错误</td></tr>';
        });
}
