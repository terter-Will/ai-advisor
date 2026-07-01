// src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
// 懶載頁面（避免編譯期找不到檔名路徑時的 TS 錯誤）
const Login         = () => import('../pages/Login.vue')
const UserHome      = () => import('../pages/User.vue')
const AdminHome     = () => import('../pages/Admin.vue')
const PointSetting  = () => import('../pages/point_setting.vue')
const AccountSetting= () => import('../pages/account_setting.vue')
const SecurityScan  = () => import('../pages/security_scan.vue')
const Performance   = () => import('../pages/performance.vue')
const ABAPTesting   = () => import('../pages/abap_test.vue')
const PurchasePredict   = () => import('../pages/purchase_predict.vue')

// 你專案裡 localStorage 放的是這個 key
const LS_KEY = 'aiadvisor_user'

type Role = 'admin' | 'user' | string
type CurrentUser = { id?: number; userid?: string; role?: Role; [k: string]: any } | null

function getCurrentUser(): CurrentUser {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch { return null }
}

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/login' },

  { path: '/login', name: 'Login', component: Login, meta: { public: true } },

  // 使用者首頁
  { path: '/user', name: 'UserHome', component: UserHome,
    meta: { requiresAuth: true, roles: ['user'] } },

  //使用者子頁
  { path: '/user/security-scan', name: 'SecurityScan', component: SecurityScan,
    meta: { requiresAuth: true, roles: ['user'] } },

  { path: '/user/performance', name: 'Performance', component: Performance,
    meta: { requiresAuth: true, roles: ['user'] } },

  { path: '/user/abap-test', name: 'ABAPTesting', component: ABAPTesting,
    meta: { requiresAuth: true, roles: ['user'] } },
    
  { path: '/user/purchase-predict', name: 'PurchasePredict', component: PurchasePredict,
    meta: { requiresAuth: true, roles: ['user'] } },

  // Admin 首頁
  { path: '/admin', name: 'AdminHome', component: AdminHome,
    meta: { requiresAuth: true, roles: ['admin'] } },

  // Admin 子頁
  { path: '/admin/point-setting', name: 'PointSetting', component: PointSetting,
    meta: { requiresAuth: true, roles: ['admin'] } },

  { path: '/admin/account-setting', name: 'AccountSetting', component: AccountSetting,
    meta: { requiresAuth: true, roles: ['admin'] } },

  // 其它路徑 -> login
  { path: '/:pathMatch(.*)*', redirect: '/login' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const u = getCurrentUser()
  if (to.meta.public) return true

  // 需要登入但沒登入
  if (to.meta.requiresAuth && !u) return { name: 'Login' }

  // 已登入卻要去 login → 依角色導回首頁
  if (to.name === 'Login' && u) {
    const role = (u.role || '').toString().toLowerCase()
    return role === 'admin' ? { name: 'AdminHome' } : { name: 'UserHome' }
  }

  // 需要特定角色
  const need = (to.meta.roles as string[] | undefined)?.map(r => r.toLowerCase())
  if (need && u) {
    const my = (u.role || '').toString().toLowerCase()
    if (!need.includes(my)) {
      // 角色不符，送回各自首頁
      return my === 'admin' ? { name: 'AdminHome' } : { name: 'UserHome' }
    }
  }
  return true
})

export default router
