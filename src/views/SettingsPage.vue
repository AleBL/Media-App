<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { storeToRefs } from 'pinia';
  import { chooseLanguage, languageName } from '@/components/NavBar/language';
  import { colorScheme } from '@/components/NavBar/theme';
  import OwnKeyInput from '@/components/Settings/OwnKeyInput.vue';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppCombobox from '@/components/ui/AppCombobox.vue';
  import AppSegmented from '@/components/ui/AppSegmented.vue';
  import { getApi, isDesktop } from '@/services/api';
  import { safeCall } from '@/stores/account';
  import { useCredentialsStore } from '@/stores/credentials';
  import { useGenresStore } from '@/stores/genres';
  import { UI_SIZES, useSettingsStore } from '@/stores/settings';
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

  const languages = computed(() =>
    availableLocales.map((code) => ({
      value: code,
      label: languageName(code),
      lang: code,
    })),
  );

  const themes = computed(() => [
    { value: 'auto', label: t('theme.system'), icon: 'pi pi-desktop' },
    { value: 'light', label: t('theme.light'), icon: 'pi pi-sun' },
    { value: 'dark', label: t('theme.dark'), icon: 'pi pi-moon' },
  ]);

  // Automatic, then each percentage as the language writes it.
  const sizes = computed(() => {
    const percent = new Intl.NumberFormat(locale.value, { style: 'percent' });

    return UI_SIZES.map((size) => ({
      value: size,
      label:
        size === 'auto' ? t('settings.sizeAuto') : percent.format(+size / 100),
    }));
  });

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

  // The automatic country is no country (''); the field takes a word.
  const AUTOMATIC = 'auto';
  const region = computed({
    get: () => settings.region || AUTOMATIC,
    set: (code: string) => {
      settings.region = code === AUTOMATIC ? '' : code;
    },
  });
  const countryOptions = computed(() => [
    {
      value: AUTOMATIC,
      label: t('settings.regionAuto', { country: automatic.value }),
    },
    ...countries.value.map(({ code, name }) => ({ value: code, label: name })),
  ]);

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
</script>

<template>
  <div class="my-5 text-center">
    <h1 class="mb-3 text-2xl">
      {{ t('pageTitles.settings') }}
    </h1>
  </div>

  <div class="mx-auto flex max-w-xl flex-col gap-8 px-4 pb-8">
    <section>
      <h2 class="mb-2 text-xl">{{ t('settings.languageTitle') }}</h2>
      <!-- Each language by its own name. -->
      <AppSegmented
        v-model="language"
        :options="languages"
        :label="t('settings.languageTitle')"
        name="settings-language"
      />
    </section>

    <section>
      <h2 class="mb-2 text-xl">{{ t('theme.text') }}</h2>
      <AppSegmented
        v-model="colorScheme"
        :options="themes"
        :label="t('theme.text')"
        name="settings-theme"
      />
    </section>

    <section>
      <h2 class="mb-2 text-xl">{{ t('settings.sizeTitle') }}</h2>
      <p class="mb-3 text-sm text-surface-600 dark:text-surface-300">
        {{ t('settings.sizeHint') }}
      </p>
      <AppSegmented
        v-model="settings.uiSize"
        :options="sizes"
        :label="t('settings.sizeTitle')"
        name="settings-size"
      />
    </section>

    <section>
      <h2 class="mb-2 text-xl">{{ t('settings.regionTitle') }}</h2>
      <p class="mb-3 text-sm text-surface-600 dark:text-surface-300">
        {{ t('settings.regionHint') }}
      </p>
      <label for="settings-region" class="mb-1 block text-sm font-medium">
        {{ t('settings.regionLabel') }}
      </label>
      <!-- Typing filters the countries, by their name in the language of
           the app. -->
      <AppCombobox
        id="settings-region"
        v-model="region"
        :options="countryOptions"
        :empty="t('settings.noCountry')"
        :open-label="t('settings.allCountries')"
      />
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
