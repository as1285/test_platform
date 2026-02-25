<template>
  <div class="case-container">
    <el-card class="case-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>用例管理</span>
          <div class="header-actions">
            <el-button type="primary" size="small" @click="handleAddCaseGroup" :loading="loading">
              <el-icon><i-ep-folder-add /></el-icon>
              添加分组
            </el-button>
            <el-button type="primary" size="small" @click="handleAddTestCase" :loading="loading">
              <el-icon><i-ep-document-add /></el-icon>
              添加用例
            </el-button>
            <el-button size="small" @click="loadData" :loading="loading">
              <el-icon><i-ep-refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <div class="case-content">
        <!-- 左侧分组树 -->
        <div class="case-sidebar">
          <el-tree
            ref="groupTree"
            :data="caseGroups"
            :props="treeProps"
            :expand-on-click-node="false"
            node-key="id"
            @node-click="handleNodeClick"
            @node-contextmenu="handleNodeContextMenu"
            v-loading="groupLoading"
          >
            <template #default="{ data }">
              <span class="tree-node">
                <span class="node-label">
                  <el-icon><i-ep-folder /></el-icon>
                  <span>{{ data.name }}</span>
                </span>
                <span class="node-actions">
                  <el-button
                    type="primary"
                    size="small"
                    circle
                    @click.stop="handleEditGroup(data)"
                    title="编辑分组"
                    style="color: #409eff; background: white; border: 1px solid #409eff;"
                  >
                    <el-icon><i-ep-edit /></el-icon>
                  </el-button>
                  <el-button
                    type="danger"
                    size="small"
                    circle
                    @click.stop="handleDeleteCaseGroup(data)"
                    title="删除分组"
                    style="color: black; background: #ff4d4f; border: 1px solid black;"
                  >
                    <el-icon><i-ep-delete /></el-icon>
                  </el-button>
                </span>
              </span>
            </template>
          </el-tree>
        </div>

        <!-- 右侧用例列表 -->
        <div class="case-main">
          <div class="case-toolbar">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索用例"
              clearable
              style="width: 200px; margin-right: 10px"
              @keyup.enter="handleSearch"
            >
              <template #prefix>
                <el-icon><i-ep-search /></el-icon>
              </template>
            </el-input>
            <el-select
              v-model="caseStatus"
              placeholder="状态"
              clearable
              style="width: 120px; margin-right: 10px"
              @change="handleSearch"
            >
              <el-option label="全部" value="" />
              <el-option label="启用" value="enabled" />
              <el-option label="禁用" value="disabled" />
            </el-select>
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="resetSearch">重置</el-button>
            <el-button
              type="danger"
              :disabled="!multipleSelection.length"
              @click="handleBatchDeleteTestCases"
            >
              批量删除
            </el-button>
          </div>

          <el-table
            ref="caseTable"
            :data="caseList"
            style="width: 100%"
            border
            v-loading="loading"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="55" />
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="name" label="用例名称" min-width="200" />
            <el-table-column prop="description" label="描述" min-width="300" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'enabled' ? 'success' : 'warning'">
                  {{ scope.row.status === 'enabled' ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="create_time" label="创建时间" width="180">
              <template #default="scope">
                {{ formatDate(scope.row.create_time) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="scope">
                <el-button
                  type="info"
                  size="small"
                  @click="handleEditTestCase(scope.row)"
                >
                  <el-icon><i-ep-edit /></el-icon>
                  编辑
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  @click="handleDeleteTestCase(scope.row)"
                >
                  <el-icon><i-ep-delete /></el-icon>
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="case-pagination">
            <el-pagination
              v-model:current-page="pagination.currentPage"
              v-model:page-size="pagination.pageSize"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next, jumper"
              :total="pagination.total"
              @size-change="handleSizeChange"
              @current-change="handleCurrentChange"
            />
          </div>
        </div>
      </div>
    </el-card>

    <!-- 添加/编辑分组对话框 -->
    <el-dialog
      v-model="showGroupDialog"
      :title="isEditGroup ? '编辑分组' : '添加分组'"
      width="400px"
    >
      <el-form
        ref="groupFormRef"
        :model="groupForm"
        :rules="groupRules"
        label-position="top"
      >
        <el-form-item label="分组名称" prop="name">
          <el-input v-model="groupForm.name" placeholder="请输入分组名称" />
        </el-form-item>
        <el-form-item label="父分组" prop="parent_id">
          <el-select v-model="groupForm.parent_id" placeholder="请选择父分组" clearable>
            <el-option label="根分组" :value="null" />
            <el-option
              v-for="group in caseGroups"
              :key="group.id"
              :label="group.name"
              :value="group.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showGroupDialog = false">取消</el-button>
          <el-button type="primary" @click="handleSaveGroup" :loading="saving">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 添加/编辑用例对话框 -->
    <el-dialog
      v-model="showCaseDialog"
      :title="isEditCase ? '编辑用例' : '添加用例'"
      width="800px"
    >
      <el-form
        ref="caseFormRef"
        :model="caseForm"
        :rules="caseRules"
        label-width="100px"
      >
        <el-tabs v-model="activeTab">
          <el-tab-pane label="基本信息" name="basic">
            <el-form-item label="用例名称" prop="name">
              <el-input v-model="caseForm.name" placeholder="请输入用例名称" />
            </el-form-item>
            <el-form-item label="所属分组" prop="group_id">
              <el-select v-model="caseForm.group_id" placeholder="请选择所属分组">
                <el-option
                  v-for="group in caseGroups"
                  :key="group.id"
                  :label="group.name"
                  :value="group.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="描述" prop="description">
              <el-input
                v-model="caseForm.description"
                placeholder="请输入用例描述"
                type="textarea"
                :rows="3"
              />
            </el-form-item>
            <el-form-item label="状态" prop="status">
              <el-switch
                v-model="caseForm.status"
                active-value="enabled"
                inactive-value="disabled"
              />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="请求配置" name="request">
            <el-form-item label="请求URL" prop="url">
              <el-input v-model="caseForm.url" placeholder="请输入请求URL" />
            </el-form-item>
            <el-form-item label="请求方法" prop="method">
              <el-select v-model="caseForm.method" placeholder="请选择请求方法">
                <el-option label="GET" value="GET" />
                <el-option label="POST" value="POST" />
                <el-option label="PUT" value="PUT" />
                <el-option label="DELETE" value="DELETE" />
                <el-option label="PATCH" value="PATCH" />
              </el-select>
            </el-form-item>
            <el-form-item label="请求头" prop="headers">
              <el-input
                v-model="caseForm.headers"
                placeholder='请输入请求头（JSON格式），例如：{"Content-Type": "application/json"}'
                type="textarea"
                :rows="4"
              />
            </el-form-item>
            <el-form-item label="请求体" prop="body">
              <el-input
                v-model="caseForm.body"
                placeholder="请输入请求体（JSON格式）"
                type="textarea"
                :rows="6"
              />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="断言配置" name="assert">
            <el-form-item label="响应断言" prop="validate">
              <el-input
                v-model="caseForm.validate"
                placeholder='请输入响应断言（JSON格式），例如：[{"eq": ["status_code", 200]}]'
                type="textarea"
                :rows="8"
              />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="变量提取" name="extract">
            <el-form-item label="变量提取" prop="extract">
              <el-input
                v-model="caseForm.extract"
                placeholder='请输入变量提取配置（JSON格式），例如：[{"token": "content.token"}]'
                type="textarea"
                :rows="6"
              />
            </el-form-item>
            <el-form-item label="变量" prop="variables">
              <el-input
                v-model="caseForm.variables"
                placeholder="请输入变量配置（JSON格式）"
                type="textarea"
                :rows="4"
              />
            </el-form-item>
          </el-tab-pane>
        </el-tabs>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showCaseDialog = false">取消</el-button>
          <el-button type="primary" @click="handleSaveTestCase" :loading="saving">保存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

// 响应式数据
const caseGroups = ref<any[]>([])
const caseList = ref<any[]>([])
const loading = ref(false)
const groupLoading = ref(false)
const saving = ref(false)
const multipleSelection = ref<any[]>([])

const treeProps = {
  children: 'children',
  label: 'name'
}

const searchKeyword = ref('')
const caseStatus = ref('')
const selectedGroupId = ref<number | null>(null)

const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

const showGroupDialog = ref(false)
const isEditGroup = ref(false)
const groupFormRef = ref()
const groupForm = reactive({
  id: 0,
  name: '',
  parent_id: null as number | null
})

const showCaseDialog = ref(false)
const isEditCase = ref(false)
const activeTab = ref('basic')
const caseFormRef = ref()
const caseForm = reactive({
  id: 0,
  name: '',
  group_id: null as number | null,
  description: '',
  status: 'enabled',
  url: '',
  method: 'GET',
  headers: '',
  body: '',
  validate: '',
  extract: '',
  variables: ''
})

// 验证规则
const groupRules = {
  name: [{ required: true, message: '请输入分组名称', trigger: 'blur' }]
}

const caseRules = {
  name: [{ required: true, message: '请输入用例名称', trigger: 'blur' }],
  group_id: [{ required: true, message: '请选择所属分组', trigger: 'change' }],
  url: [{ required: true, message: '请输入请求URL', trigger: 'blur' }],
  method: [{ required: true, message: '请选择请求方法', trigger: 'change' }]
}

const caseFieldLabels: Record<string, string> = {
  name: '用例名称',
  group_id: '所属分组',
  url: '请求URL',
  method: '请求方法'
}

// 格式化日期
const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

// 加载分组数据
const loadGroups = async () => {
  groupLoading.value = true
  try {
    const response = await axios.get('/api/v1/case/group')
    if (response.data.code === 200) {
      caseGroups.value = response.data.data || []
    } else {
      ElMessage.error(response.data.message || '获取分组列表失败')
    }
  } catch (error) {
    console.error('获取分组列表失败:', error)
    ElMessage.error('获取分组列表失败')
  } finally {
    groupLoading.value = false
  }
}

// 加载用例数据
const loadCases = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/v1/case', {
      params: {
        group_id: selectedGroupId.value
      }
    })
    if (response.data.code === 200) {
      let cases = response.data.data || []
      
      // 前端筛选
      if (searchKeyword.value) {
        cases = cases.filter((c: any) => 
          c.name?.includes(searchKeyword.value) ||
          c.description?.includes(searchKeyword.value)
        )
      }
      if (caseStatus.value) {
        cases = cases.filter((c: any) => c.status === caseStatus.value)
      }
      
      // 前端分页
      pagination.total = cases.length
      const start = (pagination.currentPage - 1) * pagination.pageSize
      const end = start + pagination.pageSize
      caseList.value = cases.slice(start, end)
    } else {
      ElMessage.error(response.data.message || '获取用例列表失败')
    }
  } catch (error) {
    console.error('获取用例列表失败:', error)
    ElMessage.error('获取用例列表失败')
  } finally {
    loading.value = false
  }
}

