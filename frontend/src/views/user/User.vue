<template>
  <div class="user-container">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <div class="header-actions">
            <el-button type="primary" @click="addUser">
              <el-icon><i-ep-plus /></el-icon>
              新增用户
            </el-button>
            <el-button @click="refreshUsers">
              <el-icon><i-ep-refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </div>
      </template>
      
      <!-- 用户筛选 -->
      <div class="user-filter">
        <el-form :inline="true" :model="filterForm" class="filter-form">
          <el-form-item label="用户名">
            <el-input v-model="filterForm.username" placeholder="输入用户名" />
          </el-form-item>
          <el-form-item label="角色">
            <el-select v-model="filterForm.role" placeholder="选择角色">
              <el-option label="全部" value="" />
              <el-option label="管理员" value="admin" />
              <el-option label="测试人员" value="tester" />
              <el-option label="开发人员" value="developer" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="filterForm.status" placeholder="选择状态">
              <el-option label="全部" value="" />
              <el-option label="启用" value="active" />
              <el-option label="禁用" value="inactive" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="searchUsers">查询</el-button>
            <el-button @click="resetFilter">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
      
      <!-- 用户列表 -->
      <div class="user-list">
        <el-table :data="usersData" style="width: 100%" v-loading="loading">
          <el-table-column prop="id" label="用户ID" width="100" />
          <el-table-column prop="username" label="用户名" />
          <el-table-column prop="email" label="邮箱" />
          <el-table-column prop="role" label="角色" width="120">
            <template #default="{ row }">
              <el-tag :type="getRoleTagType(row.role)">{{ getRoleLabel(row.role) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
                {{ row.status === 'active' ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="create_time" label="创建时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.create_time) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="editUser(row)">
                <el-icon><i-ep-edit /></el-icon>
                编辑
              </el-button>
              <el-button size="small" type="danger" @click="deleteUser(row.id)">
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
    
    <!-- 新增/编辑用户对话框 -->
    <el-dialog
      v-model="userDialogVisible"
      :title="isEdit ? '编辑用户' : '新增用户'"
      width="500px"
    >
      <el-form :model="userForm" :rules="userRules" ref="userFormRef" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="userForm.username" placeholder="输入用户名" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="userForm.email" type="email" placeholder="输入邮箱" />
        </el-form-item>
        <el-form-item label="密码" v-if="!isEdit" prop="password">
          <el-input v-model="userForm.password" type="password" placeholder="输入密码" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="userForm.role" placeholder="选择角色">
            <el-option label="管理员" value="admin" />
            <el-option label="测试人员" value="tester" />
            <el-option label="开发人员" value="developer" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-switch
            v-model="userForm.status"
            :active-value="'active'"
            :inactive-value="'inactive'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="userDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveUser" :loading="saving">保存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

// 响应式数据
const filterForm = ref({
  username: '',
  role: '',
  status: ''
})

const usersData = ref<any[]>([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const saving = ref(false)

const userDialogVisible = ref(false)
const isEdit = ref(false)
const userFormRef = ref()
const userForm = reactive({
  id: '',
  username: '',
  email: '',
  password: '',
  role: 'tester',
  status: 'active'
})

const userRules = reactive({
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  email: [{ required: true, message: '请输入邮箱', trigger: 'blur' }, { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }]
})

// 方法
const getRoleTagType = (role: string) => {
  const roleMap: Record<string, string> = {
    'admin': 'danger',
    'tester': 'primary',
    'developer': 'success'
  }
  return roleMap[role] || 'info'
}

const getRoleLabel = (role: string) => {
  const roleMap: Record<string, string> = {
    'admin': '管理员',
    'tester': '测试人员',
    'developer': '开发人员'
  }
  return roleMap[role] || role
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

// 加载用户列表
const loadUsers = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/v1/user', {
      params: {
        page: currentPage.value,
        size: pageSize.value,
        username: filterForm.value.username,
        role: filterForm.value.role,
        status: filterForm.value.status
      }
    })
    
    if (response.data.code === 200) {
      usersData.value = response.data.data.items || []
      total.value = response.data.data.total || 0
    } else {
      ElMessage.error(response.data.message || '获取用户列表失败')
    }
  } catch (error) {
    console.error('获取用户列表失败:', error)
    ElMessage.error('获取用户列表失败')
  } finally {
    loading.value = false
  }
}

const searchUsers = () => {
  currentPage.value = 1
  loadUsers()
}

const resetFilter = () => {
  filterForm.value = {
    username: '',
    role: '',
    status: ''
  }
  searchUsers()
}

const refreshUsers = () => {
  loadUsers()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  loadUsers()
}

const handleCurrentChange = (current: number) => {
  currentPage.value = current
  loadUsers()
}

const addUser = () => {
  isEdit.value = false
  Object.assign(userForm, {
    id: '',
    username: '',
    email: '',
    password: '',
    role: 'tester',
    status: 'active'
  })
  userDialogVisible.value = true
}

const editUser = (user: any) => {
  isEdit.value = true
  Object.assign(userForm, {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status
  })
  userDialogVisible.value = true
}

const saveUser = async () => {
  if (!userFormRef.value) return
  
  try {
    await userFormRef.value.validate()
    saving.value = true
    
    if (isEdit.value) {
      // 编辑用户
      const response = await axios.put(`/api/v1/user/${userForm.id}`, {
        username: userForm.username,
        email: userForm.email,
        role: userForm.role,
        status: userForm.status
      })
      
      if (response.data.code === 200) {
        ElMessage.success('用户编辑成功')
        userDialogVisible.value = false
        loadUsers()
      } else {
        ElMessage.error(response.data.message || '用户编辑失败')
      }
    } else {
      // 新增用户
      const response = await axios.post('/api/v1/user/register', {
        username: userForm.username,
        email: userForm.email,
        password: userForm.password,
        role: userForm.role
      })
      
      if (response.data.code === 200 || response.data.code === 201) {
        ElMessage.success('用户新增成功')
        userDialogVisible.value = false
        loadUsers()
      } else {
        ElMessage.error(response.data.message || '用户新增失败')
      }
    }
  } catch (error) {
    console.error('保存用户失败:', error)
    ElMessage.error('保存用户失败')
  } finally {
    saving.value = false
  }
}

const deleteUser = (userId: number) => {
  ElMessageBox.confirm('确定要删除此用户吗？', '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const response = await axios.delete(`/api/v1/user/${userId}`)
      
      if (response.data.code === 200) {
        ElMessage.success('用户删除成功')
        loadUsers()
      } else {
        ElMessage.error(response.data.message || '用户删除失败')
      }
    } catch (error) {
      console.error('删除用户失败:', error)
      ElMessage.error('删除用户失败')
    }
  }).catch(() => {
    // 取消删除
  })
}

// 生命周期
onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.user-container {
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

.user-filter {
  margin-bottom: 20px;
}

.filter-form {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-list {
  margin-top: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.dialog-footer {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
