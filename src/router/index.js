import { createRouter, createWebHistory } from 'vue-router'
import { useApp } from '@/plugins/app'
import 'preline'

const router = createRouter({
    base: import.meta.env.BASE_URL || '/',
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            name: 'default',
            path: '/',
            redirect: '/ticket',
            component: () => import('@/layout/default.vue'),
            children: [
                {
                    path: 'ticket',
                    name: 'Ticket Management',
                    component: () => import('@/pages/TicketManagementPage.vue'),
                    meta: { auth: true }
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
                const {state} = useApp()
                if (state.token) {
                    next({ path: '/ticket' });
                } else {
                    next();
                }
            }
        },
    ],
})

router.afterEach(async (to, from, failure) => {
  if (!failure) setTimeout(() => window.HSStaticMethods.autoInit(), 10000);
});


export default router
