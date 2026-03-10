<template>
  <div ref="chartRef" class="chart" style="width: 100%; height: 300px;"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import * as echarts from 'echarts'

interface PerformancePoint {
  date: string
  avg_response_time_ms: number
  success_rate: number
}

const props = defineProps({
  data: {
    type: Array as () => PerformancePoint[],
    default: () => []
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
  
  const dates = props.data.map(item => item.date)
  const responseTimes = props.data.map(item =>
    Math.round((item.avg_response_time_ms || 0) as number)
  )
  const successRates = props.data.map(item =>
    Number(((item.success_rate || 0) as number).toFixed(2))
  )
  
  const option = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['响应时间', '成功率']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates
    },
    yAxis: [
      {
        type: 'value',
        name: '响应时间(ms)',
        position: 'left'
      },
      {
        type: 'value',
        name: '成功率(%)',
        position: 'right',
        max: 100
      }
    ],
    series: [
      {
        name: '响应时间',
        type: 'line',
        data: responseTimes,
        smooth: true
      },
      {
        name: '成功率',
        type: 'line',
        yAxisIndex: 1,
        data: successRates,
        smooth: true
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