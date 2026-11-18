<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { storeToRefs } from 'pinia';
  import { chooseLanguage, languageName } from '@/components/NavBar/language';
  import { colorScheme } from '@/components/NavBar/theme';
  import OwnKeyInput from '@/components/Settings/OwnKeyInput.vue';
  import AppButton from '@/components/ui/AppButton.vue';
  import { getApi, isDesktop } from '@/services/api';
  import { safeCall } from '@/stores/account';
  import { useCredentialsStore } from '@/stores/credentials';
  import { useGenresStore } from '@/stores/genres';
  import { useSettingsStore } from '@/stores/settings';
  import { userRegion } from '@/util/region';

  const { t, locale, availableLocales } = useI18n();
  const { loaded, builtIn } = storeToRefs(useCredentialsStore());
  const settings = useSettingsStore();
  const genres = useGenresStore();
  const desktop = isDesktop();

  /** A country by its name in the language of the app. */
  function countryName(code: string) {
    try {
      return (
        new Intl.DisplayNames([locale.value], { type: 'region' }).of(code) ??
        code
      );
    } catch {
      return code;
    }
  }

  // The same as choosing in the menu: kept for the next launch.
  const language = computed({
    get: () => locale.value,
    set: (code: string) => chooseLanguage(locale, code),
  });

  const THEMES = [
    { value: 'auto', label: 'theme.system' },
    { value: 'light', label: 'theme.light' },
    { value: 'dark', label: 'theme.dark' },
  ] as const;

  // The countries TMDB knows where to watch in, by name; the one chosen
  // before stays, even when TMDB could not be asked.
  const regions = ref<string[]>([]);
  const regionsFailed = ref(false);
  const countries = computed(() =>
    [...new Set([...regions.value, settings.region].filter(Boolean))]
      .map((code) => ({ code, name: countryName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name, locale.value)),
  );
  const automatic = computed(() => countryName(userRegion(locale.value)));

  onMounted(async () => {
    const answer = await safeCall(() => getApi().tmdb.regions());

    if (answer.ok) {
      regions.value = answer.data;
    } else {
      regionsFailed.value = true;
    }
  });

  const cache = ref<'cleared' | 'failed' | null>(null);
  const clearing = ref(false);

  async function clearCache() {
    clearing.value = true;
    cache.value = null;

    const answer = await safeCall(() => getApi().clearCache());

    clearing.value = false;
    cache.value = answer.ok ? 'cleared' : 'failed';

    // What the window had of them goes too: asked again from TMDB.
    if (answer.ok) {
      genres.byLanguage = {};
    }
  }

  const SELECT =
    'w-full rounded-md border border-surface-300 bg-surface-0 px-3 py-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 sm:w-auto dark:border-surface-600 dark:bg-surface-900 dark:[color-scheme:dark] dark:focus-visible:ring-primary-400';
  const RADIO =
    'h-4 w-4 accent-primary-500 dark:accent-primary-400 dark:[color-scheme:dark]';
</script>

<template>
  <div class="my-5 text-center">
    <h1 class="mb-3 text-2xl">
      {{ t('pageTitles.settings') }}
    </h1>
  </div>

  <div class="mx-auto flex max-w-xl flex-col gap-8 px-4 pb-8">
    <section>
      <h2 class="mb-2 text-xl">
        <label for="settings-language">{{ t('settings.languageTitle') }}</label>
      </h2>
      <select id="settings-language" v-model="language" :class="SELECT">
        <option
          v-for="code in availableLocales"
          :key="code"
          :value="code"
          :lang="code"
        >
          {{ languageName(code) }}
        </option>
      </select>
    </section>

    <section>
      <fieldset>
        <legend class="mb-2 text-xl">{{ t('theme.text') }}</legend>
        <div class="flex flex-wrap gap-x-5 gap-y-2">
          <div
            v-for="theme in THEMES"
            :key="theme.value"
            class="flex items-center"
          >
            <input
              :id="`settings-theme-${theme.value}`"
              v-model="colorScheme"
              type="radio"
              name="settings-theme"
              :value="theme.value"
              :class="RADIO"
            />
            <label :for="`settings-theme-${theme.value}`" class="ml-2">
              {{ t(theme.label) }}
            </label>
          </div>
        </div>
      </fieldset>
    </section>

    <section>
      <h2 class="mb-2 text-xl">{{ t('settings.regionTitle') }}</h2>
      <p class="mb-3 text-sm text-surface-600 dark:text-surface-300">
        {{ t('settings.regionHint') }}
      </p>
      <label for="settings-region" class="mb-1 block text-sm font-medium">
        {{ t('settings.regionLabel') }}
      </label>
      <select id="settings-region" v-model="settings.region" :class="SELECT">
        <option value="">
          {{ t('settings.regionAuto', { country: automatic }) }}
        </option>
        <option
          v-for="country in countries"
          :key="country.code"
          :value="country.code"
        >
          {{ country.name }}
        </option>
      </select>
      <p
        v-if="regionsFailed"
        role="alert"
        class="mt-2 text-sm text-red-600 dark:text-red-400"
      >
        {{ t('settings.regionsFailed') }}
      </p>
    </section>

    <!-- A web page has no safe place for a key, and the browser keeps the
         images itself. -->
    <section v-if="desktop">
      <h2 class="mb-2 text-xl">
        {{ t('settings.ownKeyTitle') }}
      </h2>
      <!-- Which of the two is true is only known once the main process answers -->
      <p v-if="loaded" class="mb-2">
        {{
          builtIn ? t('settings.ownKeyOptional') : t('settings.ownKeyRequired')
        }}
      </p>
      <p class="mb-4">
        <a href="https://www.themoviedb.org/settings/api" target="_blank">{{
          t('settings.getKey')
        }}</a>
      </p>

      <OwnKeyInput />
    </section>

    <section v-if="desktop">
      <h2 class="mb-2 text-xl">{{ t('settings.cacheTitle') }}</h2>
      <p class="mb-3 text-sm text-surface-600 dark:text-surface-300">
        {{ t('settings.cacheHint') }}
      </p>
      <AppButton
        :label="t('settings.clearCache')"
        icon="pi pi-eraser"
        severity="secondary"
        :disabled="clearing"
        @click="clearCache"
      />
      <p
        role="status"
        :class="[
          'mt-2 text-sm',
          cache === 'failed' && 'text-red-600 dark:text-red-400',
        ]"
      >
        {{
          cache === 'cleared'
            ? t('settings.cacheCleared')
            : cache === 'failed'
              ? t('settings.cacheFailed')
              : ''
        }}
      </p>
    </section>
  </div>
</template>
