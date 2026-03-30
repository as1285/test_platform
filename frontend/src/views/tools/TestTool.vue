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
          
          <el-tab-pane label="Cron 表达式" name="cron">
            <div class="cron-tool">
              <h4>Cron 表达式生成器</h4>
              <div class="cron-content">
                <el-form :model="cronForm" label-width="100px">
                  <el-form-item label="秒">
                    <el-select v-model="cronForm.second" placeholder="选择秒">
                      <el-option label="每秒" value="*" />
                      <el-option label="每 5 秒" value="*/5" />
                      <el-option label="每 10 秒" value="*/10" />
                      <el-option label="每 30 秒" value="*/30" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="分">
                    <el-select v-model="cronForm.minute" placeholder="选择分">
                      <el-option label="每分" value="*" />
                      <el-option label="每 5 分" value="*/5" />
                      <el-option label="每 10 分" value="*/10" />
                      <el-option label="每 30 分" value="*/30" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="时">
                    <el-select v-model="cronForm.hour" placeholder="选择时">
                      <el-option label="每时" value="*" />
                      <el-option label="每天 10 点" value="10" />
                      <el-option label="每天 12 点" value="12" />
                      <el-option label="每天 18 点" value="18" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="日">
                    <el-select v-model="cronForm.day" placeholder="选择日">
                      <el-option label="每天" value="*" />
                      <el-option label="每月 1 日" value="1" />
                      <el-option label="每月 15 日" value="15" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="月">
                    <el-select v-model="cronForm.month" placeholder="选择月">
                      <el-option label="每月" value="*" />
                      <el-option label="1 月" value="1" />
                      <el-option label="6 月" value="6" />
                      <el-option label="12 月" value="12" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="周">
                    <el-select v-model="cronForm.week" placeholder="选择周">
                      <el-option label="每天" value="*" />
                      <el-option label="周一" value="1" />
                      <el-option label="周五" value="5" />
                      <el-option label="周日" value="0" />
                    </el-select>
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="generateCron">生成 Cron 表达式</el-button>
                    <el-button @click="copyCron" v-if="cronResult">复制结果</el-button>
                  </el-form-item>
                </el-form>
                <div v-if="cronResult" class="result-card">
                  <el-card shadow="hover">
                    <template #header>
                      <div class="result-header">
                        <span>生成结果</span>
                      </div>
                    </template>
                    <div class="result-content">
                      <code>{{ cronResult }}</code>
                    </div>
                  </el-card>
                </div>
              </div>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="编码转换" name="encoding">
            <div class="encoding-tool">
              <h4>编码转换工具</h4>
              <div class="encoding-content">
                <el-form :model="encodingForm" label-width="100px">
                  <el-form-item label="输入文本">
                    <el-input
                      v-model="encodingForm.input"
                      type="textarea"
                      rows="4"
                      placeholder="请输入要转换的文本"
                    />
                  </el-form-item>
                  <el-form-item label="转换类型">
                    <el-select v-model="encodingForm.type" placeholder="选择转换类型">
                      <el-option label="UTF-8 到 Base64" value="utf8_to_base64" />
                      <el-option label="Base64 到 UTF-8" value="base64_to_utf8" />
                      <el-option label="UTF-8 到 Hex" value="utf8_to_hex" />
                      <el-option label="Hex 到 UTF-8" value="hex_to_utf8" />
                      <el-option label="URL 编码" value="url_encode" />
                      <el-option label="URL 解码" value="url_decode" />
                    </el-select>
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="convertEncoding">开始转换</el-button>
                    <el-button @click="copyEncodingResult" v-if="encodingResult">复制结果</el-button>
                  </el-form-item>
                </el-form>
                <div v-if="encodingResult" class="result-card">
                  <el-card shadow="hover">
                    <template #header>
                      <div class="result-header">
                        <span>转换结果</span>
                      </div>
                    </template>
                    <div class="result-content">
                      <code>{{ encodingResult }}</code>
                    </div>
                  </el-card>
                </div>
              </div>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="时间转换" name="time">
            <div class="time-tool">
              <h4>时间转换工具</h4>
              <div class="time-content">
                <el-form :model="timeForm" label-width="100px">
                  <el-form-item label="输入时间">
                    <el-date-picker
                      v-model="timeForm.input"
                      type="datetime"
                      placeholder="选择时间"
                      style="width: 100%"
                    />
                  </el-form-item>
                  <el-form-item label="转换类型">
                    <el-select v-model="timeForm.type" placeholder="选择转换类型">
                      <el-option label="时间戳 (秒)" value="to_timestamp" />
                      <el-option label="时间戳 (毫秒)" value="to_timestamp_ms" />
                      <el-option label="ISO 格式" value="to_iso" />
                      <el-option label="友好格式" value="to_friendly" />
                    </el-select>
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="convertTime">开始转换</el-button>
                    <el-button @click="copyTimeResult" v-if="timeResult">复制结果</el-button>
                  </el-form-item>
                </el-form>
                <div v-if="timeResult" class="result-card">
                  <el-card shadow="hover">
                    <template #header>
                      <div class="result-header">
                        <span>转换结果</span>
                      </div>
                    </template>
                    <div class="result-content">
                      <code>{{ timeResult }}</code>
                    </div>
                  </el-card>
                </div>
              </div>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="二维码" name="qrcode">
            <div class="qrcode-tool">
              <h4>二维码生成与识别</h4>
              <div class="qrcode-content">
                <el-form :model="qrcodeForm" label-width="100px">
                  <el-form-item label="输入内容">
                    <el-input
                      v-model="qrcodeForm.input"
                      type="textarea"
                      rows="4"
                      placeholder="请输入要生成二维码的内容"
                    />
                  </el-form-item>
                  <el-form-item label="二维码尺寸">
                    <el-slider v-model="qrcodeForm.size" :min="128" :max="512" :step="32" />
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="generateQRCode">生成二维码</el-button>
                  </el-form-item>
                </el-form>
                <div v-if="qrcodeResult" class="result-card">
                  <el-card shadow="hover">
                    <template #header>
                      <div class="result-header">
                        <span>二维码</span>
                      </div>
                    </template>
                    <div class="qrcode-result">
                      <img :src="qrcodeResult" alt="二维码" style="max-width: 100%" />
                    </div>
                  </el-card>
                </div>
              </div>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="正则表达式" name="regex">
            <div class="regex-tool">
              <h4>正则表达式生成与测试</h4>
              <div class="regex-content">
                <el-form :model="regexForm" label-width="100px">
                  <el-form-item label="正则表达式">
                    <el-input v-model="regexForm.pattern" placeholder="输入正则表达式" />
                  </el-form-item>
                  <el-form-item label="测试文本">
                    <el-input
                      v-model="regexForm.testText"
                      type="textarea"
                      rows="4"
                      placeholder="输入要测试的文本"
                    />
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="testRegex">测试正则</el-button>
                  </el-form-item>
                </el-form>
                <div v-if="regexResult" class="result-card">
                  <el-card shadow="hover">
                    <template #header>
                      <div class="result-header">
                        <span>测试结果</span>
                      </div>
                    </template>
                    <div class="regex-result">
                      <div v-for="(match, index) in regexResult" :key="index" class="match-item">
                        <span class="match-index">匹配 {{ index + 1 }}:</span>
                        <code>{{ match }}</code>
                      </div>
                      <div v-if="regexResult.length === 0" class="no-match">
                        无匹配结果
                      </div>
                    </div>
                  </el-card>
                </div>
              </div>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="加密解密" name="encryption">
            <div class="encryption-tool">
              <h4>加密解密工具</h4>
              <div class="encryption-content">
                <el-form :model="encryptionForm" label-width="100px">
                  <el-form-item label="输入文本">
                    <el-input
                      v-model="encryptionForm.input"
                      type="textarea"
                      rows="4"
                      placeholder="请输入要加密/解密的文本"
                    />
                  </el-form-item>
                  <el-form-item label="操作类型">
                    <el-select v-model="encryptionForm.type" placeholder="选择操作类型">
                      <el-option label="MD5 加密" value="md5" />
                      <el-option label="SHA1 加密" value="sha1" />
                      <el-option label="Base64 加密" value="base64_encode" />
                      <el-option label="Base64 解密" value="base64_decode" />
                    </el-select>
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="encryptDecrypt">执行操作</el-button>
                    <el-button @click="copyEncryptionResult" v-if="encryptionResult">复制结果</el-button>
                  </el-form-item>
                </el-form>
                <div v-if="encryptionResult" class="result-card">
                  <el-card shadow="hover">
                    <template #header>
                      <div class="result-header">
                        <span>操作结果</span>
                      </div>
                    </template>
                    <div class="result-content">
                      <code>{{ encryptionResult }}</code>
                    </div>
                  </el-card>
                </div>
              </div>
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

