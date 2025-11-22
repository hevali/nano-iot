import './styles.css';
import router from './router';
import PrimeVue from 'primevue/config';
import { createApp } from 'vue';
import App from './app/App.vue';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Lara from '@primeuix/themes/lara';
import { definePreset } from '@primeuix/themes';

const app = createApp(App);
app.use(router);

const MyPreset = definePreset(Lara, {
  components: {
    card: {
      root: {},
      colorScheme: {
        light: {
          root: {
            background: '{surface.100}',
          },
        },
      },
    },
  },
});

app.use(PrimeVue, {
  theme: {
    preset: MyPreset,
  },
  ripple: true,
});
app.use(ToastService);
app.directive('ripple', Ripple);

app.mount('#root');
