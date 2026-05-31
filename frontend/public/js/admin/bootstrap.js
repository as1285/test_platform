/* admin/bootstrap.js — event bindings & init */
var userPageLimitSel = document.getElementById('userPageLimit');
if (userPageLimitSel) {
    userPageLimitSel.onchange = function () {
        var n = parseInt(this.value, 10);
        userLimit = USER_LIMIT_OPTIONS.indexOf(n) >= 0 ? n : 10;
        this.value = String(userLimit);
        try {
            localStorage.setItem(USER_LIMIT_STORAGE_KEY, String(userLimit));
        } catch (e) {}
        loadUsers(1);
    };
}

document.getElementById('btnSearchUsers').onclick = function() { loadUsers(1); };
var btnSearchUserData = document.getElementById('btnSearchUserData');
if (btnSearchUserData) {
    btnSearchUserData.onclick = function () {
        loadUserDataList(1);
    };
}
var btnResetUserData = document.getElementById('btnResetUserData');
if (btnResetUserData) {
    btnResetUserData.onclick = function () {
        document.getElementById('udFilterUsername').value = '';
        document.getElementById('udFilterRealName').value = '';
        document.getElementById('udFilterCompany').value = '';
        document.getElementById('udFilterFamily').value = '';
        document.getElementById('udFilterBank').value = '';
        document.getElementById('udFilterSalaryMin').value = '';
        document.getElementById('udFilterSalaryMax').value = '';
        loadUserDataList(1);
    };
}
var btnRefreshUserDataAnalytics = document.getElementById('btnRefreshUserDataAnalytics');
if (btnRefreshUserDataAnalytics) {
    btnRefreshUserDataAnalytics.onclick = function () {
        loadUserDataAnalytics();
    };
}
var btnRefreshUdGender = document.getElementById('btnRefreshUdGender');
if (btnRefreshUdGender) {
    btnRefreshUdGender.onclick = function () {
        loadUdGenderCharts();
    };
}
var udGenderDays = document.getElementById('udGenderDays');
if (udGenderDays) {
    udGenderDays.addEventListener('change', function () {
        loadUdGenderCharts();
    });
}
var udGenderSection = document.getElementById('udGenderSection');
if (udGenderSection) {
    udGenderSection.addEventListener('toggle', function () {
        if (udGenderSection.open) {
            loadUdGenderCharts();
        }
    });
}
var udFemaleAgeSection = document.getElementById('udFemaleAgeSection');
if (udFemaleAgeSection) {
    udFemaleAgeSection.addEventListener('toggle', function () {
        if (udFemaleAgeSection.open) {
            loadUdFemaleAge();
        }
    });
}
var userDataPrev = document.getElementById('userDataPrev');
if (userDataPrev) {
    userDataPrev.onclick = function () {
        if (userDataPage > 1) loadUserDataList(userDataPage - 1);
    };
}
var userDataNext = document.getElementById('userDataNext');
if (userDataNext) {
    userDataNext.onclick = function () {
        loadUserDataList(userDataPage + 1);
    };
}
var btnRefreshNoTaxBehavior = document.getElementById('btnRefreshNoTaxBehavior');
if (btnRefreshNoTaxBehavior) {
    btnRefreshNoTaxBehavior.onclick = function () {
        loadNoTaxBehaviorList(noTaxBehaviorPage);
    };
}
var btnExportNoTaxBehavior = document.getElementById('btnExportNoTaxBehavior');
if (btnExportNoTaxBehavior) {
    btnExportNoTaxBehavior.onclick = function () {
        exportNoTaxBehaviorCsv();
    };
}
var udNoTaxPrev = document.getElementById('udNoTaxPrev');
if (udNoTaxPrev) {
    udNoTaxPrev.onclick = function () {
        if (noTaxBehaviorPage > 1) loadNoTaxBehaviorList(noTaxBehaviorPage - 1);
    };
}
var udNoTaxNext = document.getElementById('udNoTaxNext');
if (udNoTaxNext) {
    udNoTaxNext.onclick = function () {
        loadNoTaxBehaviorList(noTaxBehaviorPage + 1);
    };
}
document.getElementById('btnResetUsers').onclick = function() {
    document.getElementById('filterUsername').value = '';
    document.getElementById('filterRealName').value = '';
    document.getElementById('filterActive').value = '';
    document.getElementById('filterBanned').value = '';
    var exactEl = document.getElementById('filterExact');
    if (exactEl) exactEl.checked = false;
    var riskEl = document.getElementById('filterRisk');
    if (riskEl) riskEl.value = '';
    var salaryMinEl = document.getElementById('filterSalaryMin');
    var salaryMaxEl = document.getElementById('filterSalaryMax');
    if (salaryMinEl) salaryMinEl.value = '';
    if (salaryMaxEl) salaryMaxEl.value = '';
    var taxModReset = document.getElementById('filterTaxModifiedToday');
    if (taxModReset) taxModReset.value = '';
    loadUsers(1);
};

function purgeBotsPayload(dryRun) {
    return {
        dry_run: !!dryRun,
        mode: 'delete',
        start_bj: '2026-05-22 00:00:00',
        end_bj: '2026-05-22 01:00:00',
        only_eight_char: true,
        only_inactive: true
    };
}

function runPurgeBotsPreview() {
    var stat = document.getElementById('purgeBotsStat');
    if (stat) {
        stat.style.display = 'block';
        stat.textContent = '正在统计待清理刷号账号…';
    }
    adminFetch('api/admin/users/purge-bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purgeBotsPayload(true))
    })
        .then(function (r) { return r.json(); })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                if (stat) stat.textContent = '预览失败：' + (j.msg || '');
                return;
            }
            var d = j.data;
            if (stat) {
                stat.textContent =
                    '预览：' +
                    (d.window ? d.window.start_bj + ' ~ ' + d.window.end_bj : '') +
                    ' 内匹配 ' +
                    (d.matched != null ? d.matched : 0) +
                    ' 个账号（8位随机名、未激活）。点击「执行删除刷号」将永久删除。';
            }
        })
        .catch(function () {
            if (stat) stat.textContent = '预览失败（网络错误）';
        });
}