// 加载所有数据
const loadData = () => {
  loadGroups()
  loadCases()
}

// 搜索
const handleSearch = () => {
  pagination.currentPage = 1
  loadCases()
}

// 重置搜索
const resetSearch = () => {
  searchKeyword.value = ''
  caseStatus.value = ''
  selectedGroupId.value = null
  multipleSelection.value = []
  handleSearch()
}

// 选择
const handleSelectionChange = (val: any[]) => {
  multipleSelection.value = val
}

// 批量删除用例
const handleBatchDeleteTestCases = () => {
  if (!multipleSelection.value.length) return
  
  const ids = multipleSelection.value.map(item => item.id)
  ElMessageBox.confirm(
    `确定要删除选中的 ${ids.length} 条测试用例吗？`,
    '批量删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      const response = await axios.delete('/api/v1/case/batch', {
        data: { case_ids: ids }
      })
      if (response.data.code === 200) {
        ElMessage.success('批量删除成功')
        multipleSelection.value = []
        loadCases()
      } else {
        ElMessage.error(response.data.message || '批量删除失败')
      }
    } catch (error) {
      console.error('批量删除失败:', error)
      ElMessage.error('批量删除失败')
    }
  }).catch(() => {})
}

// 分页
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.currentPage = 1
  loadCases()
}

