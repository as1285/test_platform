import api from './index'

// 测试相关API
export const testApi = {
  // 运行测试
  runTest: (data: { case_ids: number[]; environment?: string; concurrent?: boolean }) => {
    return api.post('/v1/test/run', data)
  },
  
  // 获取测试执行历史
  getTestHistory: (params: { page?: number; page_size?: number; case_id?: number }) => {
    return api.get('/v1/test/history', { params })
  },
  
  // 获取测试执行详情
  getTestDetail: (id: number) => {
    return api.get(`/v1/test/${id}`)
  },
  
  // 运行性能测试
  runPerformanceTest: (data: any) => {
    return api.post('/v1/test/performance', data)
  },
  
  // 获取性能测试历史
  getPerformanceHistory: (params: { page?: number; page_size?: number }) => {
    return api.get('/v1/test/performance/history', { params })
  },
  
  // 获取性能测试详情
  getPerformanceDetail: (id: number) => {
    return api.get(`/v1/test/performance/${id}`)
  },
  
  // 运行鲁棒性测试
  runRobustnessTest: (data: any) => {
    return api.post('/v1/test/robustness', data)
  },
  
  // 获取鲁棒性测试历史
  getRobustnessHistory: (params: { page?: number; page_size?: number }) => {
    return api.get('/v1/test/robustness/history', { params })
  },
  
  // 获取鲁棒性测试详情
  getRobustnessDetail: (id: number) => {
    return api.get(`/v1/test/robustness/${id}`)
  }
}