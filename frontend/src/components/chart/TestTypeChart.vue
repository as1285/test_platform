<template>
  <div ref="chartRef" class="chart" style="width: 100%; height: 300px;"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import * as echarts from 'echarts'

interface TestTypeDistribution {
  automation: number
  performance: number
  robustness: number
}

const props = defineProps({
  data: {
    type: Object as () => TestTypeDistribution | null,
    default: () => null
  }
})

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const initChart = () => {
  if (!chartRef.value) return
  
  chart = echarts.init(chartRef.value)
  updateChart()
}

const updateChart = () => {
  if (!chart) return
  
  const dist = props.data || {
    automation: 0,
    performance: 0,
    robustness: 0
  }
  
  const option = {
    tooltip: {
      trigger: 'item'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '测试类型',
        type: 'pie',
        radius: '50%',
        data: [
          { value: dist.automation, name: '自动化测试' },
          { value: dist.performance, name: '性能测试' },
          { value: dist.robustness, name: '鲁棒性测试' }
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  }
  
  chart.setOption(option)
}

const handleResize = () => {
  chart?.resize()
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})

watch(() => props.data, () => {
  updateChart()
}, { deep: true })
</script>

<style scoped>
.chart {
  width: 100%;
  height: 300px;
}
</style>