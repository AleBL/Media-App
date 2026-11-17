<script setup lang="ts">
  import { storeToRefs } from 'pinia';
  import AppButton from '@/components/ui/AppButton.vue';
  import { useUpdatesStore } from '@/stores/updates';

  const { t } = useI18n();
  const updates = useUpdatesStore();
  const { state, visible } = storeToRefs(updates);

  onMounted(() => {
    void updates.load();
  });
</script>

<template>
  <!-- Always there, so screen readers announce what appears in it. Not a
  role="status": an empty one would sit on every page next to theirs. -->
  <div aria-live="polite">
    <div
      v-if="
        visible && (state.status === 'ready' || state.status === 'available')
      "
      class="mx-auto mt-3 flex max-w-3xl flex-wrap items-center gap-3 rounded-md border border-primary-300 bg-primary-50 px-4 py-2 dark:border-primary-700 dark:bg-primary-950"
    >
      <span class="grow">
        {{
          t(state.status === 'ready' ? 'updates.ready' : 'updates.available', {
            version: state.version,
          })
        }}
      </span>
      <AppButton
        v-if="state.status === 'ready'"
        :label="t('updates.restart')"
        icon="pi pi-refresh"
        @click="updates.install()"
      />
      <AppButton
        v-else
        :label="t('updates.download')"
        icon="pi pi-download"
        :href="state.url"
      />
      <button
        type="button"
        class="rounded-md p-2 hover:bg-primary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none dark:hover:bg-primary-900"
        :aria-label="t('updates.dismiss')"
        @click="updates.dismiss()"
      >
        <i class="pi pi-times" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
