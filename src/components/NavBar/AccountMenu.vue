<script setup lang="ts">
  import { computed } from 'vue';
  import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuRoot,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from 'reka-ui';
  import AppButton from '@/components/ui/AppButton.vue';
  import { useSessionStore } from '@/stores/session';
  import { avatarUrl } from '@/util/images';
  import { accountLinks } from './links';
  import { MENU, MENU_ITEM } from './menu';

  const { t } = useI18n();
  const session = useSessionStore();

  const links = computed(() => accountLinks(t));
  const name = computed(
    () => session.account?.name ?? session.account?.username ?? '',
  );
  const avatar = computed(() =>
    session.account?.avatarPath ? avatarUrl(session.account.avatarPath) : null,
  );
</script>

<template>
  <!-- The pages of whoever signed in, under their name: the name is cut
       short in the bar, and only read out on a phone, where the picture
       stands for it. -->
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <AppButton severity="ghost" data-account-menu class="max-w-60 px-2">
        <img
          v-if="avatar"
          :src="avatar"
          alt=""
          class="h-6 w-6 shrink-0 rounded-full object-cover"
        />
        <span v-else class="pi pi-user" aria-hidden="true" />
        <span class="sr-only truncate sm:not-sr-only sm:max-w-40">{{
          name
        }}</span>
        <span class="pi pi-angle-down text-xs" aria-hidden="true" />
      </AppButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent align="end" :side-offset="6" :class="MENU">
        <DropdownMenuItem v-for="link in links" :key="link.to" as-child>
          <RouterLink :to="link.to" :class="MENU_ITEM">
            <span :class="link.icon" aria-hidden="true" />
            {{ link.label }}
          </RouterLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator
          class="my-1 h-px bg-surface-200 dark:bg-surface-700"
        />
        <DropdownMenuItem :class="MENU_ITEM" @select="session.logout()">
          <span class="pi pi-sign-out" aria-hidden="true" />
          {{ t('account.signOut') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
