<template>
  <div class="performance-container">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>性能测试</span>
          <div class="header-actions">
            <el-button type="primary" @click="startPerformanceTest">
              <el-icon><i-ep-play /></el-icon>
              开始压测
            </el-button>
            <el-button @click="saveConfig">
              <el-icon><i-ep-document-save /></el-icon>
              保存配置
            </el-button>
          </div>
        </div>
      </template>
      
      <!-- 压测配置 -->
      <div class="test-config">
        <el-collapse v-model="activeCollapse">
          <el-collapse-item title="基本配置" name="basic">
            <el-form :model="testConfig" label-width="120px">
              <el-form-item label="压测目标">
                <el-radio-group v-model="targetType">
                  <el-radio label="case">按测试用例</el-radio>
                  <el-radio label="custom">自定义URL</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item v-if="targetType === 'case'" label="测试用例">
                <el-select
                  v-model="selectedCaseId"
                  placeholder="选择要压测的用例"
                  @change="handleCaseChange"
                >
                  <el-option
                    v-for="item in cases"
                    :key="item.id"
                    :label="item.name"
                    :value="item.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="测试名称">
                <el-input v-model="testConfig.name" placeholder="输入测试名称" />
              </el-form-item>
              <el-form-item label="测试目标">
                <el-input v-model="testConfig.targetUrl" placeholder="输入测试URL" />
              </el-form-item>
              <el-form-item label="请求方法">
                <el-select v-model="testConfig.method" placeholder="选择请求方法">
                  <el-option label="GET" value="GET" />
                  <el-option label="POST" value="POST" />
                  <el-option label="PUT" value="PUT" />
                  <el-option label="DELETE" value="DELETE" />
                </el-select>
              </el-form-item>
              <el-form-item label="请求体" v-if="['POST', 'PUT'].includes(testConfig.method)">
                <el-input
                  v-model="testConfig.body"
                  type="textarea"
                  :rows="4"
                  placeholder="输入请求体JSON"
                />
              </el-form-item>
              <el-form-item label="请求头">
                <el-button type="primary" size="small" @click="addHeader">添加请求头</el-button>
                <el-table :data="testConfig.headers" style="margin-top: 10px">
                  <el-table-column label="Key" width="180">
                    <template #default="{ row }">
                      <el-input v-model="row.key" placeholder="Header 名" />
                    </template>
                  </el-table-column>
                  <el-table-column label="Value">
                    <template #default="{ row }">
                      <el-input v-model="row.value" placeholder="Header 值" />
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="100">
                    <template #default="{ $index }">
                      <el-button type="danger" size="small" @click="removeHeader($index)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-form-item>
            </el-form>
          </el-collapse-item>
          
          <el-collapse-item title="压测参数" name="pressure">
            <el-form :model="testConfig" label-width="120px">
              <el-form-item label="并发类型">
                <el-radio-group v-model="testConfig.concurrencyType">
                  <el-radio label="固定并发">固定并发</el-radio>
                  <el-radio label="阶梯加压">阶梯加压</el-radio>
                </el-radio-group>
              </el-form-item>
              
              <!-- 固定并发配置 -->
              <el-form-item v-if="testConfig.concurrencyType === '固定并发'" label="并发数">
                <el-input-number v-model="testConfig.concurrency" :min="1" :max="1000" />
              </el-form-item>
              
              <!-- 阶梯加压配置 -->
              <div v-if="testConfig.concurrencyType === '阶梯加压'" class="step-config">
                <el-form-item label="初始并发">
                  <el-input-number v-model="testConfig.initialConcurrency" :min="1" :max="1000" />
                </el-form-item>
                <el-form-item label="目标并发">
                  <el-input-number v-model="testConfig.targetConcurrency" :min="1" :max="1000" />
                </el-form-item>
                <el-form-item label="阶梯数">
                  <el-input-number v-model="testConfig.stepCount" :min="1" :max="20" />
                </el-form-item>
                <el-form-item label="每阶梯持续时间(秒)">
                  <el-input-number v-model="testConfig.stepDuration" :min="1" :max="3600" />
                </el-form-item>
              </div>
              
              <el-form-item label="持续时间(秒)">
                <el-input-number v-model="testConfig.duration" :min="1" :max="3600" />
              </el-form-item>
              <el-form-item label="请求间隔(毫秒)">
                <el-input-number v-model="testConfig.interval" :min="0" :max="10000" />
              </el-form-item>
              <el-form-item label="超时时间(秒)">
                <el-input-number v-model="testConfig.timeout" :min="1" :max="60" />
              </el-form-item>
            </el-form>
          </el-collapse-item>
          
          <el-collapse-item title="高级配置" name="advanced">
            <el-form :model="testConfig" label-width="120px">
              <el-form-item label="是否启用Cookie">
                <el-switch v-model="testConfig.enableCookie" />
              </el-form-item>
              <el-form-item label="是否启用重定向">
                <el-switch v-model="testConfig.enableRedirect" />
              </el-form-item>
              <el-form-item label="最大重定向次数">
                <el-input-number v-model="testConfig.maxRedirects" :min="0" :max="10" />
              </el-form-item>
              <el-form-item label="是否保存响应">
                <el-switch v-model="testConfig.saveResponse" />
              </el-form-item>
            </el-form>
          </el-collapse-item>
        </el-collapse>
      </div>
      
      <!-- 测试结果 -->
      <div v-if="testResult" class="test-result">
        <el-card class="result-card">
          <template #header>
            <span>测试结果</span>
          </template>
          
          <!-- 核心指标 -->
          <div class="core-metrics">
            <el-statistic :value="testResult.tps" title="TPS" suffix="次/秒" />
            <el-statistic :value="testResult.qps" title="QPS" suffix="次/秒" />
            <el-statistic :value="testResult.avgResponseTime" title="平均响应时间" suffix="ms" />
            <el-statistic :value="testResult.maxResponseTime" title="最大响应时间" suffix="ms" />
            <el-statistic :value="testResult.minResponseTime" title="最小响应时间" suffix="ms" />
            <el-statistic :value="testResult.errorRate" title="错误率" suffix="%" />
          </div>
          
          <!-- 响应时间图表 -->
          <div class="chart-section">
            <h4>响应时间趋势</h4>
            <div ref="responseTimeChart" class="chart-container"></div>
          </div>
          
          <!-- TPS/QPS图表 -->
          <div class="chart-section">
            <h4>TPS/QPS趋势</h4>
            <div ref="tpsQpsChart" class="chart-container"></div>
          </div>
          
          <!-- 服务器资源图表 -->
          <div class="chart-section">
            <h4>服务器资源占用</h4>
            <div ref="resourceChart" class="chart-container"></div>
          </div>
          
          <!-- 性能分析 -->
          <div class="analysis-section">
            <h4>性能分析建议</h4>
            <el-card class="analysis-card">
              <el-list>
                <el-list-item v-for="(item, index) in testResult.analysis" :key="index">
                  <template #prefix>
                    <el-icon v-if="item.type === 'warning'" class="warning-icon"><i-ep-warning /></el-icon>
                    <el-icon v-else-if="item.type === 'info'" class="info-icon"><i-ep-info /></el-icon>
                    <el-icon v-else-if="item.type === 'success'" class="success-icon"><i-ep-success /></el-icon>
                  </template>
                  {{ item.content }}
                </el-list-item>
              </el-list>
            </el-card>
          </div>
          
          <!-- 操作按钮 -->
          <div class="result-actions">
            <el-button type="primary" @click="exportResult">导出结果</el-button>
            <el-button @click="saveResult">保存结果</el-button>
            <el-button @click="compareResult">对比历史结果</el-button>
          </div>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import axios from 'axios'