const handleCurrentChange = (current: number) => {
  pagination.currentPage = current
  loadCases()
}

// 树节点点击
const handleNodeClick = (data: any) => {
  selectedGroupId.value = data.id
  handleSearch()
}

// 树节点右键菜单
const handleNodeContextMenu = (event: any, _node: any, data: any) => {
  event.preventDefault()
  console.log('Node context menu:', data)
}

// 添加分组
const handleAddCaseGroup = () => {
  isEditGroup.value = false
  groupForm.id = 0
  groupForm.name = ''
  groupForm.parent_id = null
  showGroupDialog.value = true
}

// 编辑分组
const handleEditGroup = (data: any) => {
  isEditGroup.value = true
  groupForm.id = data.id
  groupForm.name = data.name
  groupForm.parent_id = data.parent_id
  showGroupDialog.value = true
}

// 删除分组
const handleDeleteCaseGroup = (data: any) => {
  ElMessageBox.confirm(
    `确定要删除分组 "${data.name}" 吗？删除分组将同时删除该分组下的所有子分组和测试用例。`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      const response = await axios.delete(`/api/v1/case/group/${data.id}`)
      if (response.data.code === 200) {
        ElMessage.success('分组删除成功')
        if (selectedGroupId.value === data.id) {
          selectedGroupId.value = null
          handleSearch()
        }
        loadGroups()
      } else {
        ElMessage.error(response.data.message || '分组删除失败')
      }
    } catch (error) {
      console.error('分组删除失败:', error)
      ElMessage.error('分组删除失败')
    }
  }).catch(() => {})
}