function runPurgeBotsExecute() {
    var stat = document.getElementById('purgeBotsStat');
    if (
        !confirm(
            '确定永久删除 2026-05-22 00:00–01:00（北京）内、8位随机字母数字账号名且未激活的刷号账号？\n此操作不可恢复，建议先点「预览清理刷号」。'
        )
    ) {
        return;
    }
    if (stat) {
        stat.style.display = 'block';
        stat.textContent = '正在批量删除，请稍候…';
    }
    adminFetch('api/admin/users/purge-bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purgeBotsPayload(false))
    })
        .then(function (r) { return r.json(); })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                alert(j.msg || '删除失败');
                if (stat) stat.textContent = '删除失败：' + (j.msg || '');
                return;
            }
            var d = j.data;
            if (stat) {
                stat.textContent =
                    '已删除 ' + (d.deleted != null ? d.deleted : 0) + ' 个账号（匹配 ' + (d.matched != null ? d.matched : 0) + '）。';
            }
            alert('清理完成：已删除 ' + (d.deleted != null ? d.deleted : 0) + ' 个账号');
            loadUsers(1);
        })
        .catch(function () {
            alert('网络错误');
            if (stat) stat.textContent = '删除失败（网络错误）';
        });
}

var btnPurgeBotsPreview = document.getElementById('btnPurgeBotsPreview');
if (btnPurgeBotsPreview) btnPurgeBotsPreview.onclick = runPurgeBotsPreview;
var btnPurgeBotsRun = document.getElementById('btnPurgeBotsRun');
if (btnPurgeBotsRun) btnPurgeBotsRun.onclick = runPurgeBotsExecute;

document.getElementById('codePrev').onclick = function() { if (codePage > 1) loadCodes(codePage - 1); };
document.getElementById('codeNext').onclick = function() { loadCodes(codePage + 1); };
var xianyuPrev = document.getElementById('xianyuCodePrev');
var xianyuNext = document.getElementById('xianyuCodeNext');
if (xianyuPrev) {
    xianyuPrev.onclick = function() {
        if (xianyuCodePage > 1) {
            loadXianyuCodes(xianyuCodePage - 1);
        }
    };
}
if (xianyuNext) {
    xianyuNext.onclick = function() {
        loadXianyuCodes(xianyuCodePage + 1);
    };
}

function bindCodeCopyDelegation(tbodyId) {
    var el = document.getElementById(tbodyId);
    if (!el || el.getAttribute('data-copy-bound') === '1') {
        return;
    }
    el.setAttribute('data-copy-bound', '1');
    el.addEventListener('click', function (e) {
        var btn = e.target.closest('.btn-copy-code');
        if (!btn) {
            return;
        }
        var code = btn.getAttribute('data-code');
        if (code) {
            copyCode(code);
        }
    });
}
bindCodeCopyDelegation('codeTbody');
bindCodeCopyDelegation('xianyuCodeTbody');

document.getElementById('btnIssue').addEventListener('click', function () {
    var btn = document.getElementById('btnIssue');
    btn.disabled = true;
    adminFetch('api/admin/issue-code', {
        method: 'POST',
        body: JSON.stringify({})
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.code === 200 && data.data && data.data.code) {
                var el = document.getElementById('issueOut');
                el.textContent = '激活码：' + data.data.code + '（单次有效、永不过期，仅可激活一个账号）';
                el.classList.add('show');
                loadCodes(1);
            } else {
                alert(data.msg || '生成失败');
            }
        })
        .catch(function () { alert('网络错误'); })
        .finally(function () { btn.disabled = false; });
});

var btnIssueBatch100 = document.getElementById('btnIssueBatch100');
if (btnIssueBatch100) {
    btnIssueBatch100.addEventListener('click', function () {
        if (
            !confirm(
                '将一次性生成 100 个激活码（备注：闲鱼批量），写入数据库并下载 TXT 文件。是否继续？'
            )
        ) {
            return;
        }
        btnIssueBatch100.disabled = true;
        adminFetch('api/admin/issue-code-batch', {
            method: 'POST',
            body: JSON.stringify({ count: 100, note: '闲鱼批量' })
        })
            .then(function (r) {
                return r.json();
            })
            .then(function (data) {
                if (data.code === 200 && data.data && data.data.codes && data.data.codes.length) {
                    var el = document.getElementById('issueOut');
                    if (el) {
                        el.textContent =
                            '已批量生成 ' +
                            data.data.count +
                            ' 个激活码（闲鱼批量），正在下载 TXT…';
                        el.classList.add('show');
                    }
                    downloadActivationCodesTxt(data.data.codes, {
                        generated_at: formatLocalDateTimeForExport(
                            data.data.generated_at
                                ? new Date(data.data.generated_at)
                                : new Date()
                        ),
                        owner_admin:
                            currentAdminProfile && currentAdminProfile.username
                                ? String(currentAdminProfile.username)
                                : '—'
                    });
                    loadCodes(1);
                    loadXianyuCodes(1);
                    alert('已生成 ' + data.data.count + ' 个激活码，TXT 已下载');
                } else {
                    alert(data.msg || '批量生成失败');
                }
            })
            .catch(function () {
                alert('网络错误');
            })
            .finally(function () {
                btnIssueBatch100.disabled = false;
            });
    });
}

