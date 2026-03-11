<template>
  <div class="swagger-container">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>Swagger 文档</span>
        </div>
      </template>
      <div class="swagger-iframe-container">
        <iframe
          :src="swaggerUrl"
          class="swagger-iframe"
          frameborder="0"
          scrolling="auto"
        ></iframe>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const swaggerUrl = ref('/api/v1/swagger')

onMounted(() => {
  // 确保 Swagger URL 正确
  swaggerUrl.value = '/api/v1/swagger'
})
</script>

<style scoped>
.swagger-container {
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

.swagger-iframe-container {
  width: 100%;
  height: calc(100vh - 160px);
  overflow: hidden;
}

.swagger-iframe {
  width: 100%;
  height: 100%;
}
</style>