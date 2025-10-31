import { createRouter, createWebHistory } from 'vue-router';
import Container from '../app/Container.vue';
import { http } from '../services/api';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/home',
      component: Container,
      beforeEnter: async () => {
        try {
          // Ensure user is logged in.
          await http.get('/api/auth/user');
          return true;
        } catch {
          return '/login';
        }
      },
      children: [
        {
          path: '/home',
          name: 'home',
          component: () => import('../views/HomeView.vue'),
        },
        {
          path: '/devices',
          name: 'devices',
          component: () => import('../views/DevicesView.vue'),
        },
        {
          path: '/about',
          name: 'about',
          component: () => import('../views/AboutView.vue'),
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      beforeEnter: async () => {
        try {
          // Ensure user is logged in.
          await http.get('/api/auth/user');
          return '/home';
        } catch {
          return true;
        }
      },
    },
    { path: '/:pathMatch(.*)*', redirect: '/home' },
  ],
});

export default router;
