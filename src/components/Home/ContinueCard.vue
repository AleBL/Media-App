<script setup lang="ts">
  import { computed, ref } from 'vue';
  import AppButton from '@/components/ui/AppButton.vue';
  import AppImage from '@/components/ui/AppImage.vue';
  import type { InProgress } from '@/stores/continue';
  import { useEpisodesStore } from '@/stores/episodes';
  import { useToastsStore } from '@/stores/toasts';
  import { useWatchedStore } from '@/stores/watched';
  import { stillUrl } from '@/util/images';
  import { seasonPage } from '@/util/media';
  import { withEpisodes } from '@/util/progress';

  // A show in progress: its next episode, to open or to mark watched right
  // here (the card then goes on to the one after).
  const props = defineProps<{ entry: InProgress }>();

  const { t } = useI18n();
  const episodes = useEpisodesStore();
  const watched = useWatchedStore();
  const toasts = useToastsStore();

  const code = computed(() =>
    t('season.code', {
      season: props.entry.next.season,
      episode: props.entry.next.number,
    }),
  );

  // The picture of the episode, or else a still of the show.
  const picture = computed(() => {
    const path =
      props.entry.episode?.stillPath ?? props.entry.show.backdropPath;

    return path ? stillUrl(path) : null;
  });

  const saving = ref(false);

  async function mark() {
    const { show, next } = props.entry;
    const title = { type: 'tv', id: show.id } as const;
    const episode = code.value;

    saving.value = true;

    // The last episode out marks the show watched too: whether it is, first.
    if (watched.stateOf(title) === undefined) {
      await watched.load(title);
    }

    const before = episodes.snapshot(show);

    if (!before) {
      saving.value = false;

      return;
    }

    const answer = await episodes.change(
      show,
      withEpisodes(before.seasons, next.season, [next.number], true),
    );

    saving.value = false;

    if (answer?.ok) {
      toasts.show(t('continue.marked', { episode, show: show.title }), {
        label: t('toast.undo'),
        run: () => void episodes.restore(show, before),
      });
    } else if (answer) {
      toasts.show(t('lists.saveFailed'));
    }
  }
</script>

<template>
  <div class="group relative flex h-full flex-col">
    <div class="relative">
      <AppImage
        :src="picture"
        shape="video"
        icon="pi pi-video"
        class="w-full rounded-md shadow-sm ring-1 ring-black/5 transition-shadow duration-200 group-hover:shadow-md group-has-[a:focus-visible]:ring-2 group-has-[a:focus-visible]:ring-primary-500 dark:group-has-[a:focus-visible]:ring-primary-400"
      />
      <span
        v-if="entry.isNew"
        class="absolute left-2 top-2 rounded-sm bg-primary-700 px-1.5 py-0.5 text-xs font-semibold text-white dark:bg-primary-400 dark:text-surface-900"
      >
        {{ t('continue.new') }}
      </span>
    </div>
    <h3 class="mt-2 text-sm font-semibold">
      <!-- The whole card leads to the season of the episode. -->
      <RouterLink
        :to="seasonPage(entry.show.id, entry.next.season)"
        class="text-surface-900 no-underline outline-hidden after:absolute after:inset-0 group-hover:underline dark:text-surface-0"
      >
        {{ entry.show.title }}
      </RouterLink>
    </h3>
    <p class="text-sm">
      {{ code
      }}<template v-if="entry.episode?.name">
        · {{ entry.episode.name }}</template
      >
    </p>
    <p class="text-xs text-surface-500 dark:text-surface-400">
      {{
        t('details.episodesWatched', {
          watched: entry.watched,
          out: entry.out,
        })
      }}
    </p>
    <!-- Above the link of the card. -->
    <AppButton
      class="relative z-10 mt-2 self-start"
      size="sm"
      severity="secondary"
      icon="pi pi-check"
      :label="t('continue.mark', { episode: code })"
      :aria-label="
        t('continue.markLabel', { episode: code, show: entry.show.title })
      "
      :loading="saving"
      @click="mark"
    />
  </div>
</template>
