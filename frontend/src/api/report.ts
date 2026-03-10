import api from './index'

// 报告相关API
export const reportApi = {
  // 获取报告列表
  getReportList: (params: { page?: number; page_size?: number; type?: string; status?: string }) => {
    return api.get('/v1/report', { params })
  },
  
  // 获取报告详情
  getReportDetail: (id: number) => {
    return api.get(`/v1/report/${id}`)
  },
  
  // 生成报告
  generateReport: (data: { execution_id: number; type: string }) => {
    return api.post('/v1/report', data)
  },
  
  // 删除报告
  deleteReport: (id: number) => {
    return api.delete(`/v1/report/${id}`)
  },
  
  // 导出报告
  exportReport: (id: number, format: string) => {
    return api.get(`/v1/report/${id}/export`, { 
      params: { format },
      responseType: 'blob'
    })
  }
}