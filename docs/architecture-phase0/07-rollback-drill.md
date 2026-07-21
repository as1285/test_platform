# 回滚演练步骤

> 目的：阶段 1 出问题可在约定时间内恢复。  
> 环境：生产 Docker Compose（`geshui.vip` 源站）。

---

## 1. 常规代码回滚（无 DB 破坏性迁移时）

适用于：仅前端/后端代码问题，**未执行不可逆迁移**。

```bash
cd /root/test_platform

# 1) 查看近期提交
git log --oneline -10

# 2) 回到上一稳定 commit（示例）
git fetch origin
git checkout master
git reset --hard <stable_commit_sha>

# 3) 重新部署
./scripts/deploy.sh

# 4) 探针
curl -sI http://127.0.0.1/ | head -5
curl -s http://127.0.0.1:3000/health
```

**验证**：跑 [`06-canary-regression-checklist.md`](./06-canary-regression-checklist.md) 中 A+C 最少项。

---

## 2. 仅回滚某一服务

```bash
cd /root/test_platform
# 恢复代码后
DEPLOY_SERVICES=backend ./scripts/deploy.sh
# 或
DEPLOY_SERVICES=frontend ./scripts/deploy.sh
```

（以 `scripts/deploy.sh` 实际支持的环境变量为准。）

---

## 3. 数据库回滚

### 3.1 有备份时

```bash
# 备份脚本（仓库已有）
./scripts/backup-mysql.sh

# 导入（慎用，先停写或维护窗）
./scripts/import-mysql-dump.sh <dump_file>
```

### 3.2 阶段 1 起强制要求

- 每次破坏性迁移前：自动/手工跑 `backup-mysql.sh`
- 迁移必须可前进；**禁止**依赖「手动改回列类型」而无脚本
- 明文密码清空（安全计划 P4）前必须双人确认 + 备份

---

## 4. Cloudflare / 边缘

- 源站回滚后若仍见旧页：查 CF 缓存；`consult.html` 已 `no-store`
- SSL 保持 Flexible；勿在源站突然只开 443 导致 525

---

## 5. 演练记录（阶段 0 要求至少桌面走查一次）

| 日期 | 类型 | 操作者 | 耗时 | 结果 | 备注 |
|------|------|--------|------|------|------|
| 2026-07-21 | 桌面走查（文档+命令复核） | agent | — | 文档就绪 | 未在生产做破坏性 reset |
| （待填） | 预发/生产演习 |  |  |  | 建议维护窗执行一次真回滚 |

---

## 6. 升级期间通信

1. 管理台发码/改安装包暂停（可选）  
2. 部署 marker 抑制监控误报（deploy.sh 已写）  
3. 回滚完成后通知：金丝雀清单结果
