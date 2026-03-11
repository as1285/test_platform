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
          <el-tab-pane label="API测试" name="api">
            <div class="api-test">
              <el-form :model="apiForm" label-width="80px">
                <el-form-item label="请求URL">
                  <el-input v-model="apiForm.url" placeholder="请输入API URL" />
                </el-form-item>
                <el-form-item label="请求方法">
                  <el-select v-model="apiForm.method" placeholder="请选择请求方法">
                    <el-option label="GET" value="GET" />
                    <el-option label="POST" value="POST" />
                    <el-option label="PUT" value="PUT" />
                    <el-option label="DELETE" value="DELETE" />
                  </el-select>
                </el-form-item>
                <el-form-item label="请求头">
                  <el-input
                    v-model="apiForm.headers"
                    type="textarea"
                    :rows="3"
                    placeholder='请输入请求头（JSON格式），例如：{"Content-Type": "application/json"}'
                  />
                </el-form-item>
                <el-form-item label="请求体">
                  <el-input
                    v-model="apiForm.body"
                    type="textarea"
                    :rows="5"
                    placeholder="请输入请求体（JSON格式）"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="sendApiRequest" :loading="apiLoading">发送请求</el-button>
                  <el-button @click="clearApiForm">清空</el-button>
                </el-form-item>
              </el-form>
              
              <div class="api-result" v-if="apiResponse">
                <h4>响应结果：</h4>
                <div class="response-header">
                  <span class="status-code" :class="{ 'success': apiResponse.status >= 200 && apiResponse.status < 300, 'error': apiResponse.status >= 400 }">
                    状态码: {{ apiResponse.status }}
                  </span>
                  <span class="response-time">响应时间: {{ apiResponse.time }}ms</span>
                </div>
                <pre class="response-body">{{ apiResponse.data }}</pre>
              </div>
              <el-alert
                v-if="apiError"
                :title="apiError"
                type="error"
                show-icon
                style="margin-top: 20px"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane label="数据生成" name="generator">
            <div class="data-generator">
              <el-form :model="generatorForm" label-width="100px">
                <el-form-item label="数据类型">
                  <el-select v-model="generatorForm.type" placeholder="请选择数据类型">
                    <el-option label="随机字符串" value="string" />
                    <el-option label="随机数字" value="number" />
                    <el-option label="随机邮箱" value="email" />
                    <el-option label="随机手机号" value="phone" />
                    <el-option label="随机身份证号" value="idcard" />
                    <el-option label="UUID" value="uuid" />
                    <el-option label="时间戳" value="timestamp" />
                  </el-select>
                </el-form-item>
                <el-form-item label="生成数量">
                  <el-input-number v-model="generatorForm.count" :min="1" :max="100" />
                </el-form-item>
                <el-form-item v-if="generatorForm.type === 'string'">
                  <el-form-item label="字符串长度" label-width="100px">
                    <el-input-number v-model="generatorForm.length" :min="1" :max="100" />
                  </el-form-item>
                </el-form-item>
                <el-form-item v-if="generatorForm.type === 'number'">
                  <el-form-item label="最小值" label-width="100px">
                    <el-input-number v-model="generatorForm.min" />
                  </el-form-item>
                  <el-form-item label="最大值" label-width="100px">
                    <el-input-number v-model="generatorForm.max" />
                  </el-form-item>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="generateData">生成数据</el-button>
                  <el-button @click="clearGeneratorForm">清空</el-button>
                  <el-button @click="copyGeneratedData" v-if="generatedData.length > 0">复制结果</el-button>
                </el-form-item>
              </el-form>
              
              <div class="generator-result" v-if="generatedData.length > 0">
                <h4>生成结果：</h4>
                <el-tag
                  v-for="(item, index) in generatedData"
                  :key="index"
                  class="generated-item"
                >
                  {{ item }}
                </el-tag>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="JSON工具" name="json">
            <div class="json-tool">
              <el-tabs v-model="jsonActiveTab">
                <el-tab-pane label="JSON解析" name="parser">
                  <div class="json-parser">
                    <el-input
                      v-model="jsonInput"
                      type="textarea"
                      :rows="10"
                      placeholder="请输入JSON字符串"
                      style="margin-bottom: 20px"
                    />
                    <el-button type="primary" @click="parseJson">解析JSON</el-button>
                    <el-button @click="clearJson">清空</el-button>
                    <el-button @click="copyJson">复制结果</el-button>
                    
                    <div class="json-result" v-if="jsonResult">
                      <h4>解析结果：</h4>
                      <pre>{{ jsonResult }}</pre>
                    </div>
                    <el-alert
                      v-if="errorMessage"
                      :title="errorMessage"
                      type="error"
                      show-icon
                      style="margin-top: 20px"
                    />
                  </div>
                </el-tab-pane>

                <el-tab-pane label="JSON对比" name="comparer">
                  <div class="json-comparer">
                    <div class="comparer-inputs">
                      <div class="input-section">
                        <h4>JSON 1：</h4>
                        <el-input
                          v-model="json1"
                          type="textarea"
                          :rows="8"
                          placeholder="请输入第一个JSON字符串"
                        />
                      </div>
                      <div class="input-section">
                        <h4>JSON 2：</h4>
                        <el-input
                          v-model="json2"
                          type="textarea"
                          :rows="8"
                          placeholder="请输入第二个JSON字符串"
                        />
                      </div>
                    </div>
                    <div class="comparer-actions">
                      <el-button type="primary" @click="compareJson">对比JSON</el-button>
                      <el-button @click="clearCompare">清空</el-button>
                    </div>
                    <div class="comparer-result" v-if="compareResult">
                      <h4>对比结果：</h4>
                      <div class="diff-list">
                        <el-alert
                          v-for="(diff, index) in compareResult"
                          :key="index"
                          :title="diff"
                          :type="diff.includes('相同') ? 'success' : 'warning'"
                          show-icon
                          style="margin-bottom: 10px"
                        />
                      </div>
                    </div>
                    <el-alert
                      v-if="compareError"
                      :title="compareError"
                      type="error"
                      show-icon
                      style="margin-top: 20px"
                    />
                  </div>
                </el-tab-pane>
              </el-tabs>
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
import axios from 'axios'

