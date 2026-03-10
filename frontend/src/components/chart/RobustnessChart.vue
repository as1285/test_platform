<template>
  <div ref="chartRef" class="chart" style="width: 100%; height: 300px;"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import * as echarts from 'echarts'

interface RobustnessScores {
  current_score: number
  history_scores: number[]
}

const props = defineProps({
  data: {
    type: Object as () => RobustnessScores | null,
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
  
  const scores = props.data
  const current = scores ? scores.current_score || 0 : 0
  const history = scores ? scores.history_scores || [] : []
  const historyAvg = history.length > 0
    ? history.reduce((sum, value) => sum + value, 0) / history.length
    : current
  
  const currentValues = [current, current, current, current, current]
  const historyValues = [historyAvg, historyAvg, historyAvg, historyAvg, historyAvg]
  
  const option = {
    tooltip: {
      trigger: 'item'
    },
    radar: {
      indicator: [
        { name: '容错率', max: 100 },
        { name: '异常提示', max: 100 },
        { name: '恢复速度', max: 100 },
        { name: '边界处理', max: 100 },
        { name: '安全防护', max: 100 }
      ]
    },
    series: [
      {
        name: '鲁棒性评分',
        type: 'radar',
        data: [
          {
            value: currentValues,
            name: '当前评分'
          },
          {
            value: historyValues,
            name: '历史评分'
          }
        ]
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