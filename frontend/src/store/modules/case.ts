import { defineStore } from 'pinia'
import { caseApi } from '@/api/case'

interface CaseState {
  cases: any[]
  caseGroups: any[]
  currentCase: any
  loading: boolean
  error: string | null
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

export const useCaseStore = defineStore('case', {
  state: (): CaseState => ({
    cases: [],
    caseGroups: [],
    currentCase: null,
    loading: false,
    error: null,
    pagination: {
      page: 1,
      pageSize: 10,
      total: 0
    }
  }),
  
  getters: {
    caseMap: (state) => {
      return state.cases.reduce((map: any, item) => {
        map[item.id] = item
        return map
      }, {})
    }
  },
  
  actions: {
    async getCaseList(params?: { page?: number; page_size?: number; group_id?: number }) {
      this.loading = true
      this.error = null
      try {
        const response = await caseApi.getCaseList({
          page: params?.page || this.pagination.page,
          page_size: params?.page_size || this.pagination.pageSize,
          group_id: params?.group_id
        })
        const data = response.data
        if (data.code === 200) {
          this.cases = data.data.items || []
          this.pagination = {
            page: data.data.page || 1,
            pageSize: data.data.page_size || 10,
            total: data.data.total || 0
          }
        } else {
          this.error = data.message
        }
      } catch (error: any) {
        this.error = error.message || '获取用例列表失败'
      } finally {
        this.loading = false
      }
    },
    
    async getCaseGroups() {
      this.loading = true
      this.error = null
      try {
        const response = await caseApi.getCaseGroups()
        const data = response.data
        if (data.code === 200) {
          this.caseGroups = data.data || []
        } else {
          this.error = data.message
        }
      } catch (error: any) {
        this.error = error.message || '获取用例分组失败'
      } finally {
        this.loading = false
      }
    },
    
    async getCaseDetail(id: number) {
      this.loading = true
      this.error = null
      try {
        const response = await caseApi.getCaseDetail(id)
        const data = response.data
        if (data.code === 200) {
          this.currentCase = data.data
        } else {
          this.error = data.message
        }
      } catch (error: any) {
        this.error = error.message || '获取用例详情失败'
      } finally {
        this.loading = false
      }
    },
    
    async createCase(data: any) {
      this.loading = true
      this.error = null
      try {
        const response = await caseApi.createCase(data)
        const responseData = response.data
        if (responseData.code === 200) {
          await this.getCaseList()
          return responseData
        } else {
          this.error = responseData.message
          throw new Error(responseData.message)
        }
      } catch (error: any) {
        this.error = error.message || '创建用例失败'
        throw error
      } finally {
        this.loading = false
      }
    },
    
    async updateCase(id: number, data: any) {
      this.loading = true
      this.error = null
      try {
        const response = await caseApi.updateCase(id, data)
        const responseData = response.data
        if (responseData.code === 200) {
          await this.getCaseList()
          return responseData
        } else {
          this.error = responseData.message
          throw new Error(responseData.message)
        }
      } catch (error: any) {
        this.error = error.message || '更新用例失败'
        throw error
      } finally {
        this.loading = false
      }
    },
    
    async deleteCase(id: number) {
      this.loading = true
      this.error = null
      try {
        const response = await caseApi.deleteCase(id)
        const data = response.data
        if (data.code === 200) {
          await this.getCaseList()
          return data
        } else {
          this.error = data.message
          throw new Error(data.message)
        }
      } catch (error: any) {
        this.error = error.message || '删除用例失败'
        throw error
      } finally {
        this.loading = false
      }
    }
  }
})