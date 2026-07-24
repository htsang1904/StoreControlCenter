import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import loading from '@/directives/loading'
import { useApp } from '@/plugins/app'
import router from './router';
const { initializeAuth, state, isTokenExpired, handleAuthExpired } = useApp()
await initializeAuth()

const hasAnyPermission = (requiredPermissions = []) => {
  const currentRole = String(state.userInfo?.role || '').toLowerCase()
  if (currentRole === 'admin') return true
  const permissions = Array.isArray(state.userInfo?.permissions) ? state.userInfo.permissions : []
  return requiredPermissions.some((permission) => permissions.includes(permission))
}

router.beforeEach((to, from, next) => {
  const hasToken = Boolean(state.token)

  if (hasToken && isTokenExpired(state.token)) {
      handleAuthExpired({ showToast: false })
      next('/login')
      return
  }

  if (to.path === '/login' && hasToken) {
      next('/dashboard')
      return
  }

  if (to.meta) {
      if (to.meta.auth && !hasToken) {
          next('/login')
          return
      }

      if (Array.isArray(to.meta.roles) && to.meta.roles.length > 0) {
          const currentRole = String(state.userInfo?.role || '').toLowerCase()
          if (!currentRole || !to.meta.roles.includes(currentRole)) {
              next('/dashboard')
              return
          }
      }

      if (Array.isArray(to.meta.permissions) && to.meta.permissions.length > 0) {
          if (!hasAnyPermission(to.meta.permissions)) {
              next('/dashboard')
              return
          }
      }
  }
  next()
})

const app = createApp(App)
app.directive('loading',loading)
app.use(router)
app.mount('#app')

window.requestAnimationFrame(() => {
  const splash = document.getElementById('app-splash')
  if (!splash) return

  splash.classList.add('is-hidden')
  window.setTimeout(() => splash.remove(), 350)
})

import('@lordicon/element')
  .then(({ defineElement }) => defineElement())
  .catch(() => {})
