<template>
  <div class="robustness-container">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>鲁棒性测试</span>
          <div class="header-actions">
            <el-button type="primary" @click="startRobustnessTest">
              <el-icon><i-ep-play /></el-icon>
              开始测试
            </el-button>
            <el-button @click="saveConfig">
              <el-icon><i-ep-document-save /></el-icon>
              保存配置
            </el-button>
          </div>
        </div>
      </template>
      
      <!-- 测试配置 -->
      <div class="test-config">
        <el-collapse v-model="activeCollapse">
          <el-collapse-item title="基本配置" name="basic">
            <el-form :model="testConfig" label-width="120px">
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
            </el-form>
          </el-collapse-item>
          
          <el-collapse-item title="异常注入配置" name="injection">
            <el-form :model="testConfig" label-width="120px">
              <el-form-item label="异常类型">
                <el-checkbox-group v-model="testConfig.injectionTypes">
                  <el-checkbox label="参数越界">参数越界</el-checkbox>
                  <el-checkbox label="SQL注入试探">SQL注入试探</el-checkbox>
                  <el-checkbox label="请求频率超限">请求频率超限</el-checkbox>
                  <el-checkbox label="返回数据格式错误">返回数据格式错误</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
              
              <el-form-item label="参数越界配置">
                <el-input-number v-model="testConfig.boundaryCount" label="测试次数" :min="1" :max="100" />
              </el-form-item>
              
              <el-form-item label="SQL注入配置">
                <el-checkbox v-model="testConfig.sqlInjectionEnabled">启用SQL注入测试</el-checkbox>
              </el-form-item>
              
              <el-form-item label="请求频率配置">
                <el-input-number v-model="testConfig.rateLimitCount" label="请求次数" :min="1" :max="1000" />
                <el-input-number v-model="testConfig.rateLimitTime" label="时间窗口(秒)" :min="1" :max="60" />
              </el-form-item>
            </el-form>
          </el-collapse-item>
          
          <el-collapse-item title="容错验证配置" name="tolerance">
            <el-form :model="testConfig" label-width="120px">
              <el-form-item label="熔断检测">
                <el-switch v-model="testConfig.circuitBreakerTest" />
              </el-form-item>
              <el-form-item label="降级检测">
                <el-switch v-model="testConfig.degradationTest" />
              </el-form-item>
              <el-form-item label="异常返回规范检测">
                <el-switch v-model="testConfig.errorFormatTest" />
              </el-form-item>
              <el-form-item label="恢复速度检测">
                <el-switch v-model="testConfig.recoveryTest" />
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
          
          <!-- 评分概览 -->
          <div class="score-overview">
            <el-statistic :value="testResult.overallScore" title="总体评分" suffix="分" />
            <div class="score-radar">
              <div ref="scoreRadarChart" class="radar-container"></div>
            </div>
          </div>
          
          <!-- 详细评分 -->
          <div class="detailed-scores">
            <h4>详细评分</h4>
            <el-table :data="testResult.detailedScores" style="width: 100%">
              <el-table-column prop="category" label="测试类别" />
              <el-table-column prop="score" label="评分" />
              <el-table-column prop="description" label="描述" />
            </el-table>
          </div>
          
          <!-- 异常注入结果 -->
          <div class="injection-results">
            <h4>异常注入结果</h4>
            <el-table :data="testResult.injectionResults" style="width: 100%">
              <el-table-column prop="type" label="异常类型" />
              <el-table-column prop="count" label="测试次数" />
              <el-table-column prop="passed" label="通过次数" />
              <el-table-column prop="failed" label="失败次数" />
              <el-table-column prop="passRate" label="通过率" />
              <el-table-column prop="details" label="详情">
                <template #default="{ row }">
                  <el-button type="text" @click="showDetails(row)">查看详情</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
          
          <!-- 容错验证结果 -->
          <div class="tolerance-results">
            <h4>容错验证结果</h4>
            <el-table :data="testResult.toleranceResults" style="width: 100%">
              <el-table-column prop="type" label="验证类型" />
              <el-table-column prop="result" label="结果">
                <template #default="{ row }">
                  <el-tag :type="row.result === '通过' ? 'success' : 'danger'">{{ row.result }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="details" label="详情" />
            </el-table>
          </div>
          
          <!-- 分析建议 -->
          <div class="analysis-section">
            <h4>分析建议</h4>
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

// 响应式数据
const activeCollapse = ref(['basic', 'injection'])
const testConfig = ref({
  name: '鲁棒性测试',
  targetUrl: 'https://api.example.com/test',
  method: 'GET',
  body: '{}',
  injectionTypes: ['参数越界', 'SQL注入试探', '请求频率超限', '返回数据格式错误'],
  boundaryCount: 10,
  sqlInjectionEnabled: true,
  rateLimitCount: 100,
  rateLimitTime: 10,
  circuitBreakerTest: true,
  degradationTest: true,
  errorFormatTest: true,
  recoveryTest: true
})

const testResult = ref<any>(null)
const scoreRadarChart = ref<HTMLElement | null>(null)
const detailsDialog = ref(false)
const dialogDetails = ref<any>(null)

// 方法
const startRobustnessTest = () => {
  // 验证配置
  if (!testConfig.value.targetUrl) {
    ElMessage.warning('请输入测试目标URL')
    return
  }
  
  // 模拟测试执行
  ElMessage.info('开始鲁棒性测试...')
  
  // 模拟测试结果
  setTimeout(() => {
    testResult.value = {
      overallScore: 85,
      detailedScores: [
        { category: '容错率', score: 90, description: '接口在面对异常时的容错能力' },
        { category: '异常提示', score: 80, description: '异常返回信息的清晰度和有用性' },
        { category: '恢复速度', score: 85, description: '从异常状态恢复的速度' },
        { category: '边界处理', score: 95, description: '对边界值的处理能力' },
        { category: '安全防护', score: 75, description: '对安全攻击的防护能力' }
      ],
      injectionResults: [
        { type: '参数越界', count: 10, passed: 8, failed: 2, passRate: '80%', details: '部分边界值处理不当' },
        { type: 'SQL注入试探', count: 5, passed: 5, failed: 0, passRate: '100%', details: 'SQL注入防护良好' },
        { type: '请求频率超限', count: 100, passed: 95, failed: 5, passRate: '95%', details: '请求频率限制有效' },
        { type: '返回数据格式错误', count: 5, passed: 4, failed: 1, passRate: '80%', details: '部分错误场景返回格式不一致' }
      ],
      toleranceResults: [
        { type: '熔断检测', result: '通过', details: '接口实现了熔断机制' },
        { type: '降级检测', result: '通过', details: '接口实现了降级机制' },
        { type: '异常返回规范检测', result: '失败', details: '部分异常返回格式不符合规范' },
        { type: '恢复速度检测', result: '通过', details: '接口从异常状态恢复速度较快' }
      ],
      analysis: [
        {
          type: 'success',
          content: '总体鲁棒性评分85分，表现良好'
        },
        {
          type: 'warning',
          content: '参数越界测试中有20%的失败率，建议优化边界值处理'
        },
        {
          type: 'warning',
          content: '异常返回格式检测失败，建议统一异常返回格式'
        },
        {
          type: 'info',
          content: 'SQL注入防护表现优秀，继续保持'
        }
      ]
    }
    
    // 渲染雷达图
    nextTick(() => {
      renderRadarChart()
    })
    
    ElMessage.success('鲁棒性测试完成')
  }, 3000)
}

const renderRadarChart = () => {
  if (scoreRadarChart.value && testResult.value) {
    const chart = echarts.init(scoreRadarChart.value)
    const option = {
      title: {
        text: '鲁棒性评分雷达图',
        left: 'center'
      },
      tooltip: {},
      radar: {
        indicator: testResult.value.detailedScores.map((item: any) => ({
          name: item.category,
          max: 100
        }))
      },
      series: [
        {
          name: '鲁棒性评分',
          type: 'radar',
          data: [
            {
              value: testResult.value.detailedScores.map((item: any) => item.score),
              name: '评分',
              areaStyle: {
                color: 'rgba(64, 158, 255, 0.3)'
              },
              lineStyle: {
                color: '#409eff'
              },
              itemStyle: {
                color: '#409eff'
              }
            }
          ]
        }
      ]
    }
    chart.setOption(option)
  }
}

const showDetails = (row: any) => {
  dialogDetails.value = row
  detailsDialog.value = true
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

// 生命周期
onMounted(() => {
  // 初始化数据
  console.log('鲁棒性测试页面初始化完成')
})
</script>

<style scoped>
.robustness-container {
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

.test-result {
  margin-top: 20px;
}

.score-overview {
  display: flex;
  align-items: center;
  margin-bottom: 30px;
  gap: 40px;
}

.score-overview .el-statistic {
  flex: 0 0 200px;
}

.score-radar {
  flex: 1;
}

.radar-container {
  width: 100%;
  height: 400px;
}

.detailed-scores,
.injection-results,
.tolerance-results,
.analysis-section {
  margin-bottom: 30px;
}

.detailed-scores h4,
.injection-results h4,
.tolerance-results h4,
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