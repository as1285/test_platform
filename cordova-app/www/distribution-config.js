/**
 * 代理专用包由 scripts/build-agent-apk.sh 写入 agentSalesChannel；
 * 公开包保持空渠道，行为与原先一致。
 */
window.__TAX_DISTRIBUTION__ = Object.freeze({
  agentSalesChannel: '',
  disableInAppRegister: false
});