// 保存分组
const handleSaveGroup = async () => {
  if (!groupFormRef.value) return
  
  try {
    await groupFormRef.value.validate()
    saving.value = true
    
    if (isEditGroup.value) {
      // 编辑分组
      const response = await axios.put(`/api/v1/case/group/${groupForm.id}`, {
        name: groupForm.name,
        parent_id: groupForm.parent_id
      })
      
      if (response.data.code === 200) {
        ElMessage.success('分组编辑成功')
        showGroupDialog.value = false
        loadGroups()
      } else {
        ElMessage.error(response.data.message || '分组编辑失败')
      }
    } else {
      // 新增分组
      const response = await axios.post('/api/v1/case/group', {
        name: groupForm.name,
        parent_id: groupForm.parent_id
      })
      
      if (response.data.code === 200 || response.data.code === 201) {
        ElMessage.success('分组添加成功')
        showGroupDialog.value = false
        loadGroups()
      } else {
        ElMessage.error(response.data.message || '分组添加失败')
      }
    }
  } catch (error) {
    console.error('保存分组失败:', error)
    ElMessage.error('保存分组失败')
  } finally {
    saving.value = false
  }
}

// 添加用例
const handleAddTestCase = () => {
  isEditCase.value = false
  caseForm.id = 0
  caseForm.name = ''
  caseForm.group_id = null
  caseForm.description = ''
  caseForm.status = 'enabled'
  caseForm.url = ''
  caseForm.method = 'GET'
  caseForm.headers = ''
  caseForm.body = ''
  caseForm.validate = ''
  caseForm.extract = ''
  caseForm.variables = ''
  activeTab.value = 'basic'
  showCaseDialog.value = true
}

// 编辑用例
const handleEditTestCase = (caseItem: any) => {
  isEditCase.value = true
  caseForm.id = caseItem.id
  caseForm.name = caseItem.name
  caseForm.group_id = caseItem.group_id
  caseForm.description = caseItem.description || ''
  caseForm.status = caseItem.status
  caseForm.url = caseItem.url || ''
  caseForm.method = caseItem.method || 'GET'
  caseForm.headers = caseItem.headers ? JSON.stringify(caseItem.headers, null, 2) : ''
  caseForm.body = caseItem.body || ''
  caseForm.validate = caseItem.validate ? JSON.stringify(caseItem.validate, null, 2) : ''
  caseForm.extract = caseItem.extract ? JSON.stringify(caseItem.extract, null, 2) : ''
  caseForm.variables = caseItem.variables ? JSON.stringify(caseItem.variables, null, 2) : ''
  activeTab.value = 'basic'
  showCaseDialog.value = true
}