const activeCollapse = ref(['basic', 'pressure'])
const testConfig = ref({
  name: '性能测试',
  targetUrl: '',
  method: 'GET',
  body: '{}',
  headers: [
    { key: 'Content-Type', value: 'application/json' }
  ],
  concurrencyType: '固定并发',
  concurrency: 10,
  initialConcurrency: 10,
  targetConcurrency: 100,
  stepCount: 5,
  stepDuration: 60,
  duration: 300,
  interval: 0,
  timeout: 30,
  enableCookie: false,
  enableRedirect: true,
  maxRedirects: 5,
  saveResponse: false
})

const cases = ref<any[]>([])
const selectedCaseId = ref<number | null>(null)
const loading = ref(false)
const targetType = ref('case')

const testResult = ref<any>(null)
const responseTimeChart = ref<HTMLElement | null>(null)
const tpsQpsChart = ref<HTMLElement | null>(null)
const resourceChart = ref<HTMLElement | null>(null)

const addHeader = () => {
  testConfig.value.headers.push({ key: '', value: '' })
}

const removeHeader = (index: number) => {
  testConfig.value.headers.splice(index, 1)
}

const loadCases = async () => {
  try {
    const response = await axios.get('/api/v1/case')
    if (response.data.code !== 200) {
      ElMessage.error(response.data.message || '获取用例列表失败')
      return
    }
    cases.value = response.data.data || []
  } catch (error) {
    console.error('获取用例列表失败:', error)
    ElMessage.error('获取用例列表失败')
  }
}

