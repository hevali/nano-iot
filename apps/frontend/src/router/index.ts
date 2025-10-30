import { createRouter, createWebHistory } from 'vue-router';
import Container from '../app/Container.vue';
import api from '../services/api';

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
          await api.get('/api/auth/user');
          return true;
        } catch {
          return false;
        }
      },
      children: [
        {
          path: 'home',
          name: 'home',
          component: () => import('../views/HomeView.vue'),
        },
        {
          path: 'about',
          name: 'about',
          component: () => import('../views/AboutView.vue'),
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
  ],
});

export default router;
