<script setup lang="ts">
  import { computed } from 'vue';
  import AppSegmented from '@/components/ui/AppSegmented.vue';
  import { CARD_VIEWS, useSettingsStore } from '@/stores/settings';

  // The view of the titles, the same on every page that shows them and on
  // the settings page.
  defineProps<{
    /** Ties the buttons together; one per group on the page. */
    name: string;
  }>();

  const { t } = useI18n();
  const settings = useSettingsStore();

  const options = computed(() =>
    CARD_VIEWS.map((view) => ({
      value: view,
      label: t(`cards.${view}`),
      icon: view === 'list' ? 'pi pi-list' : undefined,
    })),
  );

  const view = computed({
    get: () => settings.view,
    set: (value: string) => {
      settings.cardView = value;
    },
  });
</script>

<template>
  <AppSegmented
    v-model="view"
    :options="options"
    :label="t('cards.view')"
    :name="name"
  />
</template>
