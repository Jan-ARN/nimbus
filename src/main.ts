import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import { router } from './router'

import './styles.css'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(VueQueryPlugin, {
    queryClientConfig: {
      defaultOptions: {
        queries: {
          staleTime: 10 * 60_000,
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
    },
  })
  .mount('#app')