// 响应式数据
const activeTab = ref('api')

// API测试
const apiForm = reactive({
  url: '',
  method: 'GET',
  headers: '',
  body: ''
})
const apiLoading = ref(false)
const apiResponse = ref<any>(null)
const apiError = ref('')

// 数据生成
const generatorForm = reactive({
  type: 'string',
  count: 5,
  length: 10,
  min: 0,
  max: 1000
})
const generatedData = ref<string[]>([])

// JSON工具
const jsonActiveTab = ref('parser')
const jsonInput = ref('')
const jsonResult = ref('')
const errorMessage = ref('')
const json1 = ref('')
const json2 = ref('')
const compareResult = ref<string[]>([])
const compareError = ref('')

// 发送API请求
const sendApiRequest = async () => {
  if (!apiForm.url) {
    apiError.value = '请输入API URL'
    return
  }
  
  apiLoading.value = true
  apiError.value = ''
  
  try {
    // 解析请求头
    let headers = {}
    if (apiForm.headers) {
      try {
        headers = JSON.parse(apiForm.headers)
      } catch {
        apiError.value = '请求头格式错误'
        apiLoading.value = false
        return
      }
    }
    
    // 解析请求体
    let data = null
    if (apiForm.body) {
      try {
        data = JSON.parse(apiForm.body)
      } catch {
        apiError.value = '请求体格式错误'
        apiLoading.value = false
        return
      }
    }
    
    const startTime = Date.now()
    const response = await axios({
      url: apiForm.url,
      method: apiForm.method as any,
      headers,
      data
    })
    const endTime = Date.now()
    
    apiResponse.value = {
      status: response.status,
      time: endTime - startTime,
      data: JSON.stringify(response.data, null, 2)
    }
  } catch (error: any) {
    if (error.response) {
      apiResponse.value = {
        status: error.response.status,
        time: 0,
        data: JSON.stringify(error.response.data, null, 2)
      }
    } else {
      apiError.value = `请求失败：${error.message}`
    }
  } finally {
    apiLoading.value = false
  }
}

// 清空API表单
const clearApiForm = () => {
  apiForm.url = ''
  apiForm.method = 'GET'
  apiForm.headers = ''
  apiForm.body = ''
  apiResponse.value = null
  apiError.value = ''
}

// 生成数据
const generateData = () => {
  generatedData.value = []
  
  for (let i = 0; i < generatorForm.count; i++) {
    let data: string
    
    switch (generatorForm.type) {
      case 'string':
        data = generateRandomString(generatorForm.length)
        break
      case 'number':
        data = generateRandomNumber(generatorForm.min, generatorForm.max).toString()
        break
      case 'email':
        data = generateRandomEmail()
        break
      case 'phone':
        data = generateRandomPhone()
        break
      case 'idcard':
        data = generateRandomIdCard()
        break
      case 'uuid':
        data = generateUUID()
        break
      case 'timestamp':
        data = Date.now().toString()
        break
      default:
        data = ''
    }
    
    generatedData.value.push(data)
  }
}

// 生成随机字符串
const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 生成随机数字
const generateRandomNumber = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 生成随机邮箱
const generateRandomEmail = (): string => {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', '163.com', 'qq.com']
  const username = generateRandomString(8)
  const domain = domains[Math.floor(Math.random() * domains.length)]
  return `${username}@${domain}`
}

// 生成随机手机号
const generateRandomPhone = (): string => {
  const prefixes = ['130', '131', '132', '133', '134', '135', '136', '137', '138', '139', '150', '151', '152', '153', '155', '156', '157', '158', '159', '180', '181', '182', '183', '184', '185', '186', '187', '188', '189']
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  const suffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0')
  return `${prefix}${suffix}`
}