const handleCaseChange = async (caseId: number) => {
  if (!caseId) {
    return
  }
  try {
    const response = await axios.get(`/api/v1/case/${caseId}`)
    if (response.data.code !== 200) {
      ElMessage.error(response.data.message || '获取用例详情失败')
      return
    }
    const data = response.data.data || {}
    testConfig.value.targetUrl = data.url || ''
    testConfig.value.method = data.method || 'GET'
    testConfig.value.body = data.body || ''
    const headers = data.headers || {}
    const headerList: { key: string; value: string }[] = []
    Object.keys(headers || {}).forEach(key => {
      headerList.push({
        key,
        value: String(headers[key])
      })
    })
    testConfig.value.headers = headerList.length
      ? headerList
      : [{ key: 'Content-Type', value: 'application/json' }]
    if (!testConfig.value.name) {
      testConfig.value.name = data.name || '性能测试'
    }
  } catch (error) {
    console.error('获取用例详情失败:', error)
    ElMessage.error('获取用例详情失败')
  }
}

const startPerformanceTest = async () => {
  if (targetType.value === 'case') {
    if (!selectedCaseId.value) {
      ElMessage.warning('请选择测试用例')
      return
    }
  } else {
    if (!testConfig.value.targetUrl) {
      ElMessage.warning('请输入测试目标URL')
      return
    }
  }
  loading.value = true
  try {
    const concurrency =
      testConfig.value.concurrencyType === '固定并发'
        ? testConfig.value.concurrency
        : testConfig.value.targetConcurrency
    const rampUpConfig =
      testConfig.value.concurrencyType === '阶梯加压'
        ? JSON.stringify({
            type: 'step',
            initialConcurrency: testConfig.value.initialConcurrency,
            targetConcurrency: testConfig.value.targetConcurrency,
            stepCount: testConfig.value.stepCount,
            stepDuration: testConfig.value.stepDuration
          })
        : null
    let response
    if (targetType.value === 'case') {
      response = await axios.post('/api/v1/test/performance', {
        case_id: selectedCaseId.value,
        concurrency,
        duration: testConfig.value.duration,
        ramp_up_config: rampUpConfig
      })
    } else {
      const headersObject: Record<string, string> = {}
      testConfig.value.headers.forEach(item => {
        if (item.key) {
          headersObject[item.key] = item.value
        }
      })
      response = await axios.post('/api/v1/test/performance/custom', {
        target_url: testConfig.value.targetUrl,
        method: testConfig.value.method,
        headers: headersObject,
        body: testConfig.value.body,
        concurrency,
        duration: testConfig.value.duration,
        ramp_up_config: rampUpConfig,
        timeout: testConfig.value.timeout
      })
    }
    if (response.data.code !== 200) {
      ElMessage.error(response.data.message || '性能测试执行失败')
      return
    }
    const data = response.data.data || {}
    const metrics = data.metrics || {}
    const avgMs = Number((metrics.avg_response_time || 0) * 1000)
    const maxMs = Number((metrics.max_response_time || 0) * 1000)
    const minMs = Number((metrics.min_response_time || 0) * 1000)
    const tps = Number(metrics.tps || 0)
    const qps = Number(metrics.qps || 0)
    const errorRate = Number(metrics.error_rate || 0)
    const responseTimes = (metrics.response_times || []).map(
      (v: number) => v * 1000
    )
    const serverMetrics = metrics.server_metrics || {}
    const analysis: { type: string; content: string }[] = []
    if (tps > 0) {
      analysis.push({
        type: 'success',
        content: `TPS约为${tps.toFixed(2)}次/秒`
      })
    }
    if (avgMs > 0) {
      analysis.push({
        type: avgMs > 1000 ? 'warning' : 'info',
        content: `平均响应时间约${avgMs.toFixed(2)}ms`
      })
    }
    if (errorRate > 0) {
      analysis.push({
        type: errorRate > 1 ? 'warning' : 'info',
        content: `错误率约${errorRate.toFixed(2)}%`
      })
    }
    if (serverMetrics.cpu_percent != null) {
      analysis.push({
        type: serverMetrics.cpu_percent > 80 ? 'warning' : 'info',
        content: `压测期间CPU约${serverMetrics.cpu_percent}%`
      })
    }
    testResult.value = {
      tps: Number(tps.toFixed(2)),
      qps: Number(qps.toFixed(2)),
      avgResponseTime: Number(avgMs.toFixed(2)),
      maxResponseTime: Number(maxMs.toFixed(2)),
      minResponseTime: Number(minMs.toFixed(2)),
      errorRate: Number(errorRate.toFixed(2)),
      metrics: {
        responseTimes,
        cpu: Number(serverMetrics.cpu_percent || 0),
        memory: Number(serverMetrics.memory_percent || 0),
        disk: Number(serverMetrics.disk_percent || 0)
      },
      analysis
    }
    await nextTick()
    renderCharts()
    ElMessage.success('性能测试完成')
  } catch (error) {
    console.error('性能测试执行失败:', error)
    ElMessage.error('性能测试执行失败')
  } finally {
    loading.value = false
  }
}

