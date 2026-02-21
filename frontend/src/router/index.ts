import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

// 路由配置
const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/login/Login.vue'),
    meta: {
      requiresAuth: false,
      title: '登录'
    }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/dashboard/Dashboard.vue'),
    meta: {
      requiresAuth: true,
      title: '仪表盘'
    }
  },
  {
    path: '/case',
    name: 'Case',
    component: () => import('../views/case/Case.vue'),
    meta: {
      requiresAuth: true,
      title: '用例管理'
    }
  },
  {
    path: '/test',
    name: 'Test',
    component: () => import('../views/test/Test.vue'),
    meta: {
      requiresAuth: true,
      title: '测试执行'
    }
  },
  {
    path: '/performance',
    name: 'Performance',
    component: () => import('../views/performance/Performance.vue'),
    meta: {
      requiresAuth: true,
      title: '性能测试'
    }
  },
  {
    path: '/robustness',
    name: 'Robustness',
    component: () => import('../views/robustness/Robustness.vue'),
    meta: {
      requiresAuth: true,
      title: '鲁棒性测试'
    }
  },
  {
    path: '/report',
    name: 'Report',
    component: () => import('../views/report/Report.vue'),
    meta: {
      requiresAuth: true,
      title: '报告管理'
    }
  },
  {
    path: '/docs',
    name: 'ApiDocs',
    component: () => import('../views/docs/ApiDocs.vue'),
    meta: {
      requiresAuth: true,
      title: '接口文档'
    }
  },
  {
    path: '/user',
    name: 'User',
    component: () => import('../views/user/User.vue'),
    meta: {
      requiresAuth: true,
      title: '用户管理'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/404/404.vue'),
    meta: {
      requiresAuth: false,
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
  
  // 检查是否需要认证
  if (to.meta.requiresAuth) {
    const token = localStorage.getItem('token')
    if (token) {
      next()
    } else {
      next('/login')
    }
  } else {
    next()
  }
})

export default router
