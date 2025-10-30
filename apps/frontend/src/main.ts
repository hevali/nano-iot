import './styles.css';
import router from './router';
import PrimeVue from 'primevue/config';
import { createApp } from 'vue';
import App from './app/App.vue';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Aura from '@primeuix/themes/aura';

const app = createApp(App);
app.use(router);

app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
  ripple: true,
});
app.use(ToastService);
app.directive('ripple', Ripple);

app.mount('#root');
