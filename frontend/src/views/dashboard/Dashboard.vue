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
          <PerformanceChart v-if="showCharts" :data="performanceTrend" />
        </div>
      </el-card>

      <el-card class="chart-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>测试类型分布</span>
          </div>
        </template>
        <div class="chart-container">
          <TestTypeChart v-if="showCharts" :data="testTypeDistribution" />
        </div>
      </el-card>

      <el-card class="chart-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>鲁棒性评分</span>
          </div>
        </template>
        <div class="chart-container">
          <RobustnessChart v-if="showCharts" :data="robustnessScores" />
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

// 动态导入图表组件
const PerformanceChart = () => import('@/components/chart/PerformanceChart.vue')
const TestTypeChart = () => import('@/components/chart/TestTypeChart.vue')
const RobustnessChart = () => import('@/components/chart/RobustnessChart.vue')

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
const showCharts = ref(false)

const formatDateTime = (value: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN')
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

      // 数据加载完成后显示图表
      showCharts.value = true
    } else {
      ElMessage.error(response.data.message || '加载仪表盘数据失败')
    }
  } catch (error) {
    ElMessage.error('加载仪表盘数据失败')
  }
}

onMounted(() => {
  loadDashboardData()
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
