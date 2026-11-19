<script setup lang="ts">
  import { computed, ref } from 'vue';
  import type { WatchProvider } from '@shared/api';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppChip from '@/components/ui/AppChip.vue';
  import { useSettingsStore } from '@/stores/settings';
  import { logoUrl } from '@/util/images';

  // The services the user has, kept on the device, and a switch to see
  // only what is on them. They are picked here, among the services of the
  // country.
  const props = defineProps<{
    /** The services of the country, the most watched first. */
    providers: WatchProvider[];
    /** Tells apart the ids of each copy of the filters on the page. */
    idPrefix: string;
  }>();

  const on = defineModel<boolean>('on', { required: true });

  /** How many services show before "Show all". */
  const FEW = 12;

  const { t } = useI18n();
  const settings = useSettingsStore();

  const isMine = (provider: WatchProvider) =>
    settings.myServices.includes(provider.id);

  // Saved ones that the country has for this type.
  const mine = computed(() => props.providers.filter(isMine));

  const editing = ref(false);
  const all = ref(false);
  // Picked for the first time: it is to see what is on them.
  let firstTime = false;

  // The first of the country, and the ones picked even if further down.
  const shown = computed(() =>
    all.value
      ? props.providers
      : props.providers.filter(
          (provider, index) => index < FEW || isMine(provider),
        ),
  );

  function pick(provider: WatchProvider, picked: boolean) {
    settings.setMyServices(
      picked
        ? [...settings.myServices, provider.id]
        : settings.myServices.filter((id) => id !== provider.id),
    );
  }

  function edit() {
    firstTime = mine.value.length === 0;
    editing.value = true;
  }

  function done() {
    editing.value = false;
    all.value = false;

    if (firstTime && mine.value.length) {
      on.value = true;
    }
  }

  const titleId = computed(() => `${props.idPrefix}-services`);
</script>

<template>
  <section :aria-labelledby="titleId">
    <h3 :id="titleId" class="text-sm font-semibold">
      {{ t('discover.myServices') }}
    </h3>

    <template v-if="editing">
      <p class="mt-1 text-xs text-surface-500 dark:text-surface-400">
        {{ t('discover.pickServices') }}
      </p>
      <div
        role="group"
        :aria-labelledby="titleId"
        class="mt-2 flex flex-wrap gap-2"
      >
        <AppChip
          v-for="provider in shown"
          :key="provider.id"
          :model-value="isMine(provider)"
          :label="provider.name"
          :image="provider.logoPath && logoUrl(provider.logoPath)"
          @update:model-value="pick(provider, $event)"
        />
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <AppButton
          size="sm"
          icon="pi pi-check"
          :label="t('discover.done')"
          @click="done"
        />
        <AppButton
          v-if="providers.length > FEW"
          severity="ghost"
          size="sm"
          :label="
            all
              ? t('discover.fewerServices')
              : t('discover.allServices', { n: providers.length })
          "
          @click="all = !all"
        />
      </div>
    </template>

    <template v-else-if="mine.length">
      <label
        class="mt-2 flex cursor-pointer items-center justify-between gap-3"
      >
        <span class="text-sm">{{ t('discover.onlyMine') }}</span>
        <input
          v-model="on"
          type="checkbox"
          role="switch"
          class="relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full bg-surface-500 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:bg-primary-700 checked:before:translate-x-4 dark:bg-surface-500 dark:checked:bg-primary-400 dark:before:bg-surface-950 motion-reduce:transition-none motion-reduce:before:transition-none"
        />
      </label>
      <ul
        class="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0"
        :aria-label="t('discover.yourServices')"
      >
        <li v-for="provider in mine" :key="provider.id">
          <img
            v-if="provider.logoPath"
            :src="logoUrl(provider.logoPath)"
            :alt="provider.name"
            :title="provider.name"
            class="h-8 w-8 rounded-md ring-1 ring-black/5"
            loading="lazy"
          />
          <span
            v-else
            class="inline-flex h-8 items-center rounded-md bg-surface-100 px-2 text-xs font-medium dark:bg-surface-800"
          >
            {{ provider.name }}
          </span>
        </li>
      </ul>
      <AppButton
        severity="ghost"
        size="sm"
        icon="pi pi-pencil"
        :label="t('discover.editServices')"
        class="-ml-3 mt-1"
        @click="edit"
      />
    </template>

    <template v-else>
      <p class="mt-1 text-xs text-surface-500 dark:text-surface-400">
        {{ t('discover.chooseHint') }}
      </p>
      <AppButton
        severity="secondary"
        size="sm"
        icon="pi pi-plus"
        :label="t('discover.chooseServices')"
        class="mt-2"
        @click="edit"
      />
    </template>
  </section>
</template>
