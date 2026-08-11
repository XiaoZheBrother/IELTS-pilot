import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from './views/DashboardView.vue'
import PracticeView from './views/PracticeView.vue'
import ResultView from './views/ResultView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: DashboardView },
    { path: '/practice/:testId', name: 'practice', component: PracticeView },
    { path: '/result/:attemptId', name: 'result', component: ResultView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
