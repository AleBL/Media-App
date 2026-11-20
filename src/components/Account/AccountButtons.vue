<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useRoute } from 'vue-router';
  import type { AccountList, MediaType } from '@shared/api';
  import AppToggleButton from '@/components/ui/AppToggleButton.vue';
  import TitleRating from '@/components/Account/TitleRating.vue';
  import { useAccountStore } from '@/stores/account';
  import { useDetailsStore } from '@/stores/details';
  import { useEpisodesStore } from '@/stores/episodes';
  import { useSessionStore } from '@/stores/session';
  import { useWatchedStore } from '@/stores/watched';
  import { noticeListChange } from '@/util/listNotices';

  const props = defineProps<{ type: MediaType; id: number }>();

  const { t } = useI18n();
  const route = useRoute();
  const session = useSessionStore();
  const account = useAccountStore();
  const watched = useWatchedStore();
  const details = useDetailsStore();
  const episodes = useEpisodesStore();

  const title = computed(() => ({ type: props.type, id: props.id }));
  const states = computed(() => account.statesOf(title.value));
  const seen = computed(() => watched.stateOf(title.value));
  const failed = ref<'load' | 'save' | null>(null);

  /** A failure the page has nothing to say about: it shows otherwise. */
  const told = (code: string) =>
    code === 'signed-out' || code === 'sign-in-again';

  const LISTS: { list: AccountList; label: string; icon: string }[] = [
    { list: 'watchlist', label: 'lists.watchlistButton', icon: 'pi-bookmark' },
    { list: 'favorite', label: 'lists.favoriteButton', icon: 'pi-heart' },
  ];

  // Where the title is, its rating and whether it was watched, asked again
  // for another title or someone else.
  watch(
    () => [session.account?.id, props.type, props.id] as const,
    async ([signedIn]) => {
      failed.value = null;

      if (signedIn === undefined) {
        return;
      }

      // The episodes of a show, which its button marks with it.
      if (props.type === 'tv') {
        void episodes.load();
      }

      const answers = await Promise.all([
        account.load(title.value),
        watched.load(title.value),
      ]);

      if (answers.some((answer) => !answer.ok && !told(answer.error.code))) {
        failed.value = 'load';
      }
    },
    { immediate: true },
  );

  // The change waiting for TMDB, whose button shows a spinner.
  const saving = ref<AccountList | 'watched' | null>(null);

  async function toggle(list: AccountList) {
    failed.value = null;
    saving.value = list;

    const answer = await account.toggle(list, title.value);

    saving.value = null;

    if (answer?.ok) {
      noticeListChange(t, list, !!states.value?.[list], () => toggle(list));
    } else if (answer && !told(answer.error.code)) {
      failed.value = 'save';
    }
  }

  // A show and its episodes go together: marked with every episode out, and
  // unmarked with none. Without its episodes (not read yet, or they could
  // not be), the show alone.
  const show = computed(() =>
    props.type === 'tv' &&
    details.details?.type === 'tv' &&
    details.details.id === props.id
      ? details.details
      : null,
  );

  async function toggleWatched() {
    failed.value = null;
    saving.value = 'watched';

    const tv = show.value;

    // Clicked before its episodes came: they are waited for.
    if (tv) {
      await episodes.load();
    }

    const before = tv ? episodes.snapshot(tv) : undefined;
    const together = tv && before && before.whole !== undefined;
    const answer = together
      ? await episodes.markShow(tv, !before.whole)
      : await watched.toggle(title.value);

    saving.value = null;

    if (answer?.ok) {
      noticeListChange(t, 'watched', !!seen.value, () =>
        together ? void episodes.restore(tv, before) : toggleWatched(),
      );
    } else if (answer && !told(answer.error.code)) {
      failed.value = 'save';
    }
  }
</script>

<template>
  <!-- Toggle buttons: the name stays, aria-pressed and the filled icon say
       whether the title is in the list. They only wait for TMDB to say
       where the title is; a change shows at once and is undone if TMDB
       does not take it. -->
  <div v-if="session.account">
    <div class="flex flex-wrap gap-3">
      <AppToggleButton
        v-for="item in LISTS"
        :key="item.list"
        :label="t(item.label)"
        :icon="`pi ${item.icon}`"
        :pressed-icon="`pi ${item.icon}-fill`"
        :pressed="states?.[item.list]"
        :loading="saving === item.list"
        :disabled="!states"
        @click="toggle(item.list)"
      />
      <!-- In a list of the user at TMDB, which needs the v4 login. -->
      <AppToggleButton
        v-if="!watched.needsSignIn"
        :label="t('lists.watchedButton')"
        icon="pi pi-eye"
        pressed-icon="pi pi-check-circle"
        :pressed="seen"
        :loading="saving === 'watched'"
        :disabled="seen === undefined"
        @click="toggleWatched"
      />
    </div>
    <p
      v-if="failed"
      role="alert"
      class="mt-2 text-sm text-red-600 dark:text-red-400"
    >
      {{ t(failed === 'load' ? 'lists.statesFailed' : 'lists.saveFailed') }}
    </p>
    <p v-if="watched.needsSignIn" class="mt-2 text-sm">
      {{ t('lists.signInAgain') }}
      <RouterLink :to="{ name: 'account' }">
        {{ t('pageTitles.account') }}
      </RouterLink>
    </p>
    <TitleRating :id="id" class="mt-4" :type="type" />
  </div>

  <p v-else class="text-sm">
    <RouterLink :to="{ name: 'account', query: { next: route.fullPath } }">
      {{ t('lists.signInToSave') }}
    </RouterLink>
  </p>
</template>
