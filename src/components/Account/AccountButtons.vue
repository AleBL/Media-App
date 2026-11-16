<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useRoute } from 'vue-router';
  import type { AccountList, MediaType } from '@shared/api';
  import AppButton from '@/components/ui/AppButton.vue';
  import { useAccountStore } from '@/stores/account';
  import { useSessionStore } from '@/stores/session';

  const props = defineProps<{ type: MediaType; id: number }>();

  const { t } = useI18n();
  const route = useRoute();
  const session = useSessionStore();
  const account = useAccountStore();

  const title = computed(() => ({ type: props.type, id: props.id }));
  const states = computed(() => account.statesOf(title.value));
  const failed = ref<'load' | 'save' | null>(null);

  const LISTS: { list: AccountList; label: string; icon: string }[] = [
    { list: 'watchlist', label: 'lists.watchlistButton', icon: 'pi-bookmark' },
    { list: 'favorite', label: 'lists.favoriteButton', icon: 'pi-heart' },
  ];

  // Where the title is, asked again for another title or someone else.
  watch(
    () => [session.account?.id, props.type, props.id] as const,
    async ([signedIn]) => {
      failed.value = null;

      if (signedIn === undefined) {
        return;
      }

      const answer = await account.load(title.value);

      if (!answer.ok && answer.error.code !== 'signed-out') {
        failed.value = 'load';
      }
    },
    { immediate: true },
  );

  async function toggle(list: AccountList) {
    failed.value = null;

    const answer = await account.toggle(list, title.value);

    if (answer && !answer.ok && answer.error.code !== 'signed-out') {
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
      <AppButton
        v-for="item in LISTS"
        :key="item.list"
        :label="t(item.label)"
        :icon="`pi ${item.icon}${states?.[item.list] ? '-fill' : ''}`"
        :severity="states?.[item.list] ? 'primary' : 'secondary'"
        :aria-pressed="states ? states[item.list] : undefined"
        :disabled="!states"
        @click="toggle(item.list)"
      />
    </div>
    <p
      v-if="failed"
      role="alert"
      class="mt-2 text-sm text-red-600 dark:text-red-400"
    >
      {{ t(failed === 'load' ? 'lists.statesFailed' : 'lists.saveFailed') }}
    </p>
  </div>

  <p v-else class="text-sm">
    <RouterLink :to="{ name: 'account', query: { next: route.fullPath } }">
      {{ t('lists.signInToSave') }}
    </RouterLink>
  </p>
</template>
