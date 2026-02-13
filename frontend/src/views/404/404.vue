<template>
  <div class="error-container">
    <div class="error-content">
      <el-result
        icon="error"
        title="404"
        sub-title="页面不存在"
      >
        <template #extra>
          <el-button type="primary" @click="goHome">返回首页</el-button>
        </template>
      </el-result>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/dashboard')
}
</script>

<style scoped>
.error-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f0f2f5;
}

.error-content {
  width: 100%;
  max-width: 600px;
  text-align: center;
}
</style>