document.getElementById('btnRefreshCodes').addEventListener('click', function() {
    loadCodes(1);
});
var btnRefreshXianyuCodes = document.getElementById('btnRefreshXianyuCodes');
if (btnRefreshXianyuCodes) {
    btnRefreshXianyuCodes.addEventListener('click', function () {
        loadXianyuCodes(1);
    });
}
document.getElementById('btnSearchCodes').addEventListener('click', function() { loadCodes(1); });
var btnSearchXianyuCodes = document.getElementById('btnSearchXianyuCodes');
if (btnSearchXianyuCodes) {
    btnSearchXianyuCodes.addEventListener('click', function () {
        loadXianyuCodes(1);
    });
}
document.getElementById('btnResetCodesFilter').addEventListener('click', function () {
    var input = document.getElementById('codeOwnerAdminFilter');
    if (input) input.value = '';
    var usedInput = document.getElementById('codeUsedByFilter');
    if (usedInput) usedInput.value = '';
    var usedExactEl = document.getElementById('codeUsedByExact');
    if (usedExactEl) usedExactEl.checked = false;
    var usageFilterReset = document.getElementById('codeUsageFilter');
    if (usageFilterReset) usageFilterReset.value = '';
    var codeFilterReset = document.getElementById('codeCodeFilter');
    if (codeFilterReset) codeFilterReset.value = '';
    var codeExactReset = document.getElementById('codeCodeExact');
    if (codeExactReset) codeExactReset.checked = false;
    loadCodes(1);
});
var btnResetXianyuCodesFilter = document.getElementById('btnResetXianyuCodesFilter');
if (btnResetXianyuCodesFilter) {
    btnResetXianyuCodesFilter.addEventListener('click', function () {
        var xyOwner = document.getElementById('xianyuCodeOwnerAdminFilter');
        if (xyOwner) xyOwner.value = '';
        var xyUsed = document.getElementById('xianyuCodeUsedByFilter');
        if (xyUsed) xyUsed.value = '';
        var xyUsedExact = document.getElementById('xianyuCodeUsedByExact');
        if (xyUsedExact) xyUsedExact.checked = false;
        var xyUsage = document.getElementById('xianyuCodeUsageFilter');
        if (xyUsage) xyUsage.value = '';
        var xyCode = document.getElementById('xianyuCodeCodeFilter');
        if (xyCode) xyCode.value = '';
        var xyCodeExact = document.getElementById('xianyuCodeCodeExact');
        if (xyCodeExact) xyCodeExact.checked = false;
        loadXianyuCodes(1);
    });
}

document.getElementById('btnRefreshAdminAccounts').addEventListener('click', function () {
    loadAdminAccounts();
});
document.getElementById('btnCreateAdminAccount').addEventListener('click', function () {
    var username = document.getElementById('adminAccUsername').value.trim();
    var fullName = document.getElementById('adminAccFullName').value.trim();
    var password = document.getElementById('adminAccPassword').value;
    var menus = selectedMenusFromRoot(document.getElementById('adminAccountMenuSelector'));
    if (!username || !password || !fullName) {
        alert('请填写账号、姓名和密码');
        return;
    }
    adminFetch('api/admin/accounts/create', {
        method: 'POST',
        body: JSON.stringify({ username: username, full_name: fullName, password: password, menus: menus })
    })
        .then(function (r) { return r.json(); })
        .then(function (j) {
            if (j.code === 200) {
                document.getElementById('adminAccUsername').value = '';
                document.getElementById('adminAccFullName').value = '';
                document.getElementById('adminAccPassword').value = '';
                loadAdminAccounts();
                alert('新增成功');
            } else {
                alert(j.msg || '新增失败');
            }
        })
        .catch(function () {
            alert('网络错误');
        });
});

document.getElementById('adminAccountTbody').addEventListener('click', function (e) {
    var detailBtn = e.target.closest('.btn-admin-account-detail');
    if (detailBtn) {
        var unameD = detailBtn.getAttribute('data-username');
        var keyD = keyForAdminAccount(unameD);
        var rowD = document.getElementById('admin_acc_detail_row_' + keyD);
        var boxD = document.getElementById('admin_acc_detail_box_' + keyD);
        if (!rowD || !boxD) return;
        var openingD = rowD.style.display === 'none';
        if (!openingD) {
            rowD.style.display = 'none';
            detailBtn.textContent = '详情';
            return;
        }
        rowD.style.display = '';
        detailBtn.textContent = '收起';
        if (boxD.getAttribute('data-loaded') === '1') return;
        loadAdminAccountActivatedUsers(unameD, 1, boxD);
        return;
    }
    var actPrev = e.target.closest('.admin-acc-act-prev');
    if (actPrev && !actPrev.disabled) {
        var ownerP = actPrev.getAttribute('data-owner');
        var boxP = actPrev.closest('[id^="admin_acc_detail_box_"]');
        if (!boxP || !ownerP) return;
        var pageP = (parseInt(boxP.getAttribute('data-page'), 10) || 1) - 1;
        loadAdminAccountActivatedUsers(ownerP, pageP, boxP);
        return;
    }
    var actNext = e.target.closest('.admin-acc-act-next');
    if (actNext && !actNext.disabled) {
        var ownerN = actNext.getAttribute('data-owner');
        var boxN = actNext.closest('[id^="admin_acc_detail_box_"]');
        if (!boxN || !ownerN) return;
        var pageN = (parseInt(boxN.getAttribute('data-page'), 10) || 1) + 1;
        loadAdminAccountActivatedUsers(ownerN, pageN, boxN);
        return;
    }
    var editBtn = e.target.closest('.btn-admin-account-edit');
    if (editBtn) {
        var uname = editBtn.getAttribute('data-username');
        var row = document.querySelector('.admin-account-menu-row[data-username="' + uname + '"]');
        var pwdInput = document.querySelector('.admin-account-newpwd[data-username="' + uname + '"]');
        var fullNameInput = document.querySelector('.admin-account-fullname[data-username="' + uname + '"]');
        var menus = selectedMenusFromRoot(row);
        var newPassword = pwdInput ? String(pwdInput.value || '') : '';
        var fullName = fullNameInput ? String(fullNameInput.value || '').trim() : '';
        adminFetch('api/admin/accounts/update', {
            method: 'POST',
            body: JSON.stringify({
                username: uname,
                full_name: fullName,
                menus: menus,
                password: newPassword
            })
        })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (j.code === 200) {
                    if (pwdInput) pwdInput.value = '';
                    loadAdminAccounts();
                    alert('已更新');
                } else {
                    alert(j.msg || '更新失败');
                }
            })
            .catch(function () {
                alert('网络错误');
            });
        return;
    }
    var delBtn = e.target.closest('.btn-admin-account-del');
    if (delBtn) {
        var uname2 = delBtn.getAttribute('data-username');
        if (!confirm('确认删除后台账号「' + uname2 + '」吗？')) return;
        adminFetch('api/admin/accounts/delete', {
            method: 'POST',
            body: JSON.stringify({ username: uname2 })
        })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (j.code === 200) {
                    loadAdminAccounts();
                    alert('已删除');
                } else {
                    alert(j.msg || '删除失败');
                }
            })
            .catch(function () {
                alert('网络错误');
            });
    }
});

