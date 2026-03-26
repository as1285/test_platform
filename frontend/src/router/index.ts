import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

// 路由配置
const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/dashboard/Dashboard.vue'),
    meta: {
      title: '仪表盘'
    }
  },
  {
    path: '/case',
    name: 'Case',
    component: () => import('../views/case/Case.vue'),
    meta: {
      title: '用例管理'
    }
  },
  {
    path: '/test',
    name: 'Test',
    component: () => import('../views/test/Test.vue'),
    meta: {
      title: '测试执行'
    }
  },
  {
    path: '/performance',
    name: 'Performance',
    component: () => import('../views/performance/Performance.vue'),
    meta: {
      title: '性能测试'
    }
  },
  {
    path: '/docs',
    name: 'ApiDocs',
    component: () => import('../views/docs/ApiDocs.vue'),
    meta: {
      title: '接口文档'
    }
  },
  {
    path: '/swagger',
    name: 'SwaggerDocs',
    component: () => import('../views/docs/SwaggerDocs.vue'),
    meta: {
      title: 'Swagger文档'
    }
  },
  {
    path: '/tools',
    name: 'Tools',
    component: () => import('../views/tools/TestTool.vue'),
    meta: {
      title: '测试工具'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/404/404.vue'),
    meta: {
      title: '页面不存在'
    }
  }
]

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  // 设置页面标题
  document.title = `${to.meta.title || '接口测试平台'} - 企业级接口测试平台`
  
  next()
})

export default router
