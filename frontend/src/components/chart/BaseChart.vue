<template>
  <div class="base-chart" :style="{ width: width, height: height }" ref="chartRef"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import * as echarts from 'echarts'

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const props = defineProps({
  width: {
    type: String,
    default: '100%'
  },
  height: {
    type: String,
    default: '400px'
  },
  option: {
    type: Object,
    required: true
  }
})

const initChart = () => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
    chart.setOption(props.option)
  }
}

const updateChart = () => {
  if (chart) {
    chart.setOption(props.option)
  }
}

const handleResize = () => {
  if (chart) {
    chart.resize()
  }
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

watch(() => props.option, () => {
  updateChart()
}, { deep: true })

onUnmounted(() => {
  if (chart) {
    chart.dispose()
  }
  window.removeEventListener('resize', handleResize)
})
</script>

<script lang="ts">
export default {
  name: 'BaseChart'
}
</script>

<style scoped>
.base-chart {
  width: 100%;
  height: 400px;
}
</style>