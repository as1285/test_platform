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

// 响应式数据
const caseGroups = ref([
  {
    id: 1,
    name: '用户管理',
    type: 'group',
    children: [
      {
        id: 101,
        name: '登录接口',
        type: 'case'
      },
      {
        id: 102,
        name: '注册接口',
        type: 'case'
      }
    ]
  },
  {
    id: 2,
    name: '商品管理',
    type: 'group',
    children: [
      {
        id: 201,
        name: '获取商品列表',
        type: 'case'
      },
      {
        id: 202,
        name: '获取商品详情',
        type: 'case'
      }
    ]
  }
])

const selectedCases = ref<string[]>([])
const executionConfig = ref({
  environment: 'test',
  concurrent: false,
  timeout: 60,
  scheduled: false,
  scheduleTime: ''
})

const executionLogs = ref<any[]>([])
const executionResult = ref<any>(null)
const logContent = ref<HTMLElement | null>(null)

// 方法
const handleCheckChange = (_data: any, checked: any) => {
  // 处理用例选择逻辑
  selectedCases.value = checked.checkedKeys.filter((key: any) => {
    // 只保留用例ID，过滤掉分组ID
    const node = caseGroups.value.find(group => group.id === key) || 
                caseGroups.value.flatMap(group => group.children || []).find(caseItem => caseItem.id === key)
    return node && node.type === 'case'
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
  // 获取所有用例ID
  const allCaseIds = caseGroups.value.flatMap(group => 
    group.children?.map(caseItem => caseItem.id) || []
  )
  runTests(allCaseIds)
}

const runTests = (caseIds: any[]) => {
  // 清空之前的日志和结果
  executionLogs.value = []
  executionResult.value = null
  
  // 模拟测试执行过程
  addLog('info', `开始执行测试，共${caseIds.length}个用例`)
  
  // 模拟测试执行
  let passed = 0
  let failed = 0
  let skipped = 0
  let duration = 0
  
  caseIds.forEach((caseId, index) => {
    setTimeout(() => {
      const caseName = getCaseNameById(caseId)
      addLog('info', `执行用例: ${caseName} (ID: ${caseId})`)
      
      // 模拟随机结果
      const result = Math.random()
      if (result > 0.8) {
        addLog('error', `用例执行失败: ${caseName}`)
        failed++
      } else if (result > 0.7) {
        addLog('warning', `用例执行跳过: ${caseName}`)
        skipped++
      } else {
        addLog('success', `用例执行通过: ${caseName}`)
        passed++
      }
      
      duration += Math.random() * 2
      
      // 所有用例执行完成
      if (index === caseIds.length - 1) {
        setTimeout(() => {
          executionResult.value = {
            total: caseIds.length,
            passed,
            failed,
            skipped,
            duration: Math.round(duration * 100) / 100
          }
          addLog('info', `测试执行完成，总用时: ${executionResult.value.duration}秒`)
        }, 500)
      }
    }, index * 1000)
  })
}

const getCaseNameById = (caseId: number) => {
  for (const group of caseGroups.value) {
    if (group.children) {
      const caseItem = group.children.find(item => item.id === caseId)
      if (caseItem) {
        return caseItem.name
      }
    }
  }
  return `用例${caseId}`
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

const viewReport = () => {
  ElMessage.info('查看报告功能开发中')
}

const exportResult = () => {
  ElMessage.info('导出结果功能开发中')
}

// 生命周期
onMounted(() => {
  // 初始化数据
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