const renderCharts = () => {
  if (!testResult.value) {
    return
  }
  const metrics = testResult.value.metrics || {}
  const responseTimes: number[] = metrics.responseTimes || []
  const xLabels =
    responseTimes.length > 0
      ? responseTimes.map((_, index) => `${index + 1}`)
      : []
  if (responseTimeChart.value) {
    const chart = echarts.init(responseTimeChart.value)
    const option = {
      title: {
        text: '响应时间分布',
        left: 'center'
      },
      xAxis: {
        type: 'category',
        data: xLabels
      },
      yAxis: {
        type: 'value',
        name: '响应时间(ms)'
      },
      series: [
        {
          name: '响应时间',
          type: 'line',
          data: responseTimes,
          smooth: true
        }
      ]
    }
    chart.setOption(option)
  }
  
  if (tpsQpsChart.value) {
    const chart = echarts.init(tpsQpsChart.value)
    const count = xLabels.length || 10
    const xData = Array.from({ length: count }, (_, index) => `${index + 1}`)
    const tpsList = xData.map(() => testResult.value.tps)
    const qpsList = xData.map(() => testResult.value.qps)
    const option = {
      title: {
        text: 'TPS/QPS',
        left: 'center'
      },
      xAxis: {
        type: 'category',
        data: xData
      },
      yAxis: {
        type: 'value',
        name: '次数/秒'
      },
      series: [
        {
          name: 'TPS',
          type: 'line',
          data: tpsList,
          smooth: true
        },
        {
          name: 'QPS',
          type: 'line',
          data: qpsList,
          smooth: true
        }
      ]
    }
    chart.setOption(option)
  }
  
  if (resourceChart.value) {
    const chart = echarts.init(resourceChart.value)
    const xData = ['CPU', '内存', '磁盘']
    const cpu = metrics.cpu || 0
    const memory = metrics.memory || 0
    const disk = metrics.disk || 0
    const option = {
      title: {
        text: '服务器资源占用',
        left: 'center'
      },
      xAxis: {
        type: 'category',
        data: xData
      },
      yAxis: {
        type: 'value',
        name: '占用率(%)'
      },
      series: [
        {
          name: '资源占用',
          type: 'bar',
          data: [cpu, memory, disk]
        }
      ]
    }
    chart.setOption(option)
  }
}

const saveConfig = () => {
  ElMessage.info('保存配置功能开发中')
}

const exportResult = () => {
  ElMessage.info('导出结果功能开发中')
}

const saveResult = () => {
  ElMessage.info('保存结果功能开发中')
}

const compareResult = () => {
  ElMessage.info('对比历史结果功能开发中')
}

onMounted(() => {
  loadCases()
})
</script>

<style scoped>
.performance-container {
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

.test-config {
  margin-bottom: 20px;
}

.step-config {
  margin-left: 20px;
  padding-left: 20px;
  border-left: 2px solid #eaeef1;
}

.test-result {
  margin-top: 20px;
}

.core-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.chart-section {
  margin-bottom: 30px;
}

.chart-section h4 {
  margin-bottom: 10px;
  color: #303133;
}

.chart-container {
  width: 100%;
  height: 400px;
  border: 1px solid #eaeef1;
  border-radius: 4px;
}

.analysis-section {
  margin-bottom: 30px;
}

.analysis-section h4 {
  margin-bottom: 10px;
  color: #303133;
}

.analysis-card {
  margin-top: 10px;
}

.warning-icon {
  color: #e6a23c;
}

.info-icon {
  color: #409eff;
}

.success-icon {
  color: #67c23a;
}

.result-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
