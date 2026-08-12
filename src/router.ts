import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { isDesktopRuntime } from './platform/runtime'

export const router = createRouter({
  history: isDesktopRuntime() ? createWebHashHistory() : createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('./views/DashboardView.vue') },
    { path: '/library', name: 'library', component: () => import('./views/LibraryView.vue') },
    { path: '/analytics', name: 'analytics', component: () => import('./views/AnalyticsView.vue') },
    { path: '/writing', name: 'writing', component: () => import('./views/WritingStudioView.vue') },
    { path: '/writing/report/:reportId', name: 'writing-report', component: () => import('./views/WritingReportView.vue') },
    { path: '/errors', name: 'errors', component: () => import('./views/ErrorBookView.vue') },
    { path: '/favorites', name: 'favorites', component: () => import('./views/FavoritesView.vue') },
    { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
    { path: '/updates', name: 'updates', component: () => import('./views/UpdatesView.vue') },
    { path: '/sync', name: 'sync', component: () => import('./views/SyncView.vue') },
    { path: '/about', name: 'about', component: () => import('./views/AboutView.vue') },
    { path: '/library/packages', name: 'packages', component: () => import('./views/PackageManagerView.vue') },
    { path: '/library/sources', name: 'content-sources', component: () => import('./views/ContentSourcesView.vue') },
    { path: '/library/editor', name: 'package-editor', component: () => import('./views/PackageEditorView.vue') },
    { path: '/practice/:testId', name: 'practice', component: () => import('./views/PracticeView.vue') },
    { path: '/mock/:mockId', name: 'mock', component: () => import('./views/MockView.vue') },
    { path: '/result/:attemptId', name: 'result', component: () => import('./views/ResultView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

