import axios from 'axios'

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    return response
  },
  error => {
    // 处理错误
    if (error.response) {
      switch (error.response.status) {
        case 403:
          // 禁止访问
          console.error('禁止访问')
          break
        case 404:
          // 接口不存在
          console.error('接口不存在')
          break
        case 500:
          // 服务器错误
          console.error('服务器错误')
          break
        default:
          console.error('请求失败')
      }
    } else {
      // 网络错误
      console.error('网络错误')
    }
    return Promise.reject(error)
  }
)

export default api