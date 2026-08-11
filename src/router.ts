import { createRouter, createWebHistory } from 'vue-router'

const HomePlaceholder = {
  template: '<main class="page-shell"><p>正在装订你的阅读练习册……</p></main>',
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePlaceholder },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
