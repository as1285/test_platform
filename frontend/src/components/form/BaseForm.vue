<template>
  <el-form
    :model="model"
    :rules="rules"
    :ref="formRef"
    :label-width="labelWidth"
    :inline="inline"
    @submit.prevent
  >
    <slot></slot>
  </el-form>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const formRef = ref()

defineProps({
  model: {
    type: Object,
    required: true
  },
  rules: {
    type: Object,
    default: () => {}
  },
  labelWidth: {
    type: String,
    default: '120px'
  },
  inline: {
    type: Boolean,
    default: false
  }
})

defineExpose({
  validate: async () => {
    return new Promise((resolve) => {
      formRef.value.validate((valid: boolean) => {
        resolve(valid)
      })
    })
  },
  resetFields: () => {
    formRef.value.resetFields()
  },
  clearValidate: () => {
    formRef.value.clearValidate()
  }
})
</script>

<script lang="ts">
export default {
  name: 'BaseForm'
}
</script>

<style scoped>
/* 可以添加自定义样式 */
</style>