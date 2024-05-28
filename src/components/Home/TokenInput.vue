<script setup lang="ts">
  import { useStorage } from '@vueuse/core';
  import { theMovieDb } from '@/util/tmdb';
  import Password from 'primevue/password';
  import Button from 'primevue/button';

  const apiKeyStorage = useStorage('api_key', '');
  theMovieDb.common.api_key = apiKeyStorage.value;

  const apiKeyLocal = ref(apiKeyStorage.value);

  const addApiKey = () => {
    apiKeyStorage.value = apiKeyLocal.value;
    theMovieDb.common.api_key = apiKeyLocal.value;
  };

  const resetApiKey = () => {
    apiKeyLocal.value = '';
    apiKeyStorage.value = '';
    theMovieDb.common.api_key = '';
  };
</script>

<template>
  <Password v-model="apiKeyLocal" :feedback="false" :toggle-mask="apiKeyStorage.length <= 0" :disabled="apiKeyStorage.length > 0" style="width: 330px;"/>
  <Button v-if="apiKeyStorage" icon="pi pi-trash" severity="danger" @click="resetApiKey"/>
  <Button v-else icon="pi pi-save" @click="addApiKey"/>
</template>