function updateWechatPayQrPreview(displayUrl) {
    var wrap = document.getElementById('wechatPayQrPreviewWrap');
    var img = document.getElementById('wechatPayQrPreview');
    if (!wrap || !img) return;
    var u = displayUrl != null ? String(displayUrl).trim() : '';
    if (!u) {
        wrap.hidden = true;
        img.removeAttribute('src');
        return;
    }
    img.src = u;
    wrap.hidden = false;
}

function loadAdminSettings() {
    adminFetch('api/admin/settings')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.code === 200 && data.data) {
                var qrEl = document.getElementById('wechatPayQrcodeUrl');
                if (qrEl) {
                    qrEl.value =
                        data.data.wechat_pay_qrcode_url != null
                            ? String(data.data.wechat_pay_qrcode_url)
                            : '';
                }
                updateWechatPayQrPreview(
                    data.data.wechat_pay_qrcode_display_url ||
                        (qrEl && qrEl.value ? '/' + String(qrEl.value).replace(/^\//, '') : '')
                );
                var qqEl = document.getElementById('qqAddUrl');
                if (qqEl && data.data.qq_add_url != null) {
                    qqEl.value = String(data.data.qq_add_url);
                }
                var ab = data.data.conversion_ab;
                if (ab) {
                    var enEl = document.getElementById('convAbEnabled');
                    if (enEl) enEl.checked = ab.enabled !== false;
                    var map = [
                        ['convAbTitleA', 'activate_title_a'],
                        ['convAbSubtitleA', 'activate_subtitle_a'],
                        ['convAbTitleB', 'activate_title_b'],
                        ['convAbSubtitleB', 'activate_subtitle_b']
                    ];
                    map.forEach(function (pair) {
                        var el = document.getElementById(pair[0]);
                        if (el && ab[pair[1]] != null) el.value = String(ab[pair[1]]);
                    });
                    var bp = document.getElementById('convAbBatchProminent');
                    if (bp) bp.checked = ab.batch_example_prominent === true;
                }
            }
            if (data.code === 200 && data.data) {
                var apkEl = document.getElementById('androidApkDownloadUrl');
                var iosEl = document.getElementById('iosMobileconfigDownloadUrl');
                if (apkEl && data.data.android_apk_download_url != null) {
                    apkEl.value = String(data.data.android_apk_download_url);
                }
                if (iosEl && data.data.ios_mobileconfig_download_url != null) {
                    iosEl.value = String(data.data.ios_mobileconfig_download_url);
                }
                var xyEl = document.getElementById('xianyuPurchaseUrl');
                if (xyEl && data.data.xianyu_purchase_url != null) {
                    xyEl.value = String(data.data.xianyu_purchase_url);
                }
            }
            if (data.code === 200 && data.data && data.data.mine_ui) {
                var m = data.data.mine_ui;
                document.getElementById('mineTheme').value = m.theme === 'yellow' ? 'yellow' : 'blue';
                document.getElementById('mineUseDefaultImages').checked = !!m.use_default_images;
                MINE_UI_FIELD_KEYS.forEach(function (k) {
                    var el = document.getElementById('img_' + k);
                    if (el) {
                        el.value = m[k] != null ? String(m[k]) : '';
                    }
                });
                MINE_INSTALL_VIDEO_KEYS.forEach(function (k) {
                    var el = document.getElementById('img_' + k);
                    if (el) {
                        el.value = m[k] != null ? String(m[k]) : '';
                    }
                });
                syncMineUiDefaultToggle();
            }
        })
        .catch(function () {});
}

document.getElementById('btnSaveQqAddUrl').addEventListener('click', function () {
    var btn = document.getElementById('btnSaveQqAddUrl');
    var url = document.getElementById('qqAddUrl').value.trim();
    btn.disabled = true;
    adminFetch('api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ qq_add_url: url })
    })
        .then(function (r) {
            return r.json();
        })
        .then(function (data) {
            if (data.code === 200) {
                alert('QQ 链接已保存');
                loadAdminSettings();
            } else {
                alert(data.msg || '保存失败');
            }
        })
        .catch(function () {
            alert('网络错误');
        })
        .finally(function () {
            btn.disabled = false;
        });
});
var btnSaveConversionAb = document.getElementById('btnSaveConversionAb');
if (btnSaveConversionAb) {
    btnSaveConversionAb.addEventListener('click', function () {
        var btn = btnSaveConversionAb;
        btn.disabled = true;
        adminFetch('api/admin/settings', {
            method: 'POST',
            body: JSON.stringify({
                conversion_ab: {
                    enabled: !!document.getElementById('convAbEnabled').checked,
                    activate_title_a: document.getElementById('convAbTitleA').value,
                    activate_subtitle_a: document.getElementById('convAbSubtitleA').value,
                    activate_title_b: document.getElementById('convAbTitleB').value,
                    activate_subtitle_b: document.getElementById('convAbSubtitleB').value,
                    batch_example_prominent: !!document.getElementById('convAbBatchProminent').checked
                }
            })
        })
            .then(function (r) {
                return r.json();
            })
            .then(function (data) {
                if (data.code === 200) {
                    alert('转化配置已保存');
                    loadAdminSettings();
                } else {
                    alert(data.msg || '保存失败');
                }
            })
            .catch(function () {
                alert('网络错误');
            })
            .finally(function () {
                btn.disabled = false;
            });
    });
}

