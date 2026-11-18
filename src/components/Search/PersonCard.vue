<script setup lang="ts">
  import type { MediaItem, PersonItem } from '@shared/api';
  import AppImage from '@/components/ui/AppImage.vue';
  import { profileUrl } from '@/util/images';
  import { mediaPage, mediaTitle, mediaYear, searchKey } from '@/util/media';

  defineProps<{
    person: PersonItem;
    /** As a line of a list, beside the titles of the list view. */
    list?: boolean;
  }>();

  const { t } = useI18n();

  const label = (title: MediaItem) => {
    const year = mediaYear(title);

    return year ? `${mediaTitle(title)} (${year})` : mediaTitle(title);
  };
</script>

<template>
  <!-- Someone a search of everything found, in a box like the one of a
       title. The app has no page of a person: the titles they are known for
       are the links. In the list view, a line like those of the titles. -->
  <article
    v-if="list"
    class="flex gap-4 rounded-lg border border-surface-200 bg-surface-0 p-3 dark:border-surface-700 dark:bg-surface-900"
  >
    <AppImage
      :src="person.profile_path ? profileUrl(person.profile_path) : null"
      icon="pi pi-user"
      class="w-16 shrink-0 self-start rounded-md sm:w-20"
    />
    <div class="min-w-0 flex-1">
      <p
        class="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-400"
      >
        {{ t('search.person') }}
      </p>
      <p class="text-base font-semibold text-surface-900 dark:text-surface-0">
        {{ person.name }}
      </p>
      <div v-if="person.known_for.length" class="mt-1 text-sm">
        <span class="text-surface-500 dark:text-surface-400">
          {{ t('search.knownFor') }}
        </span>
        <ul class="m-0 mt-0.5 flex list-none flex-wrap gap-x-3 p-0">
          <li v-for="title in person.known_for" :key="searchKey(title)">
            <RouterLink :to="mediaPage(title)">{{ label(title) }}</RouterLink>
          </li>
        </ul>
      </div>
    </div>
  </article>
  <article
    v-else
    class="flex flex-col rounded-md border border-surface-200 bg-surface-0 p-4 dark:border-surface-700 dark:bg-surface-900"
  >
    <div class="flex justify-center p-3">
      <AppImage
        :src="
          person.profile_path ? profileUrl(person.profile_path, 'h632') : null
        "
        icon="pi pi-user"
        class="w-full max-w-[400px] rounded-md"
      />
    </div>
    <p
      class="text-center text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400"
    >
      {{ t('search.person') }}
    </p>
    <p
      class="mt-1 p-3 text-center text-lg font-medium text-surface-900 dark:text-surface-0"
    >
      {{ person.name }}
    </p>
    <div v-if="person.known_for.length" class="px-3 pb-3 text-center text-sm">
      <p class="text-surface-500 dark:text-surface-400">
        {{ t('search.knownFor') }}
      </p>
      <ul class="m-0 mt-1 list-none p-0">
        <li v-for="title in person.known_for" :key="searchKey(title)">
          <RouterLink :to="mediaPage(title)">{{ label(title) }}</RouterLink>
        </li>
      </ul>
    </div>
  </article>
</template>