// Cron 表达式生成器
const cronForm = reactive({
  second: '*',
  minute: '*',
  hour: '*',
  day: '*',
  month: '*',
  week: '*'
})

const cronResult = ref('')

const generateCron = () => {
  cronResult.value = `${cronForm.second} ${cronForm.minute} ${cronForm.hour} ${cronForm.day} ${cronForm.month} ${cronForm.week}`
  ElMessage.success('Cron 表达式生成成功')
}

const copyCron = () => {
  if (cronResult.value) {
    navigator.clipboard.writeText(cronResult.value)
    ElMessage.success('复制成功')
  }
}

// 编码转换工具
const encodingForm = reactive({
  input: '',
  type: 'utf8_to_base64'
})

const encodingResult = ref('')

const convertEncoding = () => {
  if (!encodingForm.input) {
    ElMessage.warning('请输入要转换的文本')
    return
  }
  
  try {
    switch (encodingForm.type) {
      case 'utf8_to_base64':
        encodingResult.value = btoa(unescape(encodeURIComponent(encodingForm.input)))
        break
      case 'base64_to_utf8':
        encodingResult.value = decodeURIComponent(escape(atob(encodingForm.input)))
        break
      case 'utf8_to_hex':
        encodingResult.value = Array.from(encodingForm.input).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
        break
      case 'hex_to_utf8':
        encodingResult.value = encodingForm.input.match(/.{1,2}/g)?.map(h => String.fromCharCode(parseInt(h, 16))).join('') || ''
        break
      case 'url_encode':
        encodingResult.value = encodeURIComponent(encodingForm.input)
        break
      case 'url_decode':
        encodingResult.value = decodeURIComponent(encodingForm.input)
        break
    }
    ElMessage.success('转换成功')
  } catch (error) {
    ElMessage.error('转换失败')
  }
}

