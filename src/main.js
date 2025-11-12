import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import 'preline'
import router from './router'
createApp(App).use(router).mount('#app')