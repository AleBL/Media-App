<script setup lang="ts">
  import AppButton from '@/components/ui/AppButton.vue';
  import AppScrollRow from '@/components/ui/AppScrollRow.vue';
  import AppSkeleton from '@/components/ui/AppSkeleton.vue';
  import { useInProgress } from '@/util/showProgress';
  import ContinueCard from './ContinueCard.vue';

  // The shows the user is watching, each with its next episode, first on
  // the home page. Nothing at all for whoever has none.
  const { t } = useI18n();
  const progress = useInProgress();
</script>

<template>
  <section
    v-if="
      progress.list.length ||
      progress.failed ||
      (progress.loading && progress.followed.length)
    "
    class="mt-8"
    aria-labelledby="continue-title"
  >
    <h2 id="continue-title" class="text-xl font-semibold">
      {{ t('homePage.continueWatching') }}
    </h2>

    <AppScrollRow
      v-if="progress.list.length"
      :previous-label="t('homePage.continuePrevious')"
      :next-label="t('homePage.continueNext')"
    >
      <li
        v-for="entry in progress.list"
        :key="entry.show.id"
        class="w-64 shrink-0 snap-start sm:w-72"
      >
        <ContinueCard :entry="entry" />
      </li>
    </AppScrollRow>

    <div
      v-else-if="progress.failed"
      role="alert"
      class="mt-3 flex flex-wrap items-center gap-3 text-red-600 dark:text-red-400"
    >
      <p>{{ t('continue.loadFailed') }}</p>
      <AppButton
        :label="t('homePage.tryAgain')"
        icon="pi pi-refresh"
        severity="secondary"
        @click="progress.load()"
      />
    </div>

    <!-- While the shows of the user come; the text is for screen readers. -->
    <div v-else role="status" class="mt-4 flex gap-4 overflow-hidden pb-3">
      <span class="sr-only">{{ t('homePage.loading') }}</span>
      <AppSkeleton
        v-for="index in 4"
        :key="index"
        class="aspect-video w-64 shrink-0 sm:w-72"
      />
    </div>
  </section>
</template>
