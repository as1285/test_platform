<template>
  <div class="base-table">
    <el-table
      :data="data"
      :loading="loading"
      :border="border"
      :stripe="stripe"
      :size="size"
      @selection-change="handleSelectionChange"
    >
      <el-table-column
        v-if="showSelection"
        type="selection"
        width="55"
      />
      <slot></slot>
    </el-table>
    <div class="pagination" v-if="showPagination && total > 0">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="pageSizes"
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const selectedRows = ref<any[]>([])

defineProps({
  data: {
    type: Array as () => any[],
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  border: {
    type: Boolean,
    default: true
  },
  stripe: {
    type: Boolean,
    default: true
  },
  size: {
    type: String,
    default: 'default'
  },
  showSelection: {
    type: Boolean,
    default: false
  },
  showPagination: {
    type: Boolean,
    default: true
  },
  total: {
    type: Number,
    default: 0
  },
  pagination: {
    type: Object as () => {
      page: number
      pageSize: number
    },
    default: () => ({
      page: 1,
      pageSize: 10
    })
  },
  pageSizes: {
    type: Array as () => number[],
    default: () => [10, 20, 50, 100]
  }
})

const emit = defineEmits(['selection-change', 'size-change', 'current-change'])

const handleSelectionChange = (val: any[]) => {
  selectedRows.value = val
  emit('selection-change', val)
}

const handleSizeChange = (size: number) => {
  emit('size-change', size)
}

const handleCurrentChange = (current: number) => {
  emit('current-change', current)
}

defineExpose({
  selectedRows
})
</script>

<script lang="ts">
export default {
  name: 'BaseTable'
}
</script>

<style scoped>
.base-table {
  width: 100%;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>