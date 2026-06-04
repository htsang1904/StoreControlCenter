import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import loading from '@/directives/loading'
import { useApp } from '@/plugins/app'
import router from './router';
const { initializeAuth, state } = useApp()
await initializeAuth()

router.beforeEach((to, from, next) => {
  const hasToken = Boolean(state.token)

  if (to.path === '/login' && hasToken) {
      next('/ticket')
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
              next('/ticket')
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

import('@lordicon/element')
  .then(({ defineElement }) => defineElement())
  .catch(() => {})
