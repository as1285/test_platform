<template>
  <el-card class="api-card" :body-style="{ padding: '20px' }">
    <div class="api-header">
      <div class="api-method" :class="methodClass">{{ method }}</div>
      <div class="api-url">{{ url }}</div>
    </div>
    <div class="api-info">
      <div class="api-description" v-if="description">{{ description }}</div>
      <div class="api-tags" v-if="tags && tags.length">
        <el-tag v-for="tag in tags" :key="tag" size="small" effect="plain">{{ tag }}</el-tag>
      </div>
    </div>
    <div class="api-actions" v-if="showActions">
      <el-button size="small" type="primary" @click="$emit('test')">测试</el-button>
      <el-button size="small" @click="$emit('edit')">编辑</el-button>
      <el-button size="small" type="danger" @click="$emit('delete')">删除</el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  method: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  tags: {
    type: Array,
    default: () => []
  },
  showActions: {
    type: Boolean,
    default: false
  }
})

defineEmits(['test', 'edit', 'delete'])

const methodClass = computed(() => {
  const method = props.method.toUpperCase()
  switch (method) {
    case 'GET':
      return 'method-get'
    case 'POST':
      return 'method-post'
    case 'PUT':
      return 'method-put'
    case 'DELETE':
      return 'method-delete'
    default:
      return 'method-other'
  }
})
</script>

<script lang="ts">
export default {
  name: 'ApiCard'
}
</script>

<style scoped>
.api-card {
  margin-bottom: 16px;
  transition: all 0.3s ease;
}

.api-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.api-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.api-method {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  margin-right: 12px;
  min-width: 60px;
  text-align: center;
}

.method-get {
  background-color: #67c23a;
}

.method-post {
  background-color: #409eff;
}

.method-put {
  background-color: #e6a23c;
}

.method-delete {
  background-color: #f56c6c;
}

.method-other {
  background-color: #909399;
}

.api-url {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  word-break: break-all;
}

.api-info {
  margin-bottom: 16px;
}

.api-description {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
  line-height: 1.4;
}

.api-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.api-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>