// 保存用例
const handleSaveTestCase = async () => {
  if (!caseFormRef.value) return
  
  try {
    await caseFormRef.value.validate()
    saving.value = true
    
    // 解析JSON字段
    let headers = {}
    let validate = []
    let extract = []
    let variables = {}
    
    try {
      if (caseForm.headers) headers = JSON.parse(caseForm.headers)
      if (caseForm.validate) validate = JSON.parse(caseForm.validate)
      if (caseForm.extract) extract = JSON.parse(caseForm.extract)
      if (caseForm.variables) variables = JSON.parse(caseForm.variables)
    } catch (e) {
      ElMessage.error('JSON格式错误，请检查请求头、断言、提取或变量配置')
      return
    }
    
    const caseData = {
      name: caseForm.name,
      group_id: caseForm.group_id,
      description: caseForm.description,
      status: caseForm.status,
      method: caseForm.method,
      url: caseForm.url,
      headers: headers,
      body: caseForm.body,
      validate: validate,
      extract: extract,
      variables: variables
    }
    
    if (isEditCase.value) {
      // 编辑用例
      const response = await axios.put(`/api/v1/case/${caseForm.id}`, caseData)
      
      if (response.data.code === 200) {
        ElMessage.success('用例编辑成功')
        showCaseDialog.value = false
        loadCases()
      } else {
        ElMessage.error(response.data.message || '用例编辑失败')
      }
    } else {
      // 新增用例
      const response = await axios.post('/api/v1/case', caseData)
      
      if (response.data.code === 200 || response.data.code === 201) {
        ElMessage.success('用例添加成功')
        showCaseDialog.value = false
        loadCases()
      } else {
        ElMessage.error(response.data.message || '用例添加失败')
      }
    }
  } catch (error: any) {
    console.error('保存用例失败:', error)
    const fields = (error && (error.fields || error)) as Record<string, unknown> | undefined
    if (fields && typeof fields === 'object') {
      const missing = Object.keys(fields)
        .map((key) => caseFieldLabels[key] || key)
      if (missing.length) {
        ElMessage.error(`请填写必填项：${missing.join('、')}`)
        return
      }
    }
    ElMessage.error('保存用例失败')
  } finally {
    saving.value = false
  }
}

// 删除用例
const handleDeleteTestCase = (caseItem: any) => {
  ElMessageBox.confirm('确定要删除这个用例吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const response = await axios.delete(`/api/v1/case/${caseItem.id}`)
      
      if (response.data.code === 200) {
        ElMessage.success('删除成功')
        loadCases()
      } else {
        ElMessage.error(response.data.message || '删除失败')
      }
    } catch (error) {
      console.error('删除用例失败:', error)
      ElMessage.error('删除用例失败')
    }
  }).catch(() => {
    // 取消删除
  })
}

// 生命周期
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.case-container {
  padding: 20px;
}

.case-card {
  margin-bottom: 20px;
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

.case-content {
  display: flex;
  gap: 20px;
  margin-top: 20px;
}

.case-sidebar {
  width: 250px;
  border: 1px solid #eaeef1;
  border-radius: 4px;
  padding: 10px;
  background-color: #f9f9f9;
  max-height: 600px;
  overflow-y: auto;
}

.case-main {
  flex: 1;
}

.case-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  gap: 10px;
}

.case-pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  font-size: 14px;
}

.node-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: auto;
}

.node-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tree-node .el-icon {
  font-size: 16px;
}

.node-actions .el-button {
  width: 20px;
  height: 20px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.node-actions .el-button .el-icon {
  font-size: 12px;
  margin: 0;
}

@media screen and (max-width: 1200px) {
  .case-content {
    flex-direction: column;
  }
  
  .case-sidebar {
    width: 100%;
    max-height: 300px;
  }
}
</style>
