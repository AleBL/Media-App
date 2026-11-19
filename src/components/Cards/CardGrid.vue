<script setup lang="ts">
  import type { SearchItem } from '@shared/api';
  import PosterCard from '@/components/Home/PosterCard.vue';
  import PersonCard from '@/components/Search/PersonCard.vue';
  import { useSettingsStore } from '@/stores/settings';
  import { isPerson, searchKey } from '@/util/media';
  import PosterListItem from './PosterListItem.vue';
  import { GRID_SIZE } from './view';

  defineProps<{
    /** Titles, and people among the results of a search of everything. */
    items: SearchItem[];
    /** Says on each title whether it is a movie or a tv show. */
    showType?: boolean;
    /** Already in the column of a page, such as beside the filters. */
    bare?: boolean;
  }>();

  const settings = useSettingsStore();
</script>

<template>
  <!-- The titles in the view chosen: a list with the synopsis, or a grid
       of cards of the size chosen. A search of everything mixes movies, tv
       shows and people, and two of them can have the same id. -->
  <ul
    v-if="settings.view === 'list'"
    :class="[!bare && 'page', 'flex list-none flex-col gap-3 py-4']"
  >
    <li v-for="item in items" :key="searchKey(item)">
      <PersonCard v-if="isPerson(item)" :person="item" list />
      <PosterListItem v-else :item="item" :show-type="showType" />
    </li>
  </ul>
  <ul
    v-else
    :class="[
      !bare && 'page',
      'card-grid list-none py-4',
      GRID_SIZE[settings.view],
    ]"
  >
    <li v-for="item in items" :key="searchKey(item)">
      <PersonCard v-if="isPerson(item)" :person="item" />
      <PosterCard
        v-else
        :item="item"
        grid
        :size="settings.view"
        :show-type="showType"
      />
    </li>
  </ul>
</template>
