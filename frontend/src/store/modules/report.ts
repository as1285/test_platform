import { defineStore } from 'pinia'
import { reportApi } from '@/api/report'

interface ReportState {
  reports: any[]
  currentReport: any
  loading: boolean
  error: string | null
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

export const useReportStore = defineStore('report', {
  state: (): ReportState => ({
    reports: [],
    currentReport: null,
    loading: false,
    error: null,
    pagination: {
      page: 1,
      pageSize: 10,
      total: 0
    }
  }),
  
  actions: {
    async getReportList(params?: { page?: number; page_size?: number; type?: string; status?: string }) {
      this.loading = true
      this.error = null
      try {
        const response = await reportApi.getReportList({
          page: params?.page || this.pagination.page,
          page_size: params?.page_size || this.pagination.pageSize,
          type: params?.type,
          status: params?.status
        })
        const data = response.data
        if (data.code === 200) {
          this.reports = data.data.items || []
          this.pagination = {
            page: data.data.page || 1,
            pageSize: data.data.page_size || 10,
            total: data.data.total || 0
          }
        } else {
          this.error = data.message
        }
      } catch (error: any) {
        this.error = error.message || '获取报告列表失败'
      } finally {
        this.loading = false
      }
    },
    
    async getReportDetail(id: number) {
      this.loading = true
      this.error = null
      try {
        const response = await reportApi.getReportDetail(id)
        const data = response.data
        if (data.code === 200) {
          this.currentReport = data.data
        } else {
          this.error = data.message
        }
      } catch (error: any) {
        this.error = error.message || '获取报告详情失败'
      } finally {
        this.loading = false
      }
    },
    
    async generateReport(executionId: number, type: string) {
      this.loading = true
      this.error = null
      try {
        const response = await reportApi.generateReport({ execution_id: executionId, type })
        const data = response.data
        if (data.code === 200 || data.code === 201) {
          await this.getReportList()
          return data
        } else {
          this.error = data.message
          throw new Error(data.message)
        }
      } catch (error: any) {
        this.error = error.message || '生成报告失败'
        throw error
      } finally {
        this.loading = false
      }
    },
    
    async deleteReport(id: number) {
      this.loading = true
      this.error = null
      try {
        const response = await reportApi.deleteReport(id)
        const data = response.data
        if (data.code === 200) {
          await this.getReportList()
          return data
        } else {
          this.error = data.message
          throw new Error(data.message)
        }
      } catch (error: any) {
        this.error = error.message || '删除报告失败'
        throw error
      } finally {
        this.loading = false
      }
    },
    
    async exportReport(id: number, format: string) {
      this.loading = true
      this.error = null
      try {
        const response = await reportApi.exportReport(id, format)
        // 处理文件下载
        const blob = new Blob([response.data], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `report_${id}.${format}`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        return response.data
      } catch (error: any) {
        this.error = error.message || '导出报告失败'
        throw error
      } finally {
        this.loading = false
      }
    }
  }
})