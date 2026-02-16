<template>
  <div class="test-container">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>测试执行</span>
          <div class="header-actions">
            <el-button type="primary" @click="handleRunSelected">
              <el-icon><i-ep-play /></el-icon>
              运行选中用例
            </el-button>
            <el-button type="warning" @click="handleRunAll">
              <el-icon><i-ep-refresh /></el-icon>
              运行全部用例
            </el-button>
          </div>
        </div>
      </template>
      
      <!-- 用例选择区域 -->
      <div class="case-selection">
        <el-tree
          :data="caseGroups"
          node-key="id"
          show-checkbox
          default-expand-all
          @check="handleCheckChange"
          class="case-tree"
        >
          <template #default="{ data }">
            <span class="tree-node-label">
              {{ data.name }}
              <span v-if="data.type === 'case'" class="case-id">({{ data.id }})</span>
            </span>
          </template>
        </el-tree>
      </div>
      
      <!-- 执行配置 -->
      <div class="execution-config">
        <el-collapse>
          <el-collapse-item title="执行配置">
            <el-form :model="executionConfig" label-width="120px">
              <el-form-item label="执行环境">
                <el-select v-model="executionConfig.environment" placeholder="选择环境">
                  <el-option label="开发环境" value="dev" />
                  <el-option label="测试环境" value="test" />
                  <el-option label="生产环境" value="prod" />
                </el-select>
              </el-form-item>
              <el-form-item label="并发执行">
                <el-switch v-model="executionConfig.concurrent" />
              </el-form-item>
              <el-form-item label="执行超时(秒)">
                <el-input-number v-model="executionConfig.timeout" :min="1" :max="300" />
              </el-form-item>
              <el-form-item label="定时执行">
                <el-switch v-model="executionConfig.scheduled" @change="handleScheduledChange" />
              </el-form-item>
              <el-form-item v-if="executionConfig.scheduled" label="执行时间">
                <el-date-picker
                  v-model="executionConfig.scheduleTime"
                  type="datetime"
                  placeholder="选择执行时间"
                  format="YYYY-MM-DD HH:mm:ss"
                  value-format="YYYY-MM-DD HH:mm:ss"
                />
              </el-form-item>
            </el-form>
          </el-collapse-item>
        </el-collapse>
      </div>
      
      <!-- 执行日志 -->
      <div class="execution-log">
        <el-card class="log-card">
          <template #header>
            <div class="log-header">
              <span>执行日志</span>
              <el-button type="primary" size="small" @click="clearLog">清空日志</el-button>
            </div>
          </template>
          <div class="log-content" ref="logContent">
            <div v-for="(log, index) in executionLogs" :key="index" :class="['log-item', log.level]">
              <span class="log-time">{{ log.time }}</span>
              <span class="log-level">{{ log.level }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </el-card>
      </div>
      
      <!-- 执行结果 -->
      <div v-if="executionResult" class="execution-result">
        <el-card class="result-card">
          <template #header>
            <span>执行结果</span>
          </template>
          <div class="result-stats">
            <el-statistic :value="executionResult.total" title="总用例数" />
            <el-statistic :value="executionResult.passed" title="通过" :suffix="` (${Math.round(executionResult.passed / executionResult.total * 100)}%)`" />
            <el-statistic :value="executionResult.failed" title="失败" :suffix="` (${Math.round(executionResult.failed / executionResult.total * 100)}%)`" />
            <el-statistic :value="executionResult.skipped" title="跳过" />
            <el-statistic :value="executionResult.duration" title="执行时长" suffix="秒" />
          </div>
          <div class="result-actions">
            <el-button type="primary" @click="viewReport">查看报告</el-button>
            <el-button @click="exportResult">导出结果</el-button>
          </div>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

interface CaseGroupNode {
  id: number
  name: string
  type: 'group' | 'case'
  parent_id?: number | null
  children?: CaseGroupNode[]
  case_id?: number
  group_id?: number
}

interface ExecutionLogItem {
  time: string
  level: string
  message: string
}

interface ExecutionResultSummary {
  total: number
  passed: number
  failed: number
  skipped: number
  duration: number
}

const caseGroups = ref<CaseGroupNode[]>([])

const selectedCases = ref<number[]>([])
const executionConfig = ref({
  environment: 'test',
  concurrent: false,
  timeout: 60,
  scheduled: false,
  scheduleTime: ''
})

const executionLogs = ref<ExecutionLogItem[]>([])
const executionResult = ref<ExecutionResultSummary | null>(null)
const logContent = ref<HTMLElement | null>(null)
const lastExecutionIds = ref<number[]>([])

const loadCaseData = async () => {
  try {
    const [groupResp, caseResp] = await Promise.all([
      axios.get('/api/v1/case/group'),
      axios.get('/api/v1/case')
    ])
    if (groupResp.data.code !== 200) {
      ElMessage.error(groupResp.data.message || '获取用例分组失败')
      return
    }
    if (caseResp.data.code !== 200) {
      ElMessage.error(caseResp.data.message || '获取用例列表失败')
      return
    }
    const groups = (groupResp.data.data || []) as any[]
    const cases = (caseResp.data.data || []) as any[]
    const groupMap = new Map<number, CaseGroupNode>()
    groups.forEach(g => {
      groupMap.set(g.id, {
        id: g.id,
        name: g.name,
        type: 'group',
        parent_id: g.parent_id,
        children: []
      })
    })
    groups.forEach(g => {
      const node = groupMap.get(g.id)!
      if (g.parent_id && groupMap.has(g.parent_id)) {
        const parent = groupMap.get(g.parent_id)!
        if (!parent.children) parent.children = []
        parent.children.push(node)
      }
    })
    const rootGroups: CaseGroupNode[] = []
    groupMap.forEach(g => {
      if (!g.parent_id || !groupMap.has(g.parent_id)) {
        rootGroups.push(g)
      }
    })
    cases.forEach(c => {
      const groupNode = groupMap.get(c.group_id)
      if (groupNode) {
        if (!groupNode.children) groupNode.children = []
        groupNode.children.push({
          id: c.id,
          name: c.name,
          type: 'case',
          case_id: c.id,
          group_id: c.group_id
        })
      }
    })
    caseGroups.value = rootGroups
  } catch (error) {
    console.error('加载用例数据失败:', error)
    ElMessage.error('加载用例数据失败')
  }
}

// 方法
const handleCheckChange = (_data: any, checked: any) => {
  selectedCases.value = checked.checkedKeys.filter((key: any) => {
    let found: CaseGroupNode | undefined
    const dfs = (nodes: CaseGroupNode[]) => {
      for (const n of nodes) {
        if (n.id === key) {
          found = n
          return
        }
        if (n.children && n.children.length) {
          dfs(n.children)
          if (found) return
        }
      }
    }
    dfs(caseGroups.value)
    return found && found.type === 'case'
  })
}

const handleScheduledChange = (value: boolean) => {
  executionConfig.value.scheduled = value
  if (!value) {
    executionConfig.value.scheduleTime = ''
  }
}

const handleRunSelected = () => {
  if (selectedCases.value.length === 0) {
    ElMessage.warning('请选择要执行的用例')
    return
  }
  runTests(selectedCases.value)
}

const handleRunAll = () => {
  const allCaseIds: number[] = []
  const dfs = (nodes: CaseGroupNode[]) => {
    for (const n of nodes) {
      if (n.type === 'case') {
        allCaseIds.push(n.id)
      }
      if (n.children && n.children.length) {
        dfs(n.children)
      }
    }
  }
  dfs(caseGroups.value)
  runTests(allCaseIds)
}

const runTests = async (caseIds: number[]) => {
  executionLogs.value = []
  executionResult.value = null
  lastExecutionIds.value = []
  if (!caseIds.length) {
    ElMessage.warning('没有可执行的用例')
    return
  }
  addLog('info', `开始执行测试，共${caseIds.length}个用例`)
  try {
    const response = await axios.post('/api/v1/test/run', {
      case_ids: caseIds
    })
    if (response.data.code !== 200) {
      ElMessage.error(response.data.message || '测试执行失败')
      addLog('error', `测试执行失败: ${response.data.message || '未知错误'}`)
      return
    }
    const data = response.data.data || {}
    const results = (data.results || []) as any[]
    let passed = 0
    let failed = 0
    let skipped = 0
    let totalDuration = 0
    results.forEach(item => {
      const cid = item.case_id
      const caseName = getCaseNameById(cid)
      addLog('info', `执行用例: ${caseName} (ID: ${cid})`)
      const result = item.result || {}
      const logs: string[] = result.log || []
      logs.forEach(msg => {
        const lower = msg.toLowerCase()
        const level = lower.includes('failed') || lower.includes('error') ? 'error' : 'info'
        addLog(level, msg)
      })
      if (item.success) {
        passed++
        addLog('success', `用例执行通过: ${caseName}`)
      } else {
        failed++
        addLog('error', `用例执行失败: ${caseName}`)
      }
      totalDuration += result.response_time || 0
      if (item.execution_id) {
        lastExecutionIds.value.push(item.execution_id)
      }
    })
    const total = results.length
    executionResult.value = {
      total,
      passed,
      failed,
      skipped,
      duration: Math.round(totalDuration * 100) / 100
    }
    addLog('info', `测试执行完成，总用时: ${executionResult.value.duration}秒`)
  } catch (error) {
    console.error('测试执行失败:', error)
    ElMessage.error('测试执行失败')
    addLog('error', '测试执行过程中出现异常')
  }
}
  
const getCaseNameById = (caseId: number) => {
  let foundName: string | null = null
  const dfs = (nodes: CaseGroupNode[]) => {
    for (const n of nodes) {
      if (n.type === 'case' && n.id === caseId) {
        foundName = n.name
        return
      }
      if (n.children && n.children.length) {
        dfs(n.children)
      }
    }
  }
  dfs(caseGroups.value)
  return foundName || `用例${caseId}`
}

const addLog = (level: string, message: string) => {
  const now = new Date()
  const timeStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  
  executionLogs.value.push({
    time: timeStr,
    level,
    message
  })
  
  // 自动滚动到日志底部
  nextTick(() => {
    if (logContent.value) {
      logContent.value.scrollTop = logContent.value.scrollHeight
    }
  })
}

const clearLog = () => {
  executionLogs.value = []
}

const viewReport = async () => {
  if (!executionResult.value || !lastExecutionIds.value.length) {
    ElMessage.warning('暂无可查看的执行报告')
    return
  }
  const executionId = lastExecutionIds.value[lastExecutionIds.value.length - 1]
  try {
    const response = await axios.post('/api/v1/report', {
      execution_id: executionId,
      type: 'html'
    })
    if (response.data.code === 200 || response.data.code === 201) {
      const report = response.data.data
      if (report && report.report_url) {
        window.open(report.report_url, '_blank')
      } else {
        ElMessage.info('报告已生成，但未找到报告地址')
      }
    } else {
      ElMessage.error(response.data.message || '生成报告失败')
    }
  } catch (error) {
    console.error('生成报告失败:', error)
    ElMessage.error('生成报告失败')
  }
}

const exportResult = () => {
  ElMessage.info('导出结果功能开发中')
}

// 生命周期
onMounted(() => {
  loadCaseData()
  addLog('info', '测试执行页面初始化完成')
})
</script>

<style scoped>
.test-container {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.case-selection {
  margin-bottom: 20px;
}

.case-tree {
  border: 1px solid #eaeef1;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.tree-node-label {
  display: flex;
  align-items: center;
}

.case-id {
  font-size: 12px;
  color: #909399;
  margin-left: 8px;
}

.execution-config {
  margin-bottom: 20px;
}

.execution-log {
  margin-bottom: 20px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log-content {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #eaeef1;
  border-radius: 4px;
  padding: 10px;
  background-color: #fafafa;
}

.log-item {
  display: flex;
  margin-bottom: 8px;
  font-size: 14px;
  line-height: 1.5;
}

.log-time {
  flex: 0 0 180px;
  color: #909399;
  font-size: 12px;
}

.log-level {
  flex: 0 0 80px;
  font-weight: bold;
}

.log-level.success {
  color: #67c23a;
}

.log-level.error {
  color: #f56c6c;
}

.log-level.warning {
  color: #e6a23c;
}

.log-level.info {
  color: #409eff;
}

.log-message {
  flex: 1;
}

.execution-result {
  margin-top: 20px;
}

.result-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.result-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