// 生成随机身份证号（简化版）
const generateRandomIdCard = (): string => {
  const areaCode = Math.floor(Math.random() * 900000 + 100000).toString()
  const birthYear = (1950 + Math.floor(Math.random() * 70)).toString()
  const birthMonth = (1 + Math.floor(Math.random() * 12)).toString().padStart(2, '0')
  const birthDay = (1 + Math.floor(Math.random() * 28)).toString().padStart(2, '0')
  const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  const checkCode = '0123456789X'[Math.floor(Math.random() * 11)]
  return `${areaCode}${birthYear}${birthMonth}${birthDay}${sequence}${checkCode}`
}

// 生成UUID
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// 清空生成器表单
const clearGeneratorForm = () => {
  generatorForm.type = 'string'
  generatorForm.count = 5
  generatorForm.length = 10
  generatorForm.min = 0
  generatorForm.max = 1000
  generatedData.value = []
}

// 复制生成的数据
const copyGeneratedData = () => {
  if (generatedData.value.length === 0) return
  
  const data = generatedData.value.join('\n')
  navigator.clipboard.writeText(data)
    .then(() => {
      ElMessage.success('复制成功')
    })
    .catch(() => {
      ElMessage.error('复制失败')
    })
}

// JSON工具方法
// 解析JSON
const parseJson = () => {
  if (!jsonInput.value) {
    errorMessage.value = '请输入JSON字符串'
    jsonResult.value = ''
    return
  }
  
  try {
    const parsed = JSON.parse(jsonInput.value)
    jsonResult.value = JSON.stringify(parsed, null, 2)
    errorMessage.value = ''
  } catch (error: any) {
    errorMessage.value = `解析错误：${error.message}`
    jsonResult.value = ''
  }
}

// 清空JSON解析
const clearJson = () => {
  jsonInput.value = ''
  jsonResult.value = ''
  errorMessage.value = ''
}

// 复制结果
const copyJson = () => {
  if (!jsonResult.value) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  
  navigator.clipboard.writeText(jsonResult.value)
    .then(() => {
      ElMessage.success('复制成功')
    })
    .catch(() => {
      ElMessage.error('复制失败')
    })
}

// 对比JSON
const compareJson = () => {
  if (!json1.value || !json2.value) {
    compareError.value = '请输入两个JSON字符串'
    compareResult.value = []
    return
  }
  
  try {
    const parsed1 = JSON.parse(json1.value)
    const parsed2 = JSON.parse(json2.value)
    
    const diffs = compareObjects(parsed1, parsed2)
    compareResult.value = diffs
    compareError.value = ''
  } catch (error: any) {
    compareError.value = `解析错误：${error.message}`
    compareResult.value = []
  }
}

// 递归对比对象
const compareObjects = (obj1: any, obj2: any, path: string = ''): string[] => {
  const diffs: string[] = []
  
  // 获取所有键
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)
  const allKeys = new Set([...keys1, ...keys2])
  
  allKeys.forEach(key => {
    const currentPath = path ? `${path}.${key}` : key
    
    if (!keys1.includes(key)) {
      diffs.push(`${currentPath}: 仅在JSON 2中存在`)
    } else if (!keys2.includes(key)) {
      diffs.push(`${currentPath}: 仅在JSON 1中存在`)
    } else {
      const val1 = obj1[key]
      const val2 = obj2[key]
      
      if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
        diffs.push(...compareObjects(val1, val2, currentPath))
      } else if (val1 !== val2) {
        diffs.push(`${currentPath}: 不同 - JSON 1: ${JSON.stringify(val1)}, JSON 2: ${JSON.stringify(val2)}`)
      }
    }
  })
  
  if (diffs.length === 0) {
    diffs.push('两个JSON完全相同')
  }
  
  return diffs
}

// 清空对比
const clearCompare = () => {
  json1.value = ''
  json2.value = ''
  compareResult.value = []
  compareError.value = ''
}
</script>

<style scoped>
.test-tool-container {
  padding: 20px;
}

.test-tool-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.api-test {
  margin-top: 20px;
}

.api-result {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
  overflow: auto;
  max-height: 400px;
}

.response-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-weight: bold;
}

.status-code {
  padding: 2px 8px;
  border-radius: 4px;
}

.status-code.success {
  background-color: #f0f9ff;
  color: #1890ff;
}

.status-code.error {
  background-color: #fff2f0;
  color: #ff4d4f;
}

.response-body {
  margin: 0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  white-space: pre-wrap;
}

.data-generator {
  margin-top: 20px;
}

.generator-result {
  margin-top: 20px;
}

.generated-item {
  margin: 5px;
  display: inline-block;
}

/* JSON工具样式 */
.json-tool {
  margin-top: 20px;
}

.json-parser {
  margin-top: 20px;
}

.json-result {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
  overflow: auto;
  max-height: 400px;
}

.json-result pre {
  margin: 0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  white-space: pre-wrap;
}

.json-comparer {
  margin-top: 20px;
}

.comparer-inputs {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.input-section {
  flex: 1;
}

.input-section h4 {
  margin-top: 0;
  margin-bottom: 10px;
}

.comparer-actions {
  margin-bottom: 20px;
}

.comparer-result {
  margin-top: 20px;
}

.diff-list {
  margin-top: 10px;
}

@media screen and (max-width: 768px) {
  .comparer-inputs {
    flex-direction: column;
  }
}
</style>