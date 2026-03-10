import { defineStore } from 'pinia'
import { testApi } from '@/api/test'

interface TestState {
  testResults: any[]
  performanceResults: any[]
  robustnessResults: any[]
  currentTest: any
  loading: boolean
  error: string | null
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

export const useTestStore = defineStore('test', {
  state: (): TestState => ({
    testResults: [],
    performanceResults: [],
    robustnessResults: [],
    currentTest: null,
    loading: false,
    error: null,
    pagination: {
      page: 1,
      pageSize: 10,
      total: 0
    }
  }),
  
  actions: {
    async runTest(caseIds: number[]) {
      this.loading = true
      this.error = null
      try {
        const response = await testApi.runTest({ case_ids: caseIds })
        const data = response.data
        if (data.code === 200) {
          this.currentTest = data.data
          return data
        } else {
          this.error = data.message
          throw new Error(data.message)
        }
      } catch (error: any) {
        this.error = error.message || '运行测试失败'
        throw error
      } finally {
        this.loading = false
      }
    },
    
    async getTestHistory(params?: { page?: number; page_size?: number; case_id?: number }) {
      this.loading = true
      this.error = null
      try {
        const response = await testApi.getTestHistory({
          page: params?.page || this.pagination.page,
          page_size: params?.page_size || this.pagination.pageSize,
          case_id: params?.case_id
        })
        const data = response.data
        if (data.code === 200) {
          this.testResults = data.data.items || []
          this.pagination = {
            page: data.data.page || 1,
            pageSize: data.data.page_size || 10,
            total: data.data.total || 0
          }
        } else {
          this.error = data.message
        }
      } catch (error: any) {
        this.error = error.message || '获取测试历史失败'
      } finally {
        this.loading = false
      }
    },
    
    async runPerformanceTest(data: any) {
      this.loading = true
      this.error = null
      try {
        const response = await testApi.runPerformanceTest(data)
        const responseData = response.data
        if (responseData.code === 200) {
          this.currentTest = responseData.data
          return responseData
        } else {
          this.error = responseData.message
          throw new Error(responseData.message)
        }
      } catch (error: any) {
        this.error = error.message || '运行性能测试失败'
        throw error
      } finally {
        this.loading = false
      }
    },
    
    async getPerformanceHistory(params?: { page?: number; page_size?: number }) {
      this.loading = true
      this.error = null
      try {
        const response = await testApi.getPerformanceHistory({
          page: params?.page || this.pagination.page,
          page_size: params?.page_size || this.pagination.pageSize
        })
        const data = response.data
        if (data.code === 200) {
          this.performanceResults = data.data.items || []
          this.pagination = {
            page: data.data.page || 1,
            pageSize: data.data.page_size || 10,
            total: data.data.total || 0
          }
        } else {
          this.error = data.message
        }
      } catch (error: any) {
        this.error = error.message || '获取性能测试历史失败'
      } finally {
        this.loading = false
      }
    },
    
    async runRobustnessTest(data: any) {
      this.loading = true
      this.error = null
      try {
        const response = await testApi.runRobustnessTest(data)
        const responseData = response.data
        if (responseData.code === 200) {
          this.currentTest = responseData.data
          return responseData
        } else {
          this.error = responseData.message
          throw new Error(responseData.message)
        }
      } catch (error: any) {
        this.error = error.message || '运行鲁棒性测试失败'
        throw error
      } finally {
        this.loading = false
      }
    },
    
    async getRobustnessHistory(params?: { page?: number; page_size?: number }) {
      this.loading = true
      this.error = null
      try {
        const response = await testApi.getRobustnessHistory({
          page: params?.page || this.pagination.page,
          page_size: params?.page_size || this.pagination.pageSize
        })
        const data = response.data
        if (data.code === 200) {
          this.robustnessResults = data.data.items || []
          this.pagination = {
            page: data.data.page || 1,
            pageSize: data.data.page_size || 10,
            total: data.data.total || 0
          }
        } else {
          this.error = data.message
        }
      } catch (error: any) {
        this.error = error.message || '获取鲁棒性测试历史失败'
      } finally {
        this.loading = false
      }
    }
  }
})