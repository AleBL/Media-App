<script setup lang="ts">
  import { storeToRefs } from 'pinia';
  import OwnKeyInput from '@/components/Settings/OwnKeyInput.vue';
  import { isDesktop } from '@/services/api';
  import { useCredentialsStore } from '@/stores/credentials';

  const { t } = useI18n();
  const { loaded, builtIn } = storeToRefs(useCredentialsStore());
  const desktop = isDesktop();
</script>

<template>
  <div class="text-center my-5">
    <h1 class="mb-3 text-2xl">
      {{ t('pageTitles.settings') }}
    </h1>
  </div>

  <!-- The menu of the web version has no link to this page -->
  <p v-if="!desktop" class="mx-auto max-w-xl px-4 pb-4 text-center">
    {{ t('settings.nothingOnWeb') }}
  </p>

  <section v-else class="mx-auto max-w-xl px-4 pb-4 text-center">
    <h2 class="mb-2 text-xl">
      {{ t('settings.ownKeyTitle') }}
    </h2>
    <!-- Which of the two is true is only known once the main process answers -->
    <p v-if="loaded" class="mb-2">
      {{
        builtIn ? t('settings.ownKeyOptional') : t('settings.ownKeyRequired')
      }}
    </p>
    <p class="mb-4">
      <a href="https://www.themoviedb.org/settings/api" target="_blank">{{
        t('settings.getKey')
      }}</a>
    </p>

    <OwnKeyInput />
  </section>
</template>
