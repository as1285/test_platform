import api from './index'

// 用例相关API
export const caseApi = {
  // 获取用例列表
  getCaseList: (params: { page?: number; page_size?: number; group_id?: number }) => {
    return api.get('/v1/case', { params })
  },
  
  // 获取用例详情
  getCaseDetail: (id: number) => {
    return api.get(`/v1/case/${id}`)
  },
  
  // 创建用例
  createCase: (data: any) => {
    return api.post('/v1/case', data)
  },
  
  // 更新用例
  updateCase: (id: number, data: any) => {
    return api.put(`/v1/case/${id}`, data)
  },
  
  // 删除用例
  deleteCase: (id: number) => {
    return api.delete(`/v1/case/${id}`)
  },
  
  // 获取用例分组
  getCaseGroups: () => {
    return api.get('/v1/case/group')
  },
  
  // 创建用例分组
  createCaseGroup: (data: { name: string; parent_id?: number }) => {
    return api.post('/v1/case/group', data)
  },
  
  // 更新用例分组
  updateCaseGroup: (id: number, data: { name: string }) => {
    return api.put(`/v1/case/group/${id}`, data)
  },
  
  // 删除用例分组
  deleteCaseGroup: (id: number) => {
    return api.delete(`/v1/case/group/${id}`)
  }
}