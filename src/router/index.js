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
                    path: 'dashboard',
                    name: 'Dashboard',
                    component: () => import('@/pages/DashboardPage.vue'),
                    meta: { auth: true }
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
                    path: 'ticket/:id/edit',
                    name: 'Ticket Edit',
                    component: () => import('@/pages/AddTicketPage.vue'),
                    meta: { auth: true },
                    props: true
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
                {
                    path: 'QC/store/:storeId',
                    name: 'QC Store Detail',
                    component: () => import('@/pages/QCStoreDetailPage.vue'),
                    meta: { auth: true },
                    props: true
                },
                {
                    path: 'QC/store/:storeId/create',
                    name: 'QC Create Session',
                    component: () => import('@/pages/QCCreateSessionPage.vue'),
                    meta: { auth: true },
                    props: true
                },
                {
                    path: 'tools',
                    name: 'Tools',
                    component: () => import('@/pages/ToolsPage.vue'),
                    meta: { auth: true, roles: ['admin'] }
                },
                {
                    path: 'tools/store-sync',
                    name: 'Admin Store Sync',
                    component: () => import('@/pages/AdminStoreSyncPage.vue'),
                    meta: { auth: true, roles: ['admin'] }
                },
                {
                    path: 'tools/qc-forms',
                    name: 'Admin QC Forms',
                    component: () => import('@/pages/AdminQcFormsPage.vue'),
                    meta: { auth: true, roles: ['admin'] }
                },
                {
                    path: 'tools/qc-forms/create',
                    name: 'Admin QC Form Create',
                    component: () => import('@/pages/AdminQcFormEditorPage.vue'),
                    meta: { auth: true, roles: ['admin'] }
                },
                {
                    path: 'tools/qc-forms/:id',
                    name: 'Admin QC Form Detail',
                    component: () => import('@/pages/AdminQcFormDetailPage.vue'),
                    meta: { auth: true, roles: ['admin'] },
                    props: true
                },
                {
                    path: 'tools/qc-forms/:id/edit',
                    name: 'Admin QC Form Edit',
                    component: () => import('@/pages/AdminQcFormEditorPage.vue'),
                    meta: { auth: true, roles: ['admin'] },
                    props: true
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
