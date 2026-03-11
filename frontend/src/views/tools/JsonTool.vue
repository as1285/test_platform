<template>
  <div class="json-tool-container">
    <el-card class="json-tool-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>JSON解析对比工具</span>
        </div>
      </template>

      <div class="json-tool-content">
        <el-tabs v-model="activeTab">
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
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

// 响应式数据
const activeTab = ref('parser')

// JSON解析
const jsonInput = ref('')
const jsonResult = ref('')
const errorMessage = ref('')

// JSON对比
const json1 = ref('')
const json2 = ref('')
const compareResult = ref<string[]>([])
const compareError = ref('')

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
.json-tool-container {
  padding: 20px;
}

.json-tool-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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