import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '@/pages/LoginPage.vue'
import 'preline'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginPage,
    },
  ],
})

router.afterEach(async (to, from, failure) => {
  if (!failure) setTimeout(() => window.HSStaticMethods.autoInit(), 10000);
});


export default router
