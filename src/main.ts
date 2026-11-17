import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@/style.css';
import App from '@/App.vue';
import router from '@/router';
import i18n from '@/plugins/i18n';
import { useCredentialsStore } from '@/stores/credentials';
import { useSessionStore } from '@/stores/session';

const app = createApp(App);
const pinia = createPinia();

app.use(i18n);
app.use(pinia);
app.use(router);

// Asks the main process which TMDB credential the app has, and deals with a
// key that an older version of the app left in localStorage.
useCredentialsStore(pinia).load().catch(console.error);
// Asks who is signed in to TMDB, if anyone, and follows the changes.
useSessionStore(pinia).load().catch(console.error);

app.mount('#app').$nextTick(() => {
  postMessage({ payload: 'removeLoading' }, '*');
});
