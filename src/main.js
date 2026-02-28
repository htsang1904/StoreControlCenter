import './assets/main.css'
import 'dropzone/dist/dropzone-min.js';
import 'preline/dist/index.js';
import 'vanilla-calendar-pro/styles/index.css';
import $ from 'jquery';
import _ from 'lodash';
import * as VanillaCalendarPro from 'vanilla-calendar-pro';
import HSFileUpload from '@preline/file-upload';
window.Dropzone.autoDiscover = false;
window.HSFileUpload = HSFileUpload;
window.VanillaCalendarPro = VanillaCalendarPro;
window._ = _;
window.$ = $;
window.jQuery = $;

import { createApp } from 'vue'
import App from './App.vue'
import loading from '@/directives/loading'
import { useApp } from '@/plugins/app'
import router from './router';
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta) {
      if (to.meta.auth && !token) {
          next('/login')
          return
      }
  }
  next()
})
import { defineElement } from "@lordicon/element"
defineElement()
const { initializeAuth } = useApp()
await initializeAuth()
const app = createApp(App)
app.directive('loading',loading)
app.use(router)
app.mount('#app')
