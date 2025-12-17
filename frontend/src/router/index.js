import { createRouter, createWebHistory } from 'vue-router'
import store from '@/store'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/Register.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/components/Layout.vue'),
    meta: { requiresAuth: true },
    redirect: '/dashboard',
    children: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '首页' }
      },
      {
        path: '/feedback/community',
        name: 'CommunityFeedback',
        component: () => import('@/views/feedback/CommunityFeedback.vue'),
        meta: { title: '社区评价' }
      },
      {
        path: '/feedback/facility',
        name: 'FacilityFeedback',
        component: () => import('@/views/feedback/FacilityFeedback.vue'),
        meta: { title: '设施评价' }
      },
      {
        path: '/evaluation',
        name: 'Evaluation',
        component: () => import('@/views/evaluation/Evaluation.vue'),
        meta: { title: '便利度评估' }
      },
      {
        path: '/evaluation/result/:taskId',
        name: 'EvaluationResult',
        component: () => import('@/views/evaluation/EvaluationResult.vue'),
        meta: { title: '评估结果' }
      },
      {
        path: '/evaluation/history',
        name: 'EvaluationHistory',
        component: () => import('@/views/evaluation/EvaluationHistory.vue'),
        meta: { title: '评估历史' }
      },
      {
        path: '/admin',
        name: 'Admin',
        component: () => import('@/views/admin/AdminLayout.vue'),
        meta: { title: '系统管理', requiresAdmin: true },
        children: [
          {
            path: 'facilities',
            name: 'AdminFacilities',
            component: () => import('@/views/admin/FacilityManagement.vue'),
            meta: { title: '设施管理' }
          },
          {
            path: 'reports',
            name: 'AdminReports',
            component: () => import('@/views/admin/ReportManagement.vue'),
            meta: { title: '报告管理' }
          },
          {
            path: 'users',
            name: 'AdminUsers',
            component: () => import('@/views/admin/UserManagement.vue'),
            meta: { title: '用户管理' }
          }
        ]
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const isAuthenticated = store.getters['auth/isAuthenticated']
  const userRole = store.getters['auth/userRole']
  
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.meta.requiresAdmin && userRole !== 'admin') {
    next('/dashboard')
  } else if ((to.name === 'Login' || to.name === 'Register') && isAuthenticated) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