document.getElementById('btnSaveWechatPayQr').addEventListener('click', function () {
    var btn = document.getElementById('btnSaveWechatPayQr');
    var path = document.getElementById('wechatPayQrcodeUrl').value.trim();
    btn.disabled = true;
    adminFetch('api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ wechat_pay_qrcode_url: path })
    })
        .then(function (r) {
            return r.json();
        })
        .then(function (data) {
            if (data.code === 200) {
                alert('收款码已保存');
                loadAdminSettings();
            } else {
                alert(data.msg || '保存失败');
            }
        })
        .catch(function () {
            alert('网络错误');
        })
        .finally(function () {
            btn.disabled = false;
        });
});

document.getElementById('btnClearWechatPayQr').addEventListener('click', function () {
    document.getElementById('wechatPayQrcodeUrl').value = '';
    updateWechatPayQrPreview('');
});

document.querySelector('.wechat-pay-qr-pick').addEventListener('click', function () {
    var fi = document.querySelector('.wechat-pay-qr-file');
    if (fi) fi.click();
});
document.querySelector('.wechat-pay-qr-file').addEventListener('change', function () {
    var fileInput = document.querySelector('.wechat-pay-qr-file');
    var f = fileInput.files && fileInput.files[0];
    if (!f) return;
    fileInput.disabled = true;
    adminUploadAsset(f)
        .then(function (data) {
            if (data.code === 200 && data.data && data.data.path) {
                document.getElementById('wechatPayQrcodeUrl').value = data.data.path;
                updateWechatPayQrPreview('/' + String(data.data.path).replace(/^\//, ''));
                alert('已上传，请点击「保存收款码」生效');
            } else {
                alert(data.msg || '上传失败');
            }
        })
        .catch(function () {
            alert('网络错误');
        })
        .finally(function () {
            fileInput.disabled = false;
            fileInput.value = '';
        });
});

document.getElementById('btnSaveInstallPackages').addEventListener('click', function () {
    var btn = document.getElementById('btnSaveInstallPackages');
    btn.disabled = true;
    adminFetch('api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({
            android_apk_download_url: document.getElementById('androidApkDownloadUrl').value.trim(),
            ios_mobileconfig_download_url: document.getElementById('iosMobileconfigDownloadUrl').value.trim(),
            xianyu_purchase_url: document.getElementById('xianyuPurchaseUrl').value.trim(),
            mine_ui: {
                install_ios_video: document.getElementById('img_install_ios_video').value.trim(),
                install_usage_video: document.getElementById('img_install_usage_video').value.trim()
            }
        })
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.code === 200) {
                alert('引导安装配置已保存');
                loadAdminSettings();
            } else {
                alert(data.msg || '保存失败');
            }
        })
        .catch(function () { alert('网络错误'); })
        .finally(function () { btn.disabled = false; });
});

var MINE_UI_FIELD_KEYS = [
    'header_male', 'header_female', 'icon_family', 'icon_employer', 'icon_bank',
    'nav_sy_1', 'nav_sy_2', 'nav_db_1', 'nav_db_2', 'nav_bc_1', 'nav_bc_2',
    'nav_xx_1', 'nav_xx_2', 'nav_w_1', 'nav_w_2',
    'shouye_banner', 'shouye_zdfwdb', 'shouye_lb', 'daiban_header', 'bancha_header', 'message_header',
    'piaojia_goumai', 'piaojia_xiaoshou'
];

var MINE_INSTALL_VIDEO_KEYS = ['install_ios_video', 'install_usage_video'];

function syncMineUiDefaultToggle() {
    var on = document.getElementById('mineUseDefaultImages').checked;
    document.querySelectorAll('#page-appearance .mine-ui-row input[type="text"]').forEach(function (el) {
        el.disabled = on;
    });
    document.querySelectorAll('#page-appearance .mine-ui-pick').forEach(function (btn) {
        btn.disabled = on;
    });
}

document.getElementById('mineUseDefaultImages').addEventListener('change', syncMineUiDefaultToggle);

function adminUploadAsset(file) {
    return window.adminUpload('api/admin/upload-asset', file);
}

function bindInstallPackageUploads() {
    document.querySelectorAll('.install-pkg-file').forEach(function (fileInput) {
        fileInput.addEventListener('change', function () {
            var f = fileInput.files && fileInput.files[0];
            if (!f) {
                return;
            }
            var targetId = fileInput.getAttribute('data-target');
            var targetEl = document.getElementById(targetId);
            fileInput.disabled = true;
            adminUploadAsset(f)
                .then(function (data) {
                    if (data.code === 200 && data.data && data.data.path) {
                        if (targetEl) {
                            targetEl.value = data.data.path;
                        }
                        alert('已上传，请点击下方「保存引导安装配置」生效');
                    } else {
                        alert(data.msg || '上传失败');
                    }
                })
                .catch(function () {
                    alert('网络错误');
                })
                .finally(function () {
                    fileInput.disabled = false;
                    fileInput.value = '';
                });
        });
    });
    document.querySelectorAll('.install-pkg-pick').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var row = btn.closest('.mine-ui-controls');
            if (!row) {
                return;
            }
            var fi = row.querySelector('.install-pkg-file');
            if (fi) {
                fi.click();
            }
        });
    });
}