const copyEncodingResult = () => {
  if (encodingResult.value) {
    navigator.clipboard.writeText(encodingResult.value)
    ElMessage.success('复制成功')
  }
}

// 时间转换工具
const timeForm = reactive({
  input: new Date(),
  type: 'to_timestamp'
})

const timeResult = ref('')

const convertTime = () => {
  if (!timeForm.input) {
    ElMessage.warning('请选择时间')
    return
  }
  
  const date = new Date(timeForm.input)
  
  switch (timeForm.type) {
    case 'to_timestamp':
      timeResult.value = Math.floor(date.getTime() / 1000).toString()
      break
    case 'to_timestamp_ms':
      timeResult.value = date.getTime().toString()
      break
    case 'to_iso':
      timeResult.value = date.toISOString()
      break
    case 'to_friendly':
      timeResult.value = date.toLocaleString()
      break
  }
  
  ElMessage.success('转换成功')
}

const copyTimeResult = () => {
  if (timeResult.value) {
    navigator.clipboard.writeText(timeResult.value)
    ElMessage.success('复制成功')
  }
}

// 二维码生成工具
const qrcodeForm = reactive({
  input: 'https://www.example.com',
  size: 256
})

const qrcodeResult = ref('')

const generateQRCode = () => {
  if (!qrcodeForm.input) {
    ElMessage.warning('请输入要生成二维码的内容')
    return
  }
  
  // 使用第三方服务生成二维码
  const encodedContent = encodeURIComponent(qrcodeForm.input)
  qrcodeResult.value = `https://api.qrserver.com/v1/create-qr-code/?size=${qrcodeForm.size}x${qrcodeForm.size}&data=${encodedContent}`
  
  ElMessage.success('二维码生成成功')
}

