import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@/style.css';
import App from '@/App.vue';
import router from '@/router';
import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Wind from '@/presets/wind.d';
import i18n, { defaultLocale } from '@/plugins/i18n';
import { theMovieDb } from '@/util/tmdb';

const app = createApp(App);

app.use(i18n);
app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
  unstyled: true,
  pt: Wind,
  ripple: true,
});

theMovieDb.common.language = defaultLocale.value;
// The key used to be loaded only when the home page was opened, so a
// reload on any other page searched without it.
theMovieDb.common.api_key = localStorage.getItem('api_key') ?? '';

app.directive('ripple', Ripple);

app.mount('#app').$nextTick(() => {
  postMessage({ payload: 'removeLoading' }, '*');
});
