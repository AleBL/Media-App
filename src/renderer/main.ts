import { createApp } from 'vue'
import router from '../renderer/router/index'
import App from './App.vue'
import { MEDIA_TYPES } from './util/constants'

const app = createApp(App);
app.use(router);

app.config.globalProperties.$constants = { MEDIA_TYPES };

app.mount('#app');
