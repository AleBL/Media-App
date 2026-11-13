import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@/style.css';
import App from '@/App.vue';
import router from '@/router';
import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Wind from '@/presets/wind.d';
import i18n from '@/plugins/i18n';
import { useCredentialsStore } from '@/stores/credentials';

const app = createApp(App);
const pinia = createPinia();

app.use(i18n);
app.use(pinia);
app.use(router);
app.use(PrimeVue, {
  unstyled: true,
  pt: Wind,
  ripple: true,
});

// Asks the main process whether a TMDB key is saved, and hands over a key
// that an older version of the app left in localStorage.
useCredentialsStore(pinia).load().catch(console.error);

app.directive('ripple', Ripple);

app.mount('#app').$nextTick(() => {
  postMessage({ payload: 'removeLoading' }, '*');
});
