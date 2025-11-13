import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import 'preline'
import router from './router'
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta) {
      if (to.meta.auth && !token) {
          next('/login');
          return;
      }
  }
  next();
});
const app = createApp(App)
app.use(router)
app.mount('#app')