<script setup lang="ts">
  import { computed, watch } from 'vue';
  import type { MediaType } from '@shared/api';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppLoadingBar from '@/components/ui/AppLoadingBar.vue';
  import { useForYouStore } from '@/stores/forYou';
  import { useSessionStore } from '@/stores/session';
  import PosterCardSkeleton from './PosterCardSkeleton.vue';
  import PosterRow from './PosterRow.vue';

  // What TMDB recommends to the account, after the shows in progress and
  // before the rows the user chose. Nothing at all for whoever is not
  // signed in, signed in without the v4 token (with a key of their own),
  // or has nothing recommended.
  const props = defineProps<{
    /** The type of the titles shown, or both. */
    kind: MediaType | 'all';
  }>();

  const { t, locale } = useI18n();
  const session = useSessionStore();
  const forYou = useForYouStore();

  watch(
    [() => session.account?.id, locale],
    ([accountId]) => {
      if (accountId !== undefined) {
        void forYou.load(locale.value);
      }
    },
    { immediate: true },
  );

  const items = computed(() => forYou.shown(props.kind));

  // Signing in again is up to the user (the Watched page tells them how).
  const failed = computed(
    () =>
      !!forYou.error &&
      forYou.error.code !== 'sign-in-again' &&
      forYou.error.code !== 'signed-out',
  );

  const visible = computed(
    () =>
      !!session.account &&
      (failed.value || items.value.length > 0 || forYou.loading),
  );
</script>

<template>
  <section v-if="visible" class="mt-8" aria-labelledby="for-you-title">
    <h2 id="for-you-title" class="text-xl font-semibold">
      {{ t('homePage.forYou') }}
    </h2>
    <p class="mt-0.5 text-sm text-surface-500 dark:text-surface-400">
      {{ t('homePage.forYouSource') }}
    </p>

    <div
      v-if="failed"
      role="alert"
      class="mt-3 flex flex-wrap items-center gap-3 text-red-600 dark:text-red-400"
    >
      <p>{{ t('homePage.forYouFailed') }}</p>
      <AppButton
        :label="t('homePage.tryAgain')"
        icon="pi pi-refresh"
        severity="secondary"
        @click="forYou.load(locale)"
      />
    </div>

    <!-- While they come; the text is for screen readers. -->
    <div
      v-else-if="!items.length"
      role="status"
      class="mt-4 flex gap-4 overflow-hidden pb-3"
    >
      <span class="sr-only">{{ t('homePage.loading') }}</span>
      <PosterCardSkeleton
        v-for="index in 8"
        :key="index"
        class="w-36 shrink-0 sm:w-40"
      />
    </div>

    <template v-else>
      <!-- Loading again, in another language: the row stays. -->
      <AppLoadingBar v-if="forYou.loading" class="mt-3" />

      <PosterRow :items="items" :busy="forYou.loading" />
    </template>
  </section>
</template>
