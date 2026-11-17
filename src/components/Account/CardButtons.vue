<script setup lang="ts">
  import { computed, ref } from 'vue';
  import type { AccountList, MediaType } from '@shared/api';
  import { useAccountStore } from '@/stores/account';
  import { useSessionStore } from '@/stores/session';

  const props = defineProps<{
    type: MediaType;
    id: number;
    /** The title, which names the buttons among the ones of other cards. */
    name: string;
  }>();

  const { t } = useI18n();
  const session = useSessionStore();
  const account = useAccountStore();

  const title = computed(() => ({ type: props.type, id: props.id }));
  const states = computed(() => account.statesOf(title.value));
  const failed = ref(false);

  const LISTS: { list: AccountList; label: string; icon: string }[] = [
    { list: 'watchlist', label: 'lists.watchlistOf', icon: 'pi-bookmark' },
    { list: 'favorite', label: 'lists.favoriteOf', icon: 'pi-heart' },
  ];

  async function toggle(list: AccountList) {
    failed.value = false;

    const answer = await account.toggle(list, title.value);

    failed.value = !!answer && !answer.ok;
  }
</script>

<template>
  <!-- Over the card, above the link that covers it. Only for whoever signed
       in, once the app knows where the title is. The page of the title
       says why a change failed; here it shows by going back. -->
  <div v-if="session.account && states" class="flex gap-1">
    <button
      v-for="item in LISTS"
      :key="item.list"
      type="button"
      :aria-label="t(item.label, { title: name })"
      :aria-pressed="states[item.list]"
      :class="[
        'flex h-8 w-8 items-center justify-center rounded-full bg-surface-900/70 shadow-sm transition-colors duration-200 hover:bg-surface-900/90',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1',
        states[item.list] ? 'text-primary-400' : 'text-white',
      ]"
      @click="toggle(item.list)"
    >
      <span
        :class="`pi ${item.icon}${states[item.list] ? '-fill' : ''}`"
        aria-hidden="true"
      />
    </button>
    <span v-if="failed" role="alert" class="sr-only">
      {{ t('lists.saveFailed') }}
    </span>
  </div>
</template>
