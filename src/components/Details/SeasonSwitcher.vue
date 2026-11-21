<script setup lang="ts">
  import { computed } from 'vue';
  import { RouterLink, useRouter } from 'vue-router';
  import {
    DropdownMenuContent,
    DropdownMenuItemIndicator,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
  } from 'reka-ui';
  import type { SeasonSummary } from '@shared/api';
  import { MENU, MENU_ITEM } from '@/components/NavBar/menu';
  import { seasonPage } from '@/util/media';

  // The other seasons of a show, from the page of one: the season before,
  // the season after, and any of them from a menu, in the order of the
  // show (the specials last).
  const props = defineProps<{
    showId: number;
    season: number;
    seasons: SeasonSummary[];
    /** The name of the show, which names the navigation. */
    show?: string;
  }>();

  const { t } = useI18n();
  const router = useRouter();

  const position = computed(() =>
    props.seasons.findIndex((one) => one.number === props.season),
  );
  const previous = computed(() =>
    position.value > 0 ? props.seasons[position.value - 1] : null,
  );
  const next = computed(() =>
    position.value !== -1 && position.value < props.seasons.length - 1
      ? props.seasons[position.value + 1]
      : null,
  );

  const nameOf = (season: { number: number; name?: string }) =>
    season.name || t('season.number', { n: season.number });

  // "2008 · 7 episodes", under each season of the menu.
  const factsOf = (season: SeasonSummary) =>
    [
      season.airDate?.slice(0, 4),
      season.episodeCount ? t('details.episodes', season.episodeCount) : null,
    ]
      .filter(Boolean)
      .join(' · ');

  const chosen = computed({
    get: () => String(props.season),
    set: (value: string) => {
      void router.push(seasonPage(props.showId, Number(value)));
    },
  });

  // On a long show, the menu opens at the season of the page, not at the
  // first one.
  function focusChosen(event: Event) {
    const checked = (event.target as HTMLElement | null)?.querySelector(
      '[data-state="checked"]',
    );

    if (checked instanceof HTMLElement) {
      event.preventDefault();
      checked.focus({ preventScroll: true });
      // The menu gets its place and its height only after it opens.
      requestAnimationFrame(() => checked.scrollIntoView({ block: 'center' }));
    }
  }

  // The season before and after: the icon alone on a phone, with its words
  // from `sm` up (and always for screen readers).
  const STEP =
    'flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium text-surface-700 no-underline transition-colors hover:bg-surface-0 hover:text-surface-900 hover:shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 sm:w-auto sm:px-3 dark:text-surface-200 dark:hover:bg-surface-700 dark:hover:text-surface-0 dark:focus-visible:ring-primary-400';
</script>

<template>
  <nav :aria-label="t('season.seasonsOf', { show })" class="flex">
    <div
      class="flex w-full items-center gap-1 rounded-lg bg-surface-100 p-1 ring-1 ring-surface-200/70 ring-inset sm:w-auto dark:bg-surface-900/60 dark:ring-surface-700"
    >
      <!-- Kept in place when there is none, faded, so the menu does not
           move from one season to the next. -->
      <component
        :is="previous ? RouterLink : 'span'"
        v-bind="
          previous
            ? { to: seasonPage(showId, previous.number) }
            : { 'aria-hidden': 'true' }
        "
        :class="[STEP, !previous && 'pointer-events-none opacity-40']"
      >
        <span class="pi pi-chevron-left text-xs" aria-hidden="true" />
        <span class="sr-only sm:not-sr-only">{{ t('season.previous') }}</span>
      </component>

      <DropdownMenuRoot>
        <DropdownMenuTrigger
          class="group flex h-8 min-w-0 flex-1 items-center justify-between gap-3 rounded-md bg-surface-0 px-3 text-sm font-semibold text-surface-900 shadow-xs ring-1 ring-surface-200 transition-colors hover:ring-surface-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 data-[state=open]:ring-2 data-[state=open]:ring-primary-500 sm:min-w-48 dark:bg-surface-700 dark:text-surface-0 dark:ring-surface-600 dark:hover:ring-surface-500 dark:focus-visible:ring-primary-400 dark:data-[state=open]:ring-primary-400"
        >
          <span class="truncate">
            {{ nameOf(seasons[position] ?? { number: season }) }}
          </span>
          <span
            class="pi pi-chevron-down text-xs text-surface-500 transition-transform group-data-[state=open]:rotate-180 dark:text-surface-300"
            aria-hidden="true"
          />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            align="center"
            :side-offset="6"
            :aria-label="t('season.choose')"
            :class="[
              MENU,
              'max-h-[min(22rem,var(--reka-dropdown-menu-content-available-height))] min-w-[var(--reka-dropdown-menu-trigger-width)] overflow-y-auto',
            ]"
            @open-auto-focus="focusChosen"
          >
            <DropdownMenuRadioGroup v-model="chosen">
              <DropdownMenuRadioItem
                v-for="one in seasons"
                :key="one.number"
                :value="String(one.number)"
                :class="MENU_ITEM"
              >
                <span class="min-w-0 flex-1">
                  <span
                    class="block truncate font-medium text-surface-900 dark:text-surface-0"
                  >
                    {{ nameOf(one) }}
                  </span>
                  <span
                    v-if="factsOf(one)"
                    class="block text-xs text-surface-500 dark:text-surface-400"
                  >
                    {{ factsOf(one) }}
                  </span>
                </span>
                <DropdownMenuItemIndicator>
                  <span
                    class="pi pi-check text-xs text-primary-700 dark:text-primary-300"
                    aria-hidden="true"
                  />
                </DropdownMenuItemIndicator>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <component
        :is="next ? RouterLink : 'span'"
        v-bind="
          next
            ? { to: seasonPage(showId, next.number) }
            : { 'aria-hidden': 'true' }
        "
        :class="[STEP, !next && 'pointer-events-none opacity-40']"
      >
        <span class="sr-only sm:not-sr-only">{{ t('season.next') }}</span>
        <span class="pi pi-chevron-right text-xs" aria-hidden="true" />
      </component>
    </div>
  </nav>
</template>
