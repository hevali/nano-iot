import axios, { type CreateAxiosDefaults } from 'axios';

import router from '../router';

const DEFAULT_AXIOS_CONFIG: CreateAxiosDefaults = {
  // TODO: Should be dynamic.
  baseURL: '/',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
};

export const http = axios.create(DEFAULT_AXIOS_CONFIG);

export const api = axios.create(DEFAULT_AXIOS_CONFIG);
api.interceptors.response.use(
  // Error handling only.
  (res) => res,
  (res) => {
    if (res.status === 401) {
      router.push('/login');
    }

    return Promise.reject(res);
  },
);
