import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import ElementPlus, { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import axios from 'axios'

// 创建Pinia实例
const pinia = createPinia()

// 配置axios
axios.defaults.baseURL = ''
axios.interceptors.request.use(
  config => {
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      const data = error.response.data || {}
      const msg = data.message || data.msg

      if (msg) {
        ElMessage.error(msg)
      }
    } else if (error.request) {
      ElMessage.error('网络错误，无法连接到服务器')
    } else {
      ElMessage.error(error.message || '请求失败')
    }
    return Promise.reject(error)
  }
)

// 创建Vue应用
const app = createApp(App)

// 注册插件
app.use(router)
app.use(pinia)
app.use(ElementPlus)

// 挂载应用
app.mount('#app')
