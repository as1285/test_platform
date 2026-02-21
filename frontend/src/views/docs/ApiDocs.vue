<template>
  <div class="docs-container">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>接口文档</span>
        </div>
      </template>
      <el-alert
        type="info"
        show-icon
        title="说明"
        class="docs-alert"
      >
        <p>所有接口统一前缀为 <code>/api/v1</code>，返回结构统一为 <code>{ code, message, data }</code>，部分分页接口额外包含 <code>pagination</code> 字段。</p>
      </el-alert>
      <el-collapse v-model="activeCategories">
        <el-collapse-item
          v-for="category in categories"
          :key="category.name"
          :name="category.name"
        >
          <template #title>
            <span class="category-title">{{ category.name }}</span>
            <span class="category-desc">{{ category.description }}</span>
          </template>
          <div
            v-for="api in category.apis"
            :key="api.path + api.method"
            class="api-block"
          >
            <div class="api-header">
              <el-tag
                :type="getMethodTagType(api.method)"
                size="small"
              >
                {{ api.method }}
              </el-tag>
              <span class="api-path">/api/v1{{ api.path }}</span>
              <el-tag
                v-if="api.requires_auth"
                type="warning"
                size="small"
              >
                需要登录
              </el-tag>
            </div>
            <div class="api-desc">
              {{ api.description }}
            </div>
            <div class="api-section">
              <h4>请求参数</h4>
              <div class="api-params">
                <div
                  v-if="api.request.headers && api.request.headers.length"
                  class="param-group"
                >
                  <h5>Header</h5>
                  <el-table
                    :data="api.request.headers"
                    size="small"
                    border
                  >
                    <el-table-column prop="name" label="字段名" width="160" />
                    <el-table-column prop="type" label="类型" width="120" />
                    <el-table-column prop="required" label="必填" width="80">
                      <template #default="{ row }">
                        <span>{{ row.required ? '是' : '否' }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="description" label="说明" />
                  </el-table>
                </div>
                <div
                  v-if="api.request.query && api.request.query.length"
                  class="param-group"
                >
                  <h5>Query</h5>
                  <el-table
                    :data="api.request.query"
                    size="small"
                    border
                  >
                    <el-table-column prop="name" label="字段名" width="160" />
                    <el-table-column prop="type" label="类型" width="120" />
                    <el-table-column prop="required" label="必填" width="80">
                      <template #default="{ row }">
                        <span>{{ row.required ? '是' : '否' }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="description" label="说明" />
                  </el-table>
                </div>
                <div
                  v-if="api.request.body && api.request.body.length"
                  class="param-group"
                >
                  <h5>Body</h5>
                  <el-table
                    :data="api.request.body"
                    size="small"
                    border
                  >
                    <el-table-column prop="name" label="字段名" width="160" />
                    <el-table-column prop="type" label="类型" width="120" />
                    <el-table-column prop="required" label="必填" width="80">
                      <template #default="{ row }">
                        <span>{{ row.required ? '是' : '否' }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="description" label="说明" />
                  </el-table>
                </div>
                <div
                  v-if="!hasRequestParams(api)"
                  class="param-empty"
                >
                  无特殊请求参数
                </div>
              </div>
            </div>
            <div class="api-section">
              <h4>响应字段</h4>
              <p class="response-desc">{{ api.response.description }}</p>
              <el-table
                :data="api.response.fields"
                size="small"
                border
              >
                <el-table-column prop="name" label="字段名" width="200" />
                <el-table-column prop="type" label="类型" width="140" />
                <el-table-column prop="required" label="必填" width="80">
                  <template #default="{ row }">
                    <span>{{ row.required ? '是' : '否' }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="description" label="说明" />
              </el-table>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

interface ApiField {
  name: string
  type: string
  required: boolean
  description: string
}

interface ApiRequest {
  headers?: ApiField[]
  query?: ApiField[]
  body?: ApiField[]
}

interface ApiResponse {
  description: string
  fields: ApiField[]
}

interface ApiDoc {
  name: string
  method: string
  path: string
  requires_auth: boolean
  description: string
  request: ApiRequest
  response: ApiResponse
}

interface ApiCategory {
  name: string
  description: string
  apis: ApiDoc[]
}

const categories = ref<ApiCategory[]>([])
const activeCategories = ref<string[]>([])
const loading = ref(false)

const hasRequestParams = (api: ApiDoc) => {
  const request = api.request || {}
  const headers = request.headers || []
  const query = request.query || []
  const body = request.body || []
  return headers.length > 0 || query.length > 0 || body.length > 0
}

const getMethodTagType = (method: string) => {
  const upper = method.toUpperCase()
  if (upper === 'GET') {
    return 'success'
  }
  if (upper === 'POST') {
    return 'primary'
  }
  if (upper === 'PUT' || upper === 'PATCH') {
    return 'warning'
  }
  if (upper === 'DELETE') {
    return 'danger'
  }
  return 'info'
}

const loadDocs = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/v1/docs')
    if (response.data.code !== 200) {
      ElMessage.error(response.data.message || '获取接口文档失败')
      return
    }
    const data = response.data.data || {}
    const list = (data.categories || []) as ApiCategory[]
    categories.value = list
    activeCategories.value = list.map(item => item.name)
  } catch (error) {
    ElMessage.error('获取接口文档失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDocs()
})
</script>

<style scoped>
.docs-container {
  padding: 0;
}

.page-card {
  min-height: calc(100vh - 100px);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.docs-alert {
  margin-bottom: 16px;
}

.category-title {
  font-weight: 600;
  margin-right: 12px;
}

.category-desc {
  font-size: 13px;
  color: #909399;
}

.api-block {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background-color: #ffffff;
}

.api-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.api-path {
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 13px;
}

.api-desc {
  font-size: 13px;
  color: #606266;
  margin-bottom: 10px;
}

.api-section {
  margin-top: 10px;
}

.api-section h4 {
  margin: 0 0 6px;
  font-size: 14px;
}

.api-params {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.param-group h5 {
  margin: 0 0 4px;
  font-size: 13px;
  color: #606266;
}

.param-empty {
  font-size: 13px;
  color: #909399;
}

.response-desc {
  font-size: 13px;
  color: #606266;
  margin: 0 0 6px;
}
</style>

