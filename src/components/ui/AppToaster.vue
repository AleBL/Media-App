<script setup lang="ts">
  import {
    ToastAction,
    ToastClose,
    ToastDescription,
    ToastProvider,
    ToastRoot,
    ToastViewport,
  } from 'reka-ui';
  import AppButton from '@/components/ui/AppButton.vue';
  import { useToastsStore } from '@/stores/toasts';

  const { t } = useI18n();
  const store = useToastsStore();

  function act(id: number, run: () => void) {
    store.dismiss(id);
    run();
  }
</script>

<template>
  <!-- The notices of the app, at the bottom corner. Reka UI reads each one
       out, pauses its 5 seconds while the pointer or the focus is on it,
       and F8 brings the focus to them. -->
  <ToastProvider :duration="5000" :label="t('toast.label')">
    <ToastRoot
      v-for="toast in store.toasts"
      :key="toast.id"
      class="flex items-center gap-3 rounded-md border border-surface-200 bg-surface-0 py-2 pl-4 pr-2 text-sm text-surface-900 shadow-lg dark:border-surface-700 dark:bg-surface-800 dark:text-surface-0"
      @update:open="(open: boolean) => !open && store.dismiss(toast.id)"
    >
      <ToastDescription class="flex-1">{{ toast.message }}</ToastDescription>
      <ToastAction v-if="toast.action" :alt-text="toast.action.label" as-child>
        <AppButton
          severity="ghost"
          size="sm"
          :label="toast.action.label"
          class="text-primary-700 dark:text-primary-300"
          @click="act(toast.id, toast.action.run)"
        />
      </ToastAction>
      <ToastClose as-child>
        <AppButton
          severity="ghost"
          size="sm"
          icon="pi pi-times"
          :aria-label="t('toast.dismiss')"
        />
      </ToastClose>
    </ToastRoot>
    <ToastViewport
      class="fixed bottom-4 right-4 z-50 m-0 flex w-96 max-w-[calc(100vw-2rem)] list-none flex-col gap-2 p-0 outline-hidden"
    />
  </ToastProvider>
</template>
