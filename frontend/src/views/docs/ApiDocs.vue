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
      
      <!-- 前端架构部分 -->
      <el-collapse v-model="activeArchitecture">
        <el-collapse-item name="frontend-architecture">
          <template #title>
            <span class="category-title">前端架构</span>
            <span class="category-desc">前端项目的技术栈和架构设计</span>
          </template>
          <div class="architecture-section">
            <h4>技术栈</h4>
            <el-table :data="techStack" size="small" border>
              <el-table-column prop="name" label="技术" width="160" />
              <el-table-column prop="version" label="版本" width="120" />
              <el-table-column prop="description" label="说明" />
            </el-table>
            
            <h4>目录结构</h4>
            <pre class="directory-structure">
{{ directoryStructure }}
            </pre>
            
            <h4>性能优化</h4>
            <el-list>
              <el-list-item v-for="(item, index) in performanceOptimizations" :key="index">
                <template #prefix>
                  <el-icon class="info-icon"><i-ep-info /></el-icon>
                </template>
                {{ item }}
              </el-list-item>
            </el-list>
          </div>
        </el-collapse-item>
      </el-collapse>
      
      <el-divider></el-divider>
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
const activeArchitecture = ref(['frontend-architecture'])
const loading = ref(false)

// 技术栈数据
const techStack = ref([
  { name: 'Vue', version: '3.5+', description: '前端框架' },
  { name: 'TypeScript', version: '5.6+', description: '类型系统' },
  { name: 'Element Plus', version: '2.8+', description: 'UI组件库' },
  { name: 'Pinia', version: '2.3+', description: '状态管理' },
  { name: 'Vue Router', version: '4.4+', description: '路由管理' },
  { name: 'Axios', version: '1.7+', description: 'HTTP客户端' },
  { name: 'ECharts', version: '5.5+', description: '数据可视化' },
  { name: 'Vite', version: '6.0+', description: '构建工具' }
])

// 目录结构数据
const directoryStructure = ref(`frontend/
├── public/            # 静态资源
├── src/
│   ├── assets/        # 资源文件
│   ├── components/    # 通用组件
│   │   ├── api/       # API相关组件
│   │   ├── form/      # 表单组件
│   │   ├── table/     # 表格组件
│   │   └── chart/     # 图表组件
│   ├── views/         # 页面组件
│   │   ├── dashboard/ # 仪表盘
│   │   ├── case/      # 用例管理
│   │   ├── test/      # 测试执行
│   │   ├── performance/ # 性能测试
│   │   ├── robustness/ # 鲁棒性测试
│   │   ├── report/    # 报告管理
│   │   ├── docs/      # 接口文档
│   │   ├── user/      # 用户管理
│   │   └── login/     # 登录页面
│   ├── api/           # API调用管理
│   │   ├── index.ts   # API基础配置
│   │   ├── user.ts    # 用户相关API
│   │   ├── case.ts    # 用例相关API
│   │   ├── test.ts    # 测试相关API
│   │   └── report.ts  # 报告相关API
│   ├── store/         # Pinia状态管理
│   │   ├── index.ts   # Pinia初始化
│   │   ├── user.ts    # 用户状态
│   │   ├── case.ts    # 用例状态
│   │   ├── test.ts    # 测试状态
│   │   └── report.ts  # 报告状态
│   ├── utils/         # 工具函数
│   │   ├── index.ts   # 工具函数入口
│   │   ├── date.ts    # 日期工具
│   │   ├── number.ts  # 数字工具
│   │   └── string.ts  # 字符串工具
│   ├── router/        # 路由配置
│   ├── App.vue        # 根组件
│   └── main.ts        # 入口文件
├── .env               # 环境变量
├── index.html         # HTML模板
├── package.json       # 项目配置
├── tsconfig.json      # TypeScript配置
└── vite.config.ts     # Vite配置`)

// 性能优化数据
const performanceOptimizations = ref([
  '路由懒加载：减少初始加载时间',
  '代码分割：使用动态导入拆分大型组件',
  '资源优化：图片压缩、按需引入Element Plus组件',
  '构建优化：配置Vite的构建选项，优化打包结果',
  '渲染优化：使用虚拟列表处理长列表',
  '防抖和节流：减少频繁操作，提升性能',
  '合理使用Vue的计算属性和监听器' ])

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

.architecture-section {
  padding: 10px 0;
}

.architecture-section h4 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.directory-structure {
  background-color: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 12px;
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  overflow-x: auto;
  margin: 10px 0;
}

.info-icon {
  color: #409eff;
}
</style>