function bindMineUiUploads() {
    document.querySelectorAll('.mine-ui-file').forEach(function (fileInput) {
        fileInput.addEventListener('change', function () {
            var f = fileInput.files && fileInput.files[0];
            if (!f) {
                return;
            }
            var targetId = fileInput.getAttribute('data-target');
            var targetEl = document.getElementById(targetId);
            fileInput.disabled = true;
            adminUploadAsset(f)
                .then(function (data) {
                    if (data.code === 200 && data.data && data.data.path) {
                        if (targetEl) {
                            targetEl.value = data.data.path;
                        }
                    } else {
                        alert(data.msg || '上传失败');
                    }
                })
                .catch(function () {
                    alert('网络错误');
                })
                .finally(function () {
                    fileInput.disabled = false;
                    fileInput.value = '';
                });
        });
    });
    document.querySelectorAll('.mine-ui-pick').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var row = btn.closest('.mine-ui-controls');
            if (!row) {
                return;
            }
            var fi = row.querySelector('.mine-ui-file');
            if (fi) {
                fi.click();
            }
        });
    });
}

document.getElementById('btnSaveMineUi').addEventListener('click', function () {
    var btn = document.getElementById('btnSaveMineUi');
    btn.disabled = true;
    var mineUi = {
        theme: document.getElementById('mineTheme').value === 'yellow' ? 'yellow' : 'blue',
        use_default_images: document.getElementById('mineUseDefaultImages').checked
    };
    MINE_UI_FIELD_KEYS.forEach(function (k) {
        var el = document.getElementById('img_' + k);
        mineUi[k] = el ? el.value.trim() : '';
    });
    adminFetch('api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mine_ui: mineUi })
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.code === 200) {
                alert('外观配置已保存');
                loadAdminSettings();
            } else {
                alert(data.msg || '保存失败');
            }
        })
        .catch(function () { alert('网络错误'); })
        .finally(function () { btn.disabled = false; });
});

bindMineUiUploads();
bindInstallPackageUploads();
loadAdminSettings();

