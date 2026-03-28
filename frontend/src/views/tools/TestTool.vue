<template>
  <div class="test-tool-container">
    <el-card class="test-tool-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>测试工具</span>
        </div>
      </template>

      <div class="test-tool-content">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="Excel 处理" name="excel">
            <div class="excel-tool">
              <div class="excel-upload-section">
                <h4>上传 Excel 文件</h4>
                <el-upload
                  class="excel-upload-demo"
                  drag
                  :auto-upload="false"
                  :on-change="handleExcelUpload"
                  :show-file-list="false"
                  accept=".xlsx,.xls"
                >
                  <el-icon class="el-icon--upload"><i-ep-upload-filled /></el-icon>
                  <div class="el-upload__text">
                    将 Excel 文件拖到此处，或<em>点击上传</em>
                  </div>
                  <template #tip>
                    <div class="el-upload__tip">
                      只能上传 xlsx/xls 文件
                    </div>
                  </template>
                </el-upload>
                
                <div v-if="excelForm.fileName" class="file-info-card">
                  <el-card shadow="hover">
                    <div class="file-info">
                      <el-icon><i-ep-document /></el-icon>
                      <span>{{ excelForm.fileName }}</span>
                      <el-tag type="success">{{ excelForm.fileSize }}</el-tag>
                    </div>
                    <div class="file-actions">
                      <el-button type="danger" size="small" @click="clearExcelFile">移除文件</el-button>
                    </div>
                  </el-card>
                </div>
              </div>

              <div class="excel-process-section" v-if="excelForm.file">
                <h4>处理选项</h4>
                <el-form :model="excelForm" label-width="120px">
                  <el-form-item label="处理内容">
                    <el-checkbox-group v-model="excelForm.processOptions">
                      <el-checkbox label="remove_br">移除 &lt;br&gt; 标签</el-checkbox>
                      <el-checkbox label="trim_spaces">去除首尾空格</el-checkbox>
                    </el-checkbox-group>
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="processExcel" :loading="excelProcessing">
                      <el-icon><i-ep-refresh-right /></el-icon>
                      开始处理
                    </el-button>
                    <el-button @click="clearExcelForm">重置</el-button>
                  </el-form-item>
                </el-form>
              </div>

              <div class="excel-result-section" v-if="excelProcessed">
                <h4>处理结果</h4>
                <el-alert
                  :title="`成功处理 ${excelStats.totalRows} 行数据，修改 ${excelStats.modifiedRows} 行`"
                  type="success"
                  show-icon
                  style="margin-bottom: 20px"
                />
                
                <div class="result-actions">
                  <el-button type="success" @click="downloadExcel" :loading="excelDownloading">
                    <el-icon><i-ep-download /></el-icon>
                    下载处理后的 Excel
                  </el-button>
                  <el-button @click="previewExcel">
                    <el-icon><i-ep-view /></el-icon>
                    预览结果
                  </el-button>
                </div>
              </div>

              <el-alert
                v-if="excelError"
                :title="excelError"
                type="error"
                show-icon
                style="margin-top: 20px"
                :closable="false"
              />

              <el-dialog v-model="previewVisible" title="Excel 预览" width="80%" top="5vh">
                <el-table :data="excelPreviewData" max-height="500" stripe border>
                  <el-table-column
                    v-for="(header, index) in previewHeaders"
                    :key="index"
                    :prop="'field' + index"
                    :label="header"
                  />
                </el-table>
              </el-dialog>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const activeTab = ref('excel')

// Excel 处理
const excelForm = reactive({
  file: null as File | null,
  fileName: '',
  fileSize: '',
  processOptions: ['remove_br'] as string[]
})

const excelProcessing = ref(false)
const excelProcessed = ref(false)
const excelStats = reactive({
  totalRows: 0,
  modifiedRows: 0
})
const excelError = ref('')
const excelDownloading = ref(false)
const previewVisible = ref(false)
const excelPreviewData = ref<any[]>([])
const previewHeaders = ref<string[]>([])

let processedExcelData: any[] = []
let processedExcelHeaders: string[] = []

