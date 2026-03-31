<template>
  <div class="app-container">
    <!-- 侧边栏 -->
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon :size="24" color="#409EFF"><i-ep-connection /></el-icon>
        <h1>工具</h1>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        router
        @select="handleMenuSelect"
      >
        <el-menu-item index="/tools">
          <template #icon>
            <el-icon><i-ep-tools /></el-icon>
          </template>
          <span>测试工具</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    
    <!-- 主内容区 -->
    <el-container class="main-content">
      <!-- 顶部导航栏 -->
      <el-header height="56px" class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">
              <el-icon><i-ep-house /></el-icon>
              首页
            </el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentRouteName }}</el-breadcrumb-item>
          </el-breadcrumb>
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
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const activeMenu = ref('/tools')

// 计算属性
const currentRouteName = computed(() => {
  const routeMap: Record<string, string> = {
    '/tools': '测试工具'
  }
  return routeMap[route.path] || '测试工具'
})

const handleMenuSelect = (key: string) => {
  activeMenu.value = key
}

// 生命周期
onMounted(() => {
  activeMenu.value = route.path || '/tools'
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