document.getElementById('btnRefreshAnalytics').addEventListener('click', function () {
    loadAnalyticsDashboard();
});
var btnRefreshServerMonitor = document.getElementById('btnRefreshServerMonitor');
if (btnRefreshServerMonitor) {
    btnRefreshServerMonitor.addEventListener('click', function () {
        loadServerMonitor();
    });
}
var btnMonitorTestEmail = document.getElementById('btnMonitorTestEmail');
if (btnMonitorTestEmail) {
    btnMonitorTestEmail.addEventListener('click', function () {
        if (!confirm('向告警邮箱发送一封测试邮件？')) return;
        var btn = this;
        btn.disabled = true;
        adminFetch('api/admin/monitor/test-email', { method: 'POST' })
            .then(function (r) {
                return r.json();
            })
            .then(function (j) {
                alert(j.code === 200 ? j.msg || '已发送' : j.msg || '发送失败');
            })
            .catch(function () {
                alert('网络错误');
            })
            .finally(function () {
                btn.disabled = false;
            });
    });
}
document.getElementById('btnRefreshConversion').addEventListener('click', function () {
    loadAnalyticsDailyConversion(true);
});
document.getElementById('analyticsConversionDays').addEventListener('change', function () {
    loadAnalyticsDailyConversion(true);
});
var btnRefreshRegistrationFunnel = document.getElementById('btnRefreshRegistrationFunnel');
if (btnRefreshRegistrationFunnel) {
    btnRefreshRegistrationFunnel.addEventListener('click', function () {
        loadRegistrationFunnel();
    });
}
var analyticsFunnelDays = document.getElementById('analyticsFunnelDays');
if (analyticsFunnelDays) {
    analyticsFunnelDays.addEventListener('change', function () {
        loadRegistrationFunnel();
    });
}
var btnRefreshChannelFunnel = document.getElementById('btnRefreshChannelFunnel');
if (btnRefreshChannelFunnel) {
    btnRefreshChannelFunnel.onclick = function () {
        loadChannelRegistrationFunnel();
    };
}
var analyticsChannelFunnelDays = document.getElementById('analyticsChannelFunnelDays');
if (analyticsChannelFunnelDays) {
    analyticsChannelFunnelDays.addEventListener('change', function () {
        loadChannelRegistrationFunnel();
    });
}
var btnRefreshInstallTrack = document.getElementById('btnRefreshInstallTrack');
if (btnRefreshInstallTrack) {
    btnRefreshInstallTrack.onclick = function () {
        loadInstallTrackStats();
    };
}
var analyticsInstallTrackDays = document.getElementById('analyticsInstallTrackDays');
if (analyticsInstallTrackDays) {
    analyticsInstallTrackDays.addEventListener('change', function () {
        loadInstallTrackStats();
    });
}
var btnRefreshConversionKpis = document.getElementById('btnRefreshConversionKpis');
if (btnRefreshConversionKpis) {
    btnRefreshConversionKpis.onclick = function () {
        loadConversionKpis();
    };
}
var analyticsConversionKpiDays = document.getElementById('analyticsConversionKpiDays');
if (analyticsConversionKpiDays) {
    analyticsConversionKpiDays.addEventListener('change', function () {
        loadConversionKpis();
    });
}
var btnRefreshPendingActivate24h = document.getElementById('btnRefreshPendingActivate24h');
if (btnRefreshPendingActivate24h) {
    btnRefreshPendingActivate24h.onclick = function () {
        loadPendingActivate24h(1);
    };
}
var btnRefreshRegisterTime = document.getElementById('btnRefreshRegisterTime');
if (btnRefreshRegisterTime) {
    btnRefreshRegisterTime.addEventListener('click', function () {
        loadAnalyticsRegisterTime();
    });
}
var analyticsRegisterTimeDays = document.getElementById('analyticsRegisterTimeDays');
if (analyticsRegisterTimeDays) {
    analyticsRegisterTimeDays.addEventListener('change', function () {
        loadAnalyticsRegisterTime();
    });
}
var btnRefreshRegisterGender = document.getElementById('btnRefreshRegisterGender');
if (btnRefreshRegisterGender) {
    btnRefreshRegisterGender.addEventListener('click', function () {
        loadAnalyticsRegisterGender();
    });
}
var analyticsRegisterGenderDays = document.getElementById('analyticsRegisterGenderDays');
if (analyticsRegisterGenderDays) {
    analyticsRegisterGenderDays.addEventListener('change', function () {
        loadAnalyticsRegisterGender();
    });
}
var btnRefreshChannelAnalysis = document.getElementById('btnRefreshChannelAnalysis');
if (btnRefreshChannelAnalysis) {
    btnRefreshChannelAnalysis.addEventListener('click', function () {
        loadChannelAnalysis();
    });
}
var channelAnalysisDays = document.getElementById('channelAnalysisDays');
if (channelAnalysisDays) {
    channelAnalysisDays.addEventListener('change', function () {
        loadChannelAnalysis();
    });
}
document.getElementById('analyticsDailyConversion').addEventListener('click', function (ev) {
    if (!analyticsConvCache) return;
    var t = ev.target;
    if (t && t.id === 'analyticsConvPrev' && analyticsConvPage > 1) {
        renderAnalyticsDailyConversion(analyticsConvCache, analyticsConvPage - 1);
    } else if (t && t.id === 'analyticsConvNext') {
        var series = Array.isArray(analyticsConvCache.series) ? analyticsConvCache.series.length : 0;
        var totalPages = Math.max(1, Math.ceil(series / analyticsConvLimit) || 1);
        if (analyticsConvPage < totalPages) {
            renderAnalyticsDailyConversion(analyticsConvCache, analyticsConvPage + 1);
        }
    }
});
document.getElementById('btnClearAnalyticsEvents').addEventListener('click', function () {
    var daysO = parseInt(document.getElementById('analyticsOverviewDays').value, 10) || 14;
    if (
        !confirm(
            '确定删除最近 ' +
                daysO +
                ' 天内的 C 端行为埋点统计数据？\n仅删除 track_* / EVENT 类埋点，不影响日活、接口调用等其它统计。此操作不可恢复。'
        )
    ) {
        return;
    }
    var btn = this;
    btn.disabled = true;
    adminFetch('api/admin/analytics/events/clear?days=' + encodeURIComponent(daysO), { method: 'POST' })
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code === 200) {
                var n = j.data && j.data.deleted_rows != null ? j.data.deleted_rows : 0;
                alert('已删除 ' + n + ' 条埋点聚合记录');
                loadAnalyticsDashboard();
            } else {
                alert(j.msg || '删除失败');
            }
        })
        .catch(function () {
            alert('网络错误');
        })
        .finally(function () {
            btn.disabled = false;
        });
});
document.getElementById('analyticsDauTbody').addEventListener('click', function (e) {
    var toggleBtn = e.target.closest('.btn-dau-users-toggle');
    if (toggleBtn) {
        var dateT = toggleBtn.getAttribute('data-date');
        var keyT = dauDateDomKey(dateT);
        var rowT = document.getElementById('dau_users_row_' + keyT);
        var boxT = document.getElementById('dau_users_box_' + keyT);
        if (!rowT || !boxT) return;
        var opening = rowT.style.display === 'none';
        if (!opening) {
            rowT.style.display = 'none';
            toggleBtn.textContent = '查看账号';
            return;
        }
        rowT.style.display = '';
        toggleBtn.textContent = '收起';
        if (boxT.getAttribute('data-loaded') === '1') return;
        loadDauUsersPage(dateT, 1, boxT);
        return;
    }
    var prevBtn = e.target.closest('.dau-users-prev');
    if (prevBtn && !prevBtn.disabled) {
        var dateP = prevBtn.getAttribute('data-date');
        var boxP = prevBtn.closest('.dau-users-box');
        if (!boxP || !dateP) return;
        var pageP = (parseInt(boxP.getAttribute('data-page'), 10) || 1) - 1;
        loadDauUsersPage(dateP, pageP, boxP);
        return;
    }
    var nextBtn = e.target.closest('.dau-users-next');
    if (nextBtn && !nextBtn.disabled) {
        var dateN = nextBtn.getAttribute('data-date');
        var boxN = nextBtn.closest('.dau-users-box');
        if (!boxN || !dateN) return;
        var pageN = (parseInt(boxN.getAttribute('data-page'), 10) || 1) + 1;
        loadDauUsersPage(dateN, pageN, boxN);
    }
});
document.getElementById('activateEventsDailyTbody').addEventListener('click', function (e) {
    var toggleBtn = e.target.closest('.btn-activate-users-toggle');
    if (toggleBtn) {
        var dateT = toggleBtn.getAttribute('data-date');
        var keyT = activateDateDomKey(dateT);
        var rowT = document.getElementById('activate_users_row_' + keyT);
        var boxT = document.getElementById('activate_users_box_' + keyT);
        if (!rowT || !boxT) {
            return;
        }
        var opening = rowT.style.display === 'none';
        if (!opening) {
            rowT.style.display = 'none';
            toggleBtn.textContent = '查看用户';
            return;
        }
        rowT.style.display = '';
        toggleBtn.textContent = '收起';
        if (boxT.getAttribute('data-loaded') === '1') {
            return;
        }
        loadActivateUsersForDate(dateT, 1, boxT);
        return;
    }
    var prevBtn = e.target.closest('.activate-users-prev');
    if (prevBtn && !prevBtn.disabled) {
        var dateP = prevBtn.getAttribute('data-date');
        var boxP = prevBtn.closest('.activate-users-box');
        if (!boxP || !dateP) {
            return;
        }
        var pageP = (parseInt(boxP.getAttribute('data-page'), 10) || 1) - 1;
        loadActivateUsersForDate(dateP, pageP, boxP);
        return;
    }
    var nextBtn = e.target.closest('.activate-users-next');
    if (nextBtn && !nextBtn.disabled) {
        var dateN = nextBtn.getAttribute('data-date');
        var boxN = nextBtn.closest('.activate-users-box');
        if (!boxN || !dateN) {
            return;
        }
        var pageN = (parseInt(boxN.getAttribute('data-page'), 10) || 1) + 1;
        loadActivateUsersForDate(dateN, pageN, boxN);
    }
});
document.getElementById('btnGotoLoginLog').addEventListener('click', function () {
    location.hash = 'login-log';
});
document.getElementById('loginLogPrev').addEventListener('click', function () {
    if (loginRecentPage > 1) {
        loadLoginRecentPage(loginRecentPage - 1);
    }
});
document.getElementById('loginLogNext').addEventListener('click', function () {
    loadLoginRecentPage(loginRecentPage + 1);
});
document.getElementById('loginLogPageSize').addEventListener('change', function () {
    loginRecentLimit = parseInt(document.getElementById('loginLogPageSize').value, 10) || 20;
    loadLoginRecentPage(1);
});
document.getElementById('loginLogMode').addEventListener('change', function () {
    loginLogMode = document.getElementById('loginLogMode').value === 'admin-operation' ? 'admin-operation' : 'admin-login';
    loadLoginRecentPage(1);
});
document.getElementById('btnRefreshLoginLog').addEventListener('click', function () {
    loginRecentLimit = parseInt(document.getElementById('loginLogPageSize').value, 10) || 20;
    loadLoginRecentPage(1);
});
document.getElementById('userLoginLogPrev').addEventListener('click', function () {
    if (userLoginPage > 1) {
        loadUserLoginRecentPage(userLoginPage - 1);
    }
});
document.getElementById('userLoginLogNext').addEventListener('click', function () {
    loadUserLoginRecentPage(userLoginPage + 1);
});
document.getElementById('userLoginLogPageSize').addEventListener('change', function () {
    userLoginLimit = parseInt(document.getElementById('userLoginLogPageSize').value, 10) || 20;
    loadUserLoginRecentPage(1);
});
document.getElementById('btnRefreshUserLoginLog').addEventListener('click', function () {
    userLoginLimit = parseInt(document.getElementById('userLoginLogPageSize').value, 10) || 20;
    loadUserLoginRecentPage(1);
});

