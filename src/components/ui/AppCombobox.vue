<script setup lang="ts">
  import {
    ComboboxAnchor,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxItemIndicator,
    ComboboxPortal,
    ComboboxRoot,
    ComboboxTrigger,
    ComboboxViewport,
  } from 'reka-ui';

  // A choice among many, such as a country: a field that filters the list
  // as one types, and shows the name of what was chosen. Reka UI keeps it
  // a combobox for screen readers and the keyboard.
  const props = defineProps<{
    options: { value: string; label: string }[];
    /** The id of the field, for its <label>. */
    id: string;
    /** Said when no option has the text typed. */
    empty: string;
    /** Names the button that opens the whole list. */
    openLabel: string;
    /** As wide as where it is, such as a side panel. */
    block?: boolean;
  }>();

  const model = defineModel<string>({ required: true });

  const labelOf = (value: unknown) =>
    props.options.find((option) => option.value === value)?.label ?? '';
</script>

<template>
  <ComboboxRoot v-model="model" open-on-click>
    <ComboboxAnchor :class="['relative w-full', !block && 'sm:w-80']">
      <ComboboxInput
        :id="id"
        :display-value="labelOf"
        class="field w-full pr-10"
      />
      <ComboboxTrigger
        :aria-label="openLabel"
        class="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-0"
      >
        <span class="pi pi-chevron-down text-xs" aria-hidden="true" />
      </ComboboxTrigger>
    </ComboboxAnchor>
    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        :side-offset="4"
        class="z-50 max-h-72 w-[var(--reka-combobox-trigger-width)] overflow-y-auto rounded-md border border-surface-200 bg-surface-0 p-1 shadow-lg outline-hidden dark:border-surface-700 dark:bg-surface-900"
      >
        <ComboboxViewport>
          <ComboboxEmpty
            class="px-3 py-2 text-sm text-surface-500 dark:text-surface-400"
          >
            {{ empty }}
          </ComboboxEmpty>
          <ComboboxItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            :text-value="option.label"
            class="flex cursor-pointer select-none items-center gap-2 rounded px-3 py-2 text-sm text-surface-700 outline-hidden data-[highlighted]:bg-surface-100 data-[highlighted]:text-surface-900 dark:text-surface-200 dark:data-[highlighted]:bg-surface-800 dark:data-[highlighted]:text-surface-0"
          >
            <span class="flex-1">{{ option.label }}</span>
            <ComboboxItemIndicator>
              <span class="pi pi-check text-xs" aria-hidden="true" />
            </ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
