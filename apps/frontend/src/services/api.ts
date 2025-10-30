import axios from 'axios';
import router from '../router';

const api = axios.create({
  // TODO: Get from env.
  baseURL: '/',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

api.interceptors.response.use(
  // Error handling only.
  (res) => res,
  (res) => {
    if (res.status === 401) {
      router.push('/login');
    }

    return Promise.reject(res);
  }
);

export default api;