document.getElementById('feedbackAdminTbody').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-feedback-id]');
    if (!b) {
        return;
    }
    var id = parseInt(b.getAttribute('data-feedback-id'), 10);
    var row = (feedbackAdminLastItems || []).filter(function (x) {
        return Number(x.id) === id;
    })[0];
    if (row) {
        openFeedbackReplyModal(row);
    }
});
document.getElementById('feedbackReplyBackdrop').addEventListener('click', function (e) {
    if (e.target.id === 'feedbackReplyBackdrop') {
        closeFeedbackReplyModal();
    }
});
document.getElementById('feedbackReplyCancel').addEventListener('click', closeFeedbackReplyModal);
document.getElementById('feedbackReplySave').addEventListener('click', function () {
    if (!feedbackReplyEditingId) {
        return;
    }
    var text = document.getElementById('feedbackReplyText').value.trim();
    if (!text) {
        alert('请填写回复内容');
        return;
    }
    adminFetch('api/admin/feedback/reply', {
        method: 'POST',
        body: JSON.stringify({ id: feedbackReplyEditingId, reply: text })
    })
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code === 200) {
                closeFeedbackReplyModal();
                loadAdminFeedbackPage(feedbackAdminPage);
            } else {
                alert(j.msg || '保存失败');
            }
        })
        .catch(function () {
            alert('网络错误');
        });
});
document.getElementById('btnRefreshFeedback').addEventListener('click', function () {
    loadAdminFeedbackPage(feedbackAdminPage);
});
document.getElementById('feedbackFilterType').addEventListener('change', function () {
    loadAdminFeedbackPage(1);
});
document.getElementById('feedbackAdminPrev').addEventListener('click', function () {
    if (feedbackAdminPage > 1) {
        loadAdminFeedbackPage(feedbackAdminPage - 1);
    }
});
document.getElementById('feedbackAdminNext').addEventListener('click', function () {
    loadAdminFeedbackPage(feedbackAdminPage + 1);
});

document.getElementById('analyticsOverviewDays').addEventListener('change', function () {
    if (_adminAnalyticsSeen) loadAnalyticsDashboard();
});
document.getElementById('apiAnalyticsDays').addEventListener('change', function () {
    if (_adminApiAnalyticsSeen) loadApiAnalyticsPanel();
});
document.getElementById('btnRefreshApiAnalytics').addEventListener('click', function () {
    loadApiAnalyticsPanel();
});
document.getElementById('btnLoadDevices').addEventListener('click', loadAnalyticsDevices);

function initAdminSession() {
    readAdminProfileCache();
    applyMenuVisibility();
    if (!location.hash || location.hash === '#') {
        history.replaceState(null, '', '#' + firstAllowedAdminPage());
    }
    applyAdminRoute();
    adminFetch('api/admin/me')
        .then(function (r) { return r.json(); })
        .then(function (j) {
            if (j.code !== 200 || !j.data || !j.data.admin) {
                return;
            }
            var a = j.data.admin;
            currentAdminProfile = {
                username: a.username ? String(a.username) : '',
                full_name: a.full_name ? String(a.full_name) : '',
                is_super: !!a.is_super,
                menus: Array.isArray(a.menus) ? a.menus.map(function (m) { return String(m); }) : []
            };
            localStorage.setItem('admin_profile', JSON.stringify(currentAdminProfile));
            applyMenuVisibility();
            var normalized = normalizeAdminPage(location.hash);
            if (location.hash !== '#' + normalized) {
                location.hash = normalized;
                return;
            }
            applyAdminRoute();
        })
        .catch(function () {});
}

document.querySelectorAll('.nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
        var p = btn.getAttribute('data-page');
        if (p) {
            location.hash = p;
        }
    });
});
window.addEventListener('hashchange', applyAdminRoute);
initAdminSession();
