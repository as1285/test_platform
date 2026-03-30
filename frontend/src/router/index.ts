import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

// 路由配置
const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/tools'
  },
  {
    path: '/login',
    redirect: '/tools'
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
  document.title = `${to.meta.title || '工具'}`
  
  next()
})

export default router
