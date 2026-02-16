<template>
  <div class="dashboard-container">
    <el-card class="dashboard-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>平台概览</span>
        </div>
      </template>
      
      <div class="stats-grid">
        <el-card class="stat-card success">
          <div class="stat-content">
            <div class="stat-number">{{ stats.totalCases }}</div>
            <div class="stat-label">总用例数</div>
          </div>
        </el-card>
        <el-card class="stat-card info">
          <div class="stat-content">
            <div class="stat-number">{{ stats.totalExecutions }}</div>
            <div class="stat-label">总执行次数</div>
          </div>
        </el-card>
        <el-card class="stat-card warning">
          <div class="stat-content">
            <div class="stat-number">{{ stats.successRate }}%</div>
            <div class="stat-label">成功率</div>
          </div>
        </el-card>
        <el-card class="stat-card danger">
          <div class="stat-content">
            <div class="stat-number">{{ stats.averageResponseTime }}ms</div>
            <div class="stat-label">平均响应时间</div>
          </div>
        </el-card>
      </div>
    </el-card>

    <div class="charts-grid">
      <el-card class="chart-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>最近执行情况</span>
          </div>
        </template>
        <div class="chart-container">
          <el-table :data="recentExecutions" style="width: 100%">
            <el-table-column prop="id" label="执行ID" width="80" />
            <el-table-column prop="caseName" label="用例名称" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'success' ? 'success' : 'danger'">
                  {{ scope.row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="responseTime" label="响应时间(ms)" width="120">
              <template #default="scope">
                {{ scope.row.responseTime }}
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="执行时间" width="180" />
          </el-table>
        </div>
      </el-card>

      <el-card class="chart-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>性能趋势</span>
          </div>
        </template>
        <div class="chart-container">
          <div ref="performanceChart" class="chart" style="width: 100%; height: 300px;"></div>
        </div>
      </el-card>

      <el-card class="chart-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>测试类型分布</span>
          </div>
        </template>
        <div class="chart-container">
          <div ref="testTypeChart" class="chart" style="width: 100%; height: 300px;"></div>
        </div>
      </el-card>

      <el-card class="chart-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>鲁棒性评分</span>
          </div>
        </template>
        <div class="chart-container">
          <div ref="robustnessChart" class="chart" style="width: 100%; height: 300px;"></div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import * as echarts from 'echarts'
import axios from 'axios'
import { ElMessage } from 'element-plus'

interface DashboardStats {
  totalCases: number
  totalExecutions: number
  successRate: number
  averageResponseTime: number
}

interface RecentExecution {
  id: number
  caseName: string
  status: string
  responseTime: number
  createdAt: string
}

interface PerformancePoint {
  date: string
  avg_response_time_ms: number
  success_rate: number
}

interface TestTypeDistribution {
  automation: number
  performance: number
  robustness: number
}

interface RobustnessScores {
  current_score: number
  history_scores: number[]
}

const stats = reactive<DashboardStats>({
  totalCases: 0,
  totalExecutions: 0,
  successRate: 0,
  averageResponseTime: 0
})

const recentExecutions = ref<RecentExecution[]>([])
const performanceTrend = ref<PerformancePoint[]>([])
const testTypeDistribution = ref<TestTypeDistribution | null>(null)
const robustnessScores = ref<RobustnessScores | null>(null)

const performanceChart = ref<HTMLDivElement | null>(null)
const testTypeChart = ref<HTMLDivElement | null>(null)
const robustnessChart = ref<HTMLDivElement | null>(null)

const formatDateTime = (value: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN')
}

const initCharts = () => {
  if (performanceChart.value) {
    const chart = echarts.init(performanceChart.value)
    const dates = performanceTrend.value.map(item => item.date)
    const responseTimes = performanceTrend.value.map(item =>
      Math.round((item.avg_response_time_ms || 0) as number)
    )
    const successRates = performanceTrend.value.map(item =>
      Number(((item.success_rate || 0) as number).toFixed(2))
    )
    const option = {
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: ['响应时间', '成功率']
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates
      },
      yAxis: [
        {
          type: 'value',
          name: '响应时间(ms)',
          position: 'left'
        },
        {
          type: 'value',
          name: '成功率(%)',
          position: 'right',
          max: 100
        }
      ],
      series: [
        {
          name: '响应时间',
          type: 'line',
          data: responseTimes,
          smooth: true
        },
        {
          name: '成功率',
          type: 'line',
          yAxisIndex: 1,
          data: successRates,
          smooth: true
        }
      ]
    }
    chart.setOption(option)
  }

  if (testTypeChart.value) {
    const chart = echarts.init(testTypeChart.value)
    const dist = testTypeDistribution.value || {
      automation: 0,
      performance: 0,
      robustness: 0
    }
    const option = {
      tooltip: {
        trigger: 'item'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [
        {
          name: '测试类型',
          type: 'pie',
          radius: '50%',
          data: [
            { value: dist.automation, name: '自动化测试' },
            { value: dist.performance, name: '性能测试' },
            { value: dist.robustness, name: '鲁棒性测试' }
          ],
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    }
    chart.setOption(option)
  }

  if (robustnessChart.value) {
    const chart = echarts.init(robustnessChart.value)
    const scores = robustnessScores.value
    const current = scores ? scores.current_score || 0 : 0
    const history = scores ? scores.history_scores || [] : []
    const historyAvg =
      history.length > 0
        ? history.reduce((sum, value) => sum + value, 0) / history.length
        : current
    const currentValues = [current, current, current, current, current]
    const historyValues = [historyAvg, historyAvg, historyAvg, historyAvg, historyAvg]
    const option = {
      tooltip: {
        trigger: 'item'
      },
      radar: {
        indicator: [
          { name: '容错率', max: 100 },
          { name: '异常提示', max: 100 },
          { name: '恢复速度', max: 100 },
          { name: '边界处理', max: 100 },
          { name: '安全防护', max: 100 }
        ]
      },
      series: [
        {
          name: '鲁棒性评分',
          type: 'radar',
          data: [
            {
              value: currentValues,
              name: '当前评分'
            },
            {
              value: historyValues,
              name: '历史评分'
            }
          ]
        }
      ]
    }
    chart.setOption(option)
  }
}

const loadDashboardData = async () => {
  try {
    const response = await axios.get('/api/v1/dashboard/overview')
    if (response.data.code === 200) {
      const data = response.data.data || {}
      const statsData = data.stats || {}
      stats.totalCases = statsData.total_cases || 0
      stats.totalExecutions = statsData.total_executions || 0
      stats.successRate = statsData.success_rate || 0
      stats.averageResponseTime = statsData.average_response_time_ms || 0

      const executions = data.recent_executions || []
      recentExecutions.value = executions.map((item: any) => ({
        id: item.id,
        caseName: item.case_name,
        status: item.status,
        responseTime: Math.round(item.response_time_ms || 0),
        createdAt: formatDateTime(item.created_at)
      }))

      performanceTrend.value = data.performance_trend || []
      testTypeDistribution.value = data.test_type_distribution || null
      robustnessScores.value = data.robustness_scores || null

      initCharts()
    } else {
      ElMessage.error(response.data.message || '加载仪表盘数据失败')
    }
  } catch (error) {
    ElMessage.error('加载仪表盘数据失败')
  }
}

onMounted(() => {
  loadDashboardData()
  window.addEventListener('resize', () => {
    if (performanceChart.value) {
      echarts.getInstanceByDom(performanceChart.value)?.resize()
    }
    if (testTypeChart.value) {
      echarts.getInstanceByDom(testTypeChart.value)?.resize()
    }
    if (robustnessChart.value) {
      echarts.getInstanceByDom(robustnessChart.value)?.resize()
    }
  })
})
</script>

<style scoped>
.dashboard-container {
  padding: 20px;
}

.dashboard-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.stat-card {
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
}

.stat-content {
  text-align: center;
  padding: 20px 0;
}

.stat-number {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.stat-card.success .stat-number {
  color: #67c23a;
}

.stat-card.info .stat-number {
  color: #409eff;
}

.stat-card.warning .stat-number {
  color: #e6a23c;
}

.stat-card.danger .stat-number {
  color: #f56c6c;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(45%, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.chart-card {
  height: 400px;
  transition: all 0.3s ease;
}

.chart-card:hover {
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
}

.chart-container {
  height: 320px;
  margin-top: 20px;
}

@media screen and (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
