import api from './index'

// 用户相关API
export const userApi = {
  // 登录
  login: (data: { username: string; password: string }) => {
    return api.post('/v1/user/login', data)
  },
  
  // 注册
  register: (data: { username: string; password: string; email: string }) => {
    return api.post('/v1/user/register', data)
  },
  
  // 获取用户信息
  getUserInfo: () => {
    return api.get('/v1/user/info')
  },
  
  // 更新用户信息
  updateUserInfo: (data: any) => {
    return api.put('/v1/user/info', data)
  },
  
  // 获取用户列表
  getUserList: (params: { page?: number; page_size?: number }) => {
    return api.get('/v1/user/list', { params })
  },
  
  // 删除用户
  deleteUser: (id: number) => {
    return api.delete(`/v1/user/${id}`)
  }
}