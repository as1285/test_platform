<template>
  <div class="app-container">
    <!-- 侧边栏 -->
    <el-aside width="200px" class="sidebar">
      <div class="logo">
        <h1>接口测试平台</h1>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        router
        @select="handleMenuSelect"
      >
        <el-menu-item index="/dashboard">
          <template #icon>
            <el-icon><i-ep-data-analysis /></el-icon>
          </template>
          仪表盘
        </el-menu-item>
        <el-menu-item index="/case">
          <template #icon>
            <el-icon><i-ep-document /></el-icon>
          </template>
          用例管理
        </el-menu-item>
        <el-menu-item index="/test">
          <template #icon>
            <el-icon><i-ep-refresh /></el-icon>
          </template>
          测试执行
        </el-menu-item>
        <el-menu-item index="/performance">
          <template #icon>
            <el-icon><i-ep-speed /></el-icon>
          </template>
          性能测试
        </el-menu-item>
        <el-menu-item index="/robustness">
          <template #icon>
            <el-icon><i-ep-warning /></el-icon>
          </template>
          鲁棒性测试
        </el-menu-item>
        <el-menu-item index="/report">
          <template #icon>
            <el-icon><i-ep-finished /></el-icon>
          </template>
          报告管理
        </el-menu-item>
        <el-menu-item index="/docs">
          <template #icon>
            <el-icon><i-ep-document-checked /></el-icon>
          </template>
          接口文档
        </el-menu-item>
        <el-menu-item index="/user">
          <template #icon>
            <el-icon><i-ep-user /></el-icon>
          </template>
          用户管理
        </el-menu-item>
      </el-menu>
    </el-aside>
    
    <!-- 主内容区 -->
    <el-container class="main-content">
      <!-- 顶部导航栏 -->
      <el-header height="60px" class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentRouteName }}</el-breadcrumb-item>
          </el-breadcrumb>
          <div class="header-stats">
            <span class="header-stat-item">
              <span class="header-stat-label">用例</span>
              <span class="header-stat-value">{{ headerStats.totalCases }}</span>
            </span>
            <span class="header-stat-item">
              <span class="header-stat-label">执行</span>
              <span class="header-stat-value">{{ headerStats.totalExecutions }}</span>
            </span>
            <span class="header-stat-item">
              <span class="header-stat-label">成功率</span>
              <span class="header-stat-value">{{ headerStats.successRate }}%</span>
            </span>
          </div>
        </div>
        <div class="header-right">
          <el-dropdown>
            <span class="user-info">
              <el-avatar>{{ userName }}</el-avatar>
              <span class="user-name">{{ userName }}</span>
              <el-icon class="el-icon--right"><i-ep-arrow-down /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      
      <!-- 内容区域 -->
      <el-main>
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const router = useRouter()
const route = useRoute()

const activeMenu = ref('/dashboard')
const userName = ref('管理员')
const headerStats = reactive({
  totalCases: 0,
  totalExecutions: 0,
  successRate: 0
})

// 计算属性
const currentRouteName = computed(() => {
  const routeMap: Record<string, string> = {
    '/dashboard': '仪表盘',
    '/case': '用例管理',
    '/test': '测试执行',
    '/performance': '性能测试',
    '/robustness': '鲁棒性测试',
    '/report': '报告管理',
    '/docs': '接口文档',
    '/user': '用户管理'
  }
  return routeMap[route.path] || '首页'
})

const handleMenuSelect = (key: string) => {
  activeMenu.value = key
}

const handleLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  ElMessage.success('退出登录成功')
  router.push('/login')
}

const loadHeaderStats = async () => {
  try {
    const response = await axios.get('/api/v1/dashboard/overview')
    if (response.data.code === 200) {
      const data = response.data.data || {}
      const stats = data.stats || {}
      headerStats.totalCases = stats.total_cases || 0
      headerStats.totalExecutions = stats.total_executions || 0
      headerStats.successRate = stats.success_rate || 0
    }
  } catch {
  }
}

// 生命周期
onMounted(() => {
  activeMenu.value = route.path || '/dashboard'
  const userStr = localStorage.getItem('user')
  if (userStr) {
    try {
      const user = JSON.parse(userStr)
      userName.value = user.username
    } catch (e) {
      console.error('Failed to parse user info:', e)
    }
  }
  loadHeaderStats()
})
</script>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  background-color: #001529;
  color: #fff;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #002140;
}

.logo h1 {
  font-size: 18px;
  margin: 0;
  color: #fff;
}

.sidebar-menu {
  margin-top: 20px;
  border-right: none;
}

.sidebar-menu :deep(.el-menu-item) {
  margin: 4px 12px;
  border-radius: 6px;
  border: 1px solid #d9d9d9;
  background-color: #ffffff;
  color: #303133;
  font-weight: 600;
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background-color: #1890ff;
  border-color: #1890ff;
  color: #ffffff;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  background-color: #e6f7ff;
  border-color: #1890ff;
  color: #1890ff;
}

.main-content {
  margin-left: 200px;
  width: calc(100% - 200px);
  height: 100vh;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #eaeef1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
}

.header-stats {
  display: inline-flex;
  align-items: center;
  gap: 16px;
  margin-top: 6px;
}

.header-stat-item {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
  color: #909399;
}

.header-stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.user-info {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.user-name {
  margin-left: 10px;
  margin-right: 5px;
}

.el-main {
  padding: 20px;
  background-color: #f0f2f5;
  overflow-y: auto;
  height: calc(100vh - 60px);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
