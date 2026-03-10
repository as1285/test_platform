<template>
  <div 
    class="virtual-list" 
    ref="containerRef"
    @scroll="handleScroll"
    :style="{ height: `${height}px` }"
  >
    <div 
      class="virtual-list-container"
      :style="{ height: `${totalHeight}px`, transform: `translateY(${startOffset}px)` }"
    >
      <div 
        v-for="item in visibleItems" 
        :key="item[keyField]"
        class="virtual-list-item"
        :style="{ height: `${itemHeight}px` }"
      >
        <slot :item="item" :index="visibleItems.indexOf(item) + startIndex"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps({
  // 列表数据
  data: {
    type: Array as () => any[],
    default: () => []
  },
  // 列表项高度
  itemHeight: {
    type: Number,
    default: 40
  },
  // 容器高度
  height: {
    type: Number,
    default: 400
  },
  // 额外渲染的列表项数量
  buffer: {
    type: Number,
    default: 5
  },
  // 数据项的唯一标识字段
  keyField: {
    type: String,
    default: 'id'
  }
})

const containerRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)

// 计算总高度
const totalHeight = computed(() => {
  return props.data.length * props.itemHeight
})

// 计算可见区域的起始索引
const startIndex = computed(() => {
  return Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.buffer)
})

// 计算可见区域的结束索引
const endIndex = computed(() => {
  return Math.min(
    props.data.length,
    Math.ceil((scrollTop.value + props.height) / props.itemHeight) + props.buffer
  )
})

// 计算可见区域的列表项
const visibleItems = computed(() => {
  return props.data.slice(startIndex.value, endIndex.value)
})

// 计算起始偏移量
const startOffset = computed(() => {
  return startIndex.value * props.itemHeight
})

// 处理滚动事件
const handleScroll = () => {
  if (containerRef.value) {
    scrollTop.value = containerRef.value.scrollTop
  }
}

// 监听数据变化，重置滚动位置
watch(() => props.data.length, () => {
  scrollTop.value = 0
  if (containerRef.value) {
    containerRef.value.scrollTop = 0
  }
})

onMounted(() => {
  // 初始化滚动位置
  if (containerRef.value) {
    scrollTop.value = containerRef.value.scrollTop
  }
})
</script>

<style scoped>
.virtual-list {
  position: relative;
  overflow-y: auto;
  width: 100%;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.virtual-list-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}

.virtual-list-item {
  width: 100%;
  box-sizing: border-box;
}
</style>