// 正则表达式测试工具
const regexForm = reactive({
  pattern: '',
  testText: ''
})

const regexResult = ref<string[]>([])

const testRegex = () => {
  if (!regexForm.pattern) {
    ElMessage.warning('请输入正则表达式')
    return
  }
  
  try {
    const regex = new RegExp(regexForm.pattern, 'g')
    const matches = regexForm.testText.match(regex)
    regexResult.value = matches || []
    ElMessage.success('测试完成')
  } catch (error) {
    ElMessage.error('正则表达式格式错误')
  }
}

// 加密解密工具
const encryptionForm = reactive({
  input: '',
  type: 'md5'
})

const encryptionResult = ref('')

const encryptDecrypt = async () => {
  if (!encryptionForm.input) {
    ElMessage.warning('请输入要处理的文本')
    return
  }
  
  try {
    switch (encryptionForm.type) {
      case 'md5':
        encryptionResult.value = await md5(encryptionForm.input)
        break
      case 'sha1':
        encryptionResult.value = await sha1(encryptionForm.input)
        break
      case 'base64_encode':
        encryptionResult.value = btoa(unescape(encodeURIComponent(encryptionForm.input)))
        break
      case 'base64_decode':
        encryptionResult.value = decodeURIComponent(escape(atob(encryptionForm.input)))
        break
    }
    ElMessage.success('操作成功')
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const copyEncryptionResult = () => {
  if (encryptionResult.value) {
    navigator.clipboard.writeText(encryptionResult.value)
    ElMessage.success('复制成功')
  }
}

// 辅助函数：MD5 加密
const md5 = async (str: string): Promise<string> => {
  const crypto = window.crypto || (window as any).msCrypto
  if (!crypto) {
    ElMessage.error('浏览器不支持加密功能')
    return ''
  }
  
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hash = await crypto.subtle.digest('MD5', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// 辅助函数：SHA1 加密
const sha1 = async (str: string): Promise<string> => {
  const crypto = window.crypto || (window as any).msCrypto
  if (!crypto) {
    ElMessage.error('浏览器不支持加密功能')
    return ''
  }
  
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hash = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
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

/* 其他工具样式 */
.cron-tool,
.encoding-tool,
.time-tool,
.qrcode-tool,
.regex-tool,
.encryption-tool {
  padding: 10px;
}

.cron-content,
.encoding-content,
.time-content,
.qrcode-content,
.regex-content,
.encryption-content {
  margin-top: 16px;
}

.result-card {
  margin-top: 20px;
}

.result-header {
  font-weight: 600;
  font-size: 14px;
}

.result-content {
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
  overflow-x: auto;
}

.result-content code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-all;
}

.qrcode-result {
  text-align: center;
  padding: 20px;
}

.qrcode-result img {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.regex-result {
  padding: 10px;
}

.match-item {
  margin-bottom: 8px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.match-index {
  font-weight: 600;
  min-width: 80px;
}

.no-match {
  color: #909399;
  text-align: center;
  padding: 20px;
}

/* 工具标题样式 */
.cron-tool h4,
.encoding-tool h4,
.time-tool h4,
.qrcode-tool h4,
.regex-tool h4,
.encryption-tool h4 {
  margin-bottom: 16px;
  color: #303133;
  font-weight: 600;
  font-size: 16px;
}

/* 响应式调整 */
@media screen and (max-width: 768px) {
  .test-tool-content {
    padding: 5px;
  }
  
  .cron-tool,
  .encoding-tool,
  .time-tool,
  .qrcode-tool,
  .regex-tool,
  .encryption-tool {
    padding: 5px;
  }
  
  .result-content {
    padding: 5px;
  }
  
  .qrcode-result {
    padding: 10px;
  }
}
</style>