const handleExcelUpload = (file: any) => {
  const rawFile = file.raw
  if (!rawFile) return
  
  excelForm.file = rawFile
  excelForm.fileName = rawFile.name
  excelForm.fileSize = formatFileSize(rawFile.size)
  excelError.value = ''
  excelProcessed.value = false
  processedExcelData = []
  processedExcelHeaders = []
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const clearExcelFile = () => {
  excelForm.file = null
  excelForm.fileName = ''
  excelForm.fileSize = ''
  excelForm.processOptions = ['remove_br']
  excelError.value = ''
  excelProcessed.value = false
  processedExcelData = []
  processedExcelHeaders = []
}

const clearExcelForm = () => {
  clearExcelFile()
}

const processExcel = async () => {
  if (!excelForm.file) {
    excelError.value = '请先上传 Excel 文件'
    return
  }
  
  excelProcessing.value = true
  excelError.value = ''
  excelProcessed.value = false
  
  try {
    const formData = new FormData()
    formData.append('file', excelForm.file)
    formData.append('processOptions', JSON.stringify(excelForm.processOptions))
    
    const response = await fetch('/api/v1/tools/excel/process', {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      throw new Error('处理失败')
    }
    
    const result = await response.json()
    
    if (result.code === 200) {
      processedExcelData = result.data.data || []
      processedExcelHeaders = result.data.headers || []
      excelStats.totalRows = result.data.totalRows || 0
      excelStats.modifiedRows = result.data.modifiedRows || 0
      excelProcessed.value = true
      
      ElMessage.success('Excel 文件处理成功')
    } else {
      throw new Error(result.message || '处理失败')
    }
  } catch (error: any) {
    excelError.value = error.message || '处理 Excel 文件时出错'
    ElMessage.error(excelError.value)
  } finally {
    excelProcessing.value = false
  }
}

const previewExcel = () => {
  if (processedExcelData.length === 0) {
    ElMessage.warning('没有可预览的数据')
    return
  }
  
  excelPreviewData.value = processedExcelData.slice(0, 100)
  previewHeaders.value = processedExcelHeaders
  previewVisible.value = true
}

const downloadExcel = async () => {
  if (!excelProcessed.value) {
    ElMessage.warning('请先处理 Excel 文件')
    return
  }
  
  excelDownloading.value = true
  
  try {
    const response = await fetch('/api/v1/tools/excel/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: processedExcelData,
        headers: processedExcelHeaders
      })
    })
    
    if (!response.ok) {
      throw new Error('下载失败')
    }
    
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `processed_${excelForm.fileName}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('文件下载成功')
  } catch (error: any) {
    ElMessage.error('下载失败：' + error.message)
  } finally {
    excelDownloading.value = false
  }
}
</script>

<style scoped>
.test-tool-container {
  height: 100%;
}

.test-tool-card {
  height: 100%;
  border-radius: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 16px;
}

.test-tool-content {
  padding: 10px;
}

.excel-tool {
  padding: 10px;
}

.excel-upload-section h4,
.excel-process-section h4,
.excel-result-section h4 {
  margin-bottom: 16px;
  color: #303133;
  font-weight: 600;
}

.excel-upload-demo {
  width: 100%;
}

.file-info-card {
  margin-top: 16px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.file-info .el-icon {
  font-size: 24px;
  color: #409EFF;
}

.file-info span {
  flex: 1;
  font-size: 14px;
  color: #606266;
}

.file-actions {
  display: flex;
  justify-content: flex-end;
}

.result-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

:deep(.el-upload-dragger) {
  padding: 40px 20px;
  border-radius: 8px;
  border: 2px dashed #d9d9d9;
  transition: border-color 0.3s ease;
}

:deep(.el-upload-dragger:hover) {
  border-color: #409EFF;
}

:deep(.el-icon--upload) {
  font-size: 48px;
  color: #409EFF;
  margin-bottom: 16px;
}

:deep(.el-upload__text) {
  color: #606266;
  font-size: 14px;
}

:deep(.el-upload__text em) {
  color: #409EFF;
  font-style: normal;
  font-weight: 500;
}

:deep(.el-upload__tip) {
  color: #909399;
  font-size: 12px;
  margin-top: 8px;
}
</style>
