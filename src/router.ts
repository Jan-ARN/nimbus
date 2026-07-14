import { createRouter, createWebHistory } from 'vue-router'
// Landing-View direkt mitbündeln (nicht lazy): so erscheint beim ersten,
// kalten Laden sofort die Hero-Karte (mit Skeleton) statt einer leeren Lücke,
// während sonst noch ein separater Route-Chunk nachlädt.
import CompareView from './views/CompareView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/models' },
    {
      path: '/models',
      name: 'models',
      component: CompareView,
      meta: { title: 'Modelle', icon: 'mdi-chart-timeline-variant' },
    },
    {
      path: '/outlook',
      name: 'outlook',
      component: () => import('./views/LongRangeView.vue'),
      meta: { title: 'Langfrist', icon: 'mdi-calendar-month' },
    },
    {
      path: '/air',
      name: 'air',
      component: () => import('./views/AirView.vue'),
      meta: { title: 'Luft & Pollen', icon: 'mdi-air-filter' },
    },
    // Alte deutsche Pfade weiterleiten
    { path: '/karte', redirect: '/models' },
    { path: '/map', redirect: '/models' },
    { path: '/vergleich', redirect: '/models' },
    { path: '/langfrist', redirect: '/outlook' },
  ],
})
