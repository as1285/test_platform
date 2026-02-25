<template>
  <div class="report-container">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>报告管理</span>
          <div class="header-actions">
            <el-button @click="refreshReports">
              <el-icon><i-ep-refresh /></el-icon>
              刷新
            </el-button>
            <el-button @click="exportAllReports">
              <el-icon><i-ep-download /></el-icon>
              导出全部
            </el-button>
          </div>
        </div>
      </template>
      
      <!-- 报告筛选 -->
      <div class="report-filter">
        <el-form :inline="true" :model="filterForm" class="filter-form">
          <el-form-item label="报告类型">
            <el-select v-model="filterForm.type" placeholder="选择类型">
              <el-option label="自动化测试" value="automation" />
              <el-option label="性能测试" value="performance" />
              <el-option label="鲁棒性测试" value="robustness" />
            </el-select>
          </el-form-item>
          <el-form-item label="测试状态">
            <el-select v-model="filterForm.status" placeholder="选择状态">
              <el-option label="全部" value="all" />
              <el-option label="通过" value="passed" />
              <el-option label="失败" value="failed" />
              <el-option label="部分通过" value="partial" />
            </el-select>
          </el-form-item>
          <el-form-item label="时间范围">
            <el-date-picker
              v-model="filterForm.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
          <el-form-item label="关键词">
            <el-input v-model="filterForm.keyword" placeholder="输入报告名称或用例ID" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="searchReports">查询</el-button>
            <el-button @click="resetFilter">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
      
      <!-- 报告列表 -->
      <div class="report-list">
        <el-table :data="reportsData" style="width: 100%" v-loading="loading">
          <el-table-column prop="id" label="报告ID" width="100" />
          <el-table-column prop="name" label="报告名称" />
          <el-table-column prop="type" label="报告类型" width="120">
            <template #default="{ row }">
              <el-tag :type="getTypeTagType(row.type)">{{ getTypeLabel(row.type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="测试状态" width="120">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="totalCases" label="总用例数" width="100" />
          <el-table-column prop="passedCases" label="通过用例" width="100" />
          <el-table-column prop="failedCases" label="失败用例" width="100" />
          <el-table-column prop="passRate" label="通过率" width="100">
            <template #default="{ row }">
              <span>{{ row.passRate }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="duration" label="执行时长" width="120">
            <template #default="{ row }">
              <span>{{ row.duration }}秒</span>
            </template>
          </el-table-column>
          <el-table-column prop="createTime" label="创建时间" width="180" />
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="viewReport(row.id)">
                <el-icon><i-ep-view /></el-icon>
                查看
              </el-button>
              <el-button size="small" @click="exportReport(row.id)">
                <el-icon><i-ep-download /></el-icon>
                导出
              </el-button>
              <el-button size="small" type="danger" @click="deleteReport(row.id)">
                <el-icon><i-ep-delete /></el-icon>
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        
        <!-- 分页 -->
        <div class="pagination">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            :total="total"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
    </el-card>
    
    <!-- 报告查看对话框 -->
    <el-dialog
      v-model="reportDialogVisible"
      :title="currentReport?.name || '报告详情'"
      width="80%"
      :fullscreen="true"
    >
      <div v-if="currentReport" class="report-detail">
        <!-- 报告概览 -->
        <div class="report-overview">
          <el-card class="overview-card">
            <div class="overview-stats">
              <el-statistic :value="currentReport.totalCases" title="总用例数" />
              <el-statistic :value="currentReport.passedCases" title="通过用例" />
              <el-statistic :value="currentReport.failedCases" title="失败用例" />
              <el-statistic :value="currentReport.passRate" title="通过率" />
              <el-statistic :value="currentReport.duration" title="执行时长" suffix="秒" />
            </div>
          </el-card>
        </div>
        
        <!-- 测试详情 -->
        <div class="test-details">
          <h4>测试详情</h4>
          <el-table :data="currentReport.details" style="width: 100%">
            <el-table-column prop="caseId" label="用例ID" width="100" />
            <el-table-column prop="caseName" label="用例名称" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusTagType(row.status)">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="responseTime" label="响应时间" width="120">
              <template #default="{ row }">
                <span>{{ row.responseTime }}ms</span>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="消息" />
          </el-table>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="reportDialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="exportCurrentReport">导出报告</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

// 响应式数据
const filterForm = ref({
  type: '',
  status: 'all',
  dateRange: [],
  keyword: ''
})

const reportsData = ref<any[]>([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const reportDialogVisible = ref(false)
const currentReport = ref<any>(null)

// 方法
const getTypeTagType = (type: string) => {
  const typeMap: Record<string, string> = {
    'automation': 'primary',
    'performance': 'success',
    'robustness': 'warning'
  }
  return typeMap[type] || 'info'
}

const getTypeLabel = (type: string) => {
  const typeMap: Record<string, string> = {
    'automation': '自动化测试',
    'performance': '性能测试',
    'robustness': '鲁棒性测试'
  }
  return typeMap[type] || type
}

const getStatusTagType = (status: string) => {
  const statusMap: Record<string, string> = {
    '通过': 'success',
    '失败': 'danger',
    '部分通过': 'warning'
  }
  return statusMap[status] || 'info'
}

const searchReports = async () => {
  loading.value = true
  try {
    const params: any = {
      page: currentPage.value,
      page_size: pageSize.value
    }
    if (filterForm.value.type) params.type = filterForm.value.type
    if (filterForm.value.status !== 'all') params.status = filterForm.value.status
    if (filterForm.value.keyword) params.keyword = filterForm.value.keyword
    
    const response = await axios.get('/api/v1/report', { params })
    if (response.data.code === 200) {
      reportsData.value = response.data.data.reports
      total.value = response.data.pagination.total
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '获取报告列表失败')
  } finally {
    loading.value = false
  }
}

const resetFilter = () => {
  filterForm.value = {
    type: '',
    status: 'all',
    dateRange: [],
    keyword: ''
  }
  searchReports()
}

const refreshReports = () => {
  searchReports()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  searchReports()
}

const handleCurrentChange = (current: number) => {
  currentPage.value = current
  searchReports()
}

const viewReport = async (reportId: any) => {
  // 查找真实的 ID (real_id)
  const report = reportsData.value.find(r => r.id === reportId)
  if (!report) return
  
  try {
    const response = await axios.get(`/api/v1/report/${report.real_id}`)
    if (response.data.code === 200) {
      currentReport.value = response.data.data
      reportDialogVisible.value = true
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '获取报告详情失败')
  }
}

const exportReport = (reportId: string) => {
  const report = reportsData.value.find(r => r.id === reportId)
  if (report && report.report_url) {
    window.open(report.report_url, '_blank')
  } else {
    ElMessage.info('该报告暂无可用的下载链接')
  }
}

const deleteReport = (reportId: string) => {
  const report = reportsData.value.find(r => r.id === reportId)
  if (!report) return

  ElMessageBox.confirm('确定要删除此报告吗？', '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const response = await axios.delete(`/api/v1/report/${report.real_id}`)
      if (response.data.code === 200) {
        ElMessage.success('报告删除成功')
        searchReports()
      }
    } catch (error: any) {
      ElMessage.error(error.response?.data?.message || '删除报告失败')
    }
  }).catch(() => {
    // 取消删除
  })
}

const exportAllReports = () => {
  ElMessage.info('导出全部报告功能开发中')
}

const exportCurrentReport = () => {
  ElMessage.info('导出当前报告功能开发中')
}

// 生命周期
onMounted(() => {
  searchReports()
})
</script>

<style scoped>
.report-container {
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

.report-filter {
  margin-bottom: 20px;
}

.filter-form {
  display: flex;
  align-items: center;
  gap: 10px;
}

.report-list {
  margin-top: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.report-detail {
  width: 100%;
}

.report-overview {
  margin-bottom: 30px;
}

.overview-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.test-details {
  margin-top: 30px;
}

.test-details h4 {
  margin-bottom: 10px;
  color: #303133;
}

.dialog-footer {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>