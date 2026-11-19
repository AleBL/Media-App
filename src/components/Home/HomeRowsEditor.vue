<script setup lang="ts">
  import { computed } from 'vue';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppIconButton from '@/components/ui/AppIconButton.vue';
  import { useGenresStore } from '@/stores/genres';
  import { rowId, useHomeRowsStore, type HomeRow } from '@/stores/homeRows';
  import { useToastsStore } from '@/stores/toasts';
  import { rowDetails, rowTitle } from './rowText';

  // The rows of the home page as a list to change: each one up, down or
  // out, and the rows the app starts with again. Rows come from the
  // Explore page. Every change can be undone from its notice.
  const { t, locale } = useI18n();
  const homeRows = useHomeRowsStore();
  const genres = useGenresStore();
  const toasts = useToastsStore();

  const rows = computed(() =>
    homeRows.rows.map((row) => ({
      row,
      id: rowId(row),
      title: rowTitle(row, t, (ids) => genres.names(ids, locale.value)),
      details: rowDetails(row, t, locale.value),
    })),
  );

  /** Does a change, with a notice that puts the rows back as they were. */
  function change(message: string, apply: () => void) {
    const before = [...homeRows.rows];
    const wasDefault = homeRows.isDefault;

    apply();
    toasts.show(message, {
      label: t('toast.undo'),
      run: () => (wasDefault ? homeRows.restore() : homeRows.set(before)),
    });
  }

  const remove = (row: HomeRow, title: string) =>
    change(t('homePage.rowRemoved', { title }), () => homeRows.remove(row));

  // Already the rows the app starts with: nothing to do, and the focus
  // stays on the button.
  function restore() {
    if (!homeRows.isDefault) {
      change(t('homePage.rowsRestored'), () => homeRows.restore());
    }
  }
</script>

<template>
  <div class="mt-4">
    <ol
      v-if="rows.length"
      class="m-0 flex list-none flex-col gap-2 p-0"
      :aria-label="t('homePage.rows')"
    >
      <li
        v-for="({ row, id, title, details }, index) in rows"
        :key="id"
        class="flex items-center gap-2 rounded-lg border border-surface-200 py-2 pl-4 pr-2 dark:border-surface-700"
      >
        <div class="min-w-0 flex-1">
          <p class="font-medium">{{ title }}</p>
          <p
            v-if="details"
            class="text-sm text-surface-500 dark:text-surface-400"
          >
            {{ details }}
          </p>
        </div>
        <AppIconButton
          icon="pi pi-arrow-up"
          :label="t('homePage.moveUp', { title })"
          :aria-disabled="index === 0"
          @click="homeRows.move(row, -1)"
        />
        <AppIconButton
          icon="pi pi-arrow-down"
          :label="t('homePage.moveDown', { title })"
          :aria-disabled="index === rows.length - 1"
          @click="homeRows.move(row, 1)"
        />
        <AppIconButton
          icon="pi pi-times"
          :label="t('homePage.removeRow', { title })"
          @click="remove(row, title)"
        />
      </li>
    </ol>

    <p class="mt-4 text-sm text-surface-600 dark:text-surface-300">
      {{ t('homePage.addRowHint') }}
      <RouterLink :to="{ name: 'discover' }">
        {{ t('homePage.openExplore') }}
      </RouterLink>
    </p>

    <AppButton
      class="mt-4"
      severity="secondary"
      icon="pi pi-replay"
      :label="t('homePage.restoreRows')"
      :aria-disabled="homeRows.isDefault"
      @click="restore"
    />
  </div>
</template>
