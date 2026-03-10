import { defineStore } from 'pinia'
import { userApi } from '@/api/user'

interface UserState {
  token: string | null
  userInfo: any
  loading: boolean
  error: string | null
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    token: localStorage.getItem('token'),
    userInfo: null,
    loading: false,
    error: null
  }),
  
  getters: {
    isLoggedIn: (state) => !!state.token,
    userRole: (state) => state.userInfo?.role
  },
  
  actions: {
    async login(username: string, password: string) {
      this.loading = true
      this.error = null
      try {
        const response = await userApi.login({ username, password })
        const data = response.data
        if (data.code === 200) {
          this.token = data.data.token
          localStorage.setItem('token', data.data.token)
          await this.getUserInfo()
          return data
        } else {
          this.error = data.message
          throw new Error(data.message)
        }
      } catch (error: any) {
        this.error = error.message || '登录失败'
        throw error
      } finally {
        this.loading = false
      }
    },
    
    async getUserInfo() {
      this.loading = true
      this.error = null
      try {
        const response = await userApi.getUserInfo()
        const data = response.data
        if (data.code === 200) {
          this.userInfo = data.data
        } else {
          this.error = data.message
        }
      } catch (error: any) {
        this.error = error.message || '获取用户信息失败'
      } finally {
        this.loading = false
      }
    },
    
    logout() {
      this.token = null
      this.userInfo = null
      localStorage.removeItem('token')
    }
  }
})