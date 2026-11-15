<script setup lang="ts">
  import { computed } from 'vue';
  import { storeToRefs } from 'pinia';
  import Button from 'primevue/button';
  import { isDesktop } from '@/services/api';
  import { useSessionStore } from '@/stores/session';

  const { t, locale } = useI18n();
  const session = useSessionStore();
  const { state, account, notConfirmed, busy } = storeToRefs(session);
  const desktop = isDesktop();

  const failure = computed(() =>
    state.value.status === 'error' ? state.value.reason : null,
  );
  // Shown for a browser that did not open by itself: the user copies it.
  const authorizeUrl = computed(() =>
    state.value.status === 'pending' ? state.value.authorizeUrl : '',
  );

  function selectAll(event: FocusEvent) {
    (event.target as HTMLInputElement).select();
  }
</script>

<template>
  <div class="text-center my-5">
    <h1 class="mb-3 text-2xl">
      {{ t('pageTitles.account') }}
    </h1>
  </div>

  <!-- The menu of the web version has no link to this page -->
  <p v-if="!desktop" class="mx-auto max-w-xl px-4 pb-4 text-center">
    {{ t('account.notOnWeb') }}
  </p>

  <section v-else class="mx-auto max-w-xl px-4 pb-4 text-center">
    <template v-if="account">
      <p class="mb-4">
        {{
          t('account.signedInAs', { name: account.name ?? account.username })
        }}
      </p>
      <Button
        :label="t('account.signOut')"
        icon="pi pi-sign-out"
        severity="secondary"
        :disabled="busy"
        @click="session.logout()"
      />
    </template>

    <template v-else-if="state.status === 'pending'">
      <p role="status" class="mb-4">
        {{ t('account.waiting') }}
      </p>
      <div class="flex flex-wrap justify-center gap-3">
        <Button
          :label="t('account.alreadyApproved')"
          icon="pi pi-check"
          :disabled="busy"
          @click="session.confirm()"
        />
        <!-- Never disabled: giving up must work while TMDB is being asked -->
        <Button
          :label="t('account.cancel')"
          severity="secondary"
          @click="session.cancel()"
        />
      </div>
      <p
        v-if="notConfirmed"
        role="alert"
        class="mt-4 text-sm text-red-600 dark:text-red-400"
      >
        {{ t('account.notConfirmedYet') }}
      </p>

      <label for="authorize-url" class="mb-1 mt-6 block text-sm">
        {{ t('account.pageDidNotOpen') }}
      </label>
      <input
        id="authorize-url"
        type="text"
        readonly
        :value="authorizeUrl"
        class="w-full rounded-md border border-surface-300 bg-transparent px-2 py-1 text-sm dark:border-surface-600"
        @focus="selectAll"
      />
    </template>

    <template v-else>
      <p
        v-if="failure"
        role="alert"
        class="mb-4 text-red-600 dark:text-red-400"
      >
        {{ t(`account.error.${failure}`) }}
      </p>
      <p class="mb-2">{{ t('account.intro') }}</p>
      <p class="mb-4">{{ t('account.howItWorks') }}</p>
      <Button
        :label="failure ? t('account.tryAgain') : t('account.signInWithTmdb')"
        icon="pi pi-sign-in"
        :disabled="busy"
        @click="session.login(locale)"
      />
    </template>
  </section>
</template>
