import { createRouter, createWebHistory } from 'vue-router'
import 'preline'

const router = createRouter({
    base: import.meta.env.BASE_URL || '/',
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            name: 'default',
            path: '/',
            component: () => import('@/layout/default.vue'),
            children: [
                {
                    path: '',
                    redirect: '/ticket'
                },
                {
                    path: 'ticket',
                    name: 'Ticket Management',
                    component: () => import('@/pages/TicketManagementPage.vue'),
                    meta: { auth: true }
                },
                {
                    path: 'ticket/add-ticket',
                    name: 'Ticket Add',
                    component: () => import('@/pages/AddTicketPage.vue'),
                    meta: { auth: true }
                },
                {
                    path: 'ticket/:id',
                    name: 'Ticket Detail',
                    component: () => import('@/pages/TicketDetailPage.vue'),
                    meta: { auth: true },
                    props: true
                },
                {
                    path: 'QC',
                    name: 'QC Management',
                    component: () => import('@/pages/QCManagementPage.vue'),
                    meta: { auth: true }
                },
            ]
        },
        {
            name: 'login',
            path: '/login',
            component: () => import('@/pages/LoginPage.vue'),
            meta: {
                title: 'Suite App'
            },

            beforeEnter: (to, from, next) => {
                const token = localStorage.getItem('token')
                if (token) {
                    next({ path: '/ticket' });
                } else {
                    next();
                }
            }
        },
    ],
})


router.afterEach(async (to, from, failure) => {
  if (!failure) {
    setTimeout(() => {
      if (window.HSStaticMethods?.autoInit) {
        window.HSStaticMethods.autoInit()
      }
    }, 100)
  }
})


export default router
