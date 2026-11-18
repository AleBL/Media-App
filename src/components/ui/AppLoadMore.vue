<script setup lang="ts">
  import { ref } from 'vue';
  import { useIntersectionObserver } from '@vueuse/core';
  import AppButton from './AppButton.vue';
  import AppSpinner from './AppSpinner.vue';

  // The end of a list that grows as the user scrolls: the next page is
  // asked for before the end shows, and the button does the same for the
  // keyboard, for a screen reader, and after a failure.
  const props = defineProps<{
    /** The next page is on its way. */
    loading: boolean;
    /** The last try for the next page failed. */
    failed: boolean;
    hasMore: boolean;
  }>();
  const emit = defineEmits<{ more: [] }>();

  const { t } = useI18n();
  const end = ref<HTMLElement>();

  useIntersectionObserver(
    end,
    ([entry]) => {
      if (
        entry?.isIntersecting &&
        props.hasMore &&
        !props.loading &&
        !props.failed
      ) {
        emit('more');
      }
    },
    { rootMargin: '800px' },
  );
</script>

<template>
  <div ref="end" class="flex flex-col items-center gap-3 px-4 pb-10">
    <AppSpinner
      v-if="loading"
      size="lg"
      class="text-primary-600 dark:text-primary-400"
    />
    <template v-else-if="hasMore">
      <p
        v-if="failed"
        role="alert"
        class="text-sm text-red-600 dark:text-red-400"
      >
        {{ t('search.moreFailed') }}
      </p>
      <AppButton
        severity="secondary"
        :icon="failed ? 'pi pi-refresh' : 'pi pi-angle-down'"
        :label="t(failed ? 'search.tryAgain' : 'search.loadMore')"
        @click="emit('more')"
      />
    </template>
  </div>
</template>
