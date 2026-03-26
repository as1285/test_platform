<template>
  <div class="swagger-container">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>Swagger 文档</span>
        </div>
      </template>
      <div class="swagger-content">
        <div id="swagger-ui"></div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

onMounted(() => {
  // 动态加载Swagger UI的脚本和样式
  const loadSwaggerUI = () => {
    // 加载样式
    const css1 = document.createElement('link')
    css1.rel = 'stylesheet'
    css1.href = '/swaggerui/droid-sans.css'
    document.head.appendChild(css1)

    const css2 = document.createElement('link')
    css2.rel = 'stylesheet'
    css2.href = '/swaggerui/swagger-ui.css'
    document.head.appendChild(css2)

    // 加载脚本
    const script1 = document.createElement('script')
    script1.src = '/swaggerui/swagger-ui-bundle.js'
    script1.onload = () => {
      const script2 = document.createElement('script')
      script2.src = '/swaggerui/swagger-ui-standalone-preset.js'
      script2.onload = () => {
        // 初始化Swagger UI
        const swaggerUIBundle = (window as any).SwaggerUIBundle
        const swaggerUIStandalonePreset = (window as any).SwaggerUIStandalonePreset
        
        swaggerUIBundle({
          url: '/api/v1/swagger.json',
          dom_id: '#swagger-ui',
          presets: [
            swaggerUIBundle.presets.apis,
            swaggerUIStandalonePreset.slice(1) // No Topbar
          ],
          plugins: [
            swaggerUIBundle.plugins.DownloadUrl
          ],
          displayOperationId: false,
          displayRequestDuration: false,
          docExpansion: 'none'
        })
      }
      document.body.appendChild(script2)
    }
    document.body.appendChild(script1)
  }

  loadSwaggerUI()
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

.swagger-content {
  width: 100%;
  height: calc(100vh - 160px);
  overflow: auto;
}

#swagger-ui {
  width: 100%;
  height: 100%;
}
</style>