<script setup lang="ts">
  import { computed } from 'vue';

  const props = withDefaults(
    defineProps<{
      /** The page shown, from 1. */
      page: number;
      totalPages: number;
      /** How many page numbers to offer at once. */
      links?: number;
    }>(),
    { links: 5 },
  );
  const emit = defineEmits<{ change: [page: number] }>();
  const { t } = useI18n();

  // The numbers around the current page, always `links` of them when there
  // are that many pages.
  const numbers = computed(() => {
    const count = Math.min(props.links, props.totalPages);
    const start = Math.min(
      Math.max(1, props.page - Math.floor(props.links / 2)),
      props.totalPages - count + 1,
    );

    return Array.from({ length: count }, (_, index) => start + index);
  });

  const isFirst = computed(() => props.page <= 1);
  const isLast = computed(() => props.page >= props.totalPages);

  function go(page: number) {
    if (page !== props.page && page >= 1 && page <= props.totalPages) {
      emit('change', page);
    }
  }

  const BUTTON =
    'relative -mt-px inline-flex h-12 min-w-[3rem] select-none items-center justify-center overflow-hidden border-t-2 text-sm font-medium transition duration-200 hover:border-surface-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60 dark:hover:border-surface-200/30 dark:focus-visible:ring-primary-400';
  const OTHER = 'border-transparent text-surface-500 dark:text-white/60';
  const CURRENT =
    'border-primary-500 text-primary-500 dark:border-primary-400 dark:text-surface-0';
</script>

<template>
  <nav
    v-if="totalPages > 1"
    class="paginator flex flex-wrap items-center justify-center border-t border-surface-200 bg-surface-0 px-4 dark:border-surface-700 dark:bg-surface-800"
    :aria-label="t('pagination.label')"
  >
    <button
      type="button"
      :class="[BUTTON, OTHER]"
      :disabled="isFirst"
      :aria-label="t('pagination.first')"
      @click="go(1)"
    >
      <span class="pi pi-angle-double-left" aria-hidden="true" />
    </button>
    <button
      type="button"
      :class="[BUTTON, OTHER]"
      :disabled="isFirst"
      :aria-label="t('pagination.previous')"
      @click="go(page - 1)"
    >
      <span class="pi pi-angle-left" aria-hidden="true" />
    </button>

    <ol class="paginator-pages m-0 flex list-none p-0">
      <li v-for="number in numbers" :key="number">
        <button
          type="button"
          :class="[BUTTON, number === page ? CURRENT : OTHER]"
          :aria-label="t('pagination.page', { page: number })"
          :aria-current="number === page ? 'page' : undefined"
          @click="go(number)"
        >
          {{ number }}
        </button>
      </li>
    </ol>

    <button
      type="button"
      :class="[BUTTON, OTHER]"
      :disabled="isLast"
      :aria-label="t('pagination.next')"
      @click="go(page + 1)"
    >
      <span class="pi pi-angle-right" aria-hidden="true" />
    </button>
    <button
      type="button"
      :class="[BUTTON, OTHER]"
      :disabled="isLast"
      :aria-label="t('pagination.last')"
      @click="go(totalPages)"
    >
      <span class="pi pi-angle-double-right" aria-hidden="true" />
    </button>
  </nav>
</template>
