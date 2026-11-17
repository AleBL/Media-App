<script setup lang="ts">
  import { computed, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { storeToRefs } from 'pinia';
  import AppButton from '@/components/ui/AppButton.vue';
  import { useSessionStore } from '@/stores/session';
  import { pageAfterSignIn } from '@/util/signIn';

  const { t, locale } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const session = useSessionStore();
  const { state, account, notConfirmed, busy } = storeToRefs(session);

  // Sent here by a page of the account: back to it once signed in. On the
  // web the sign in reloads the app on this page, without where it was.
  watch(
    account,
    (signedIn) => {
      const next = signedIn ? pageAfterSignIn(router, route.query.next) : null;

      if (next) {
        router.replace(next);
      }
    },
    { immediate: true },
  );

  const failure = computed(() =>
    state.value.status === 'error' ? state.value.reason : null,
  );
  // Shown for a browser that did not open by itself: the user copies it.
  const authorizeUrl = computed(() =>
    state.value.status === 'pending' ? state.value.authorizeUrl : '',
  );
  // Only the desktop app says these: on the web the site keeps the session.
  const offline = computed(
    () => state.value.status === 'authenticated' && state.value.offline,
  );
  const persistence = computed(() =>
    state.value.status === 'authenticated'
      ? state.value.persistence
      : undefined,
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

  <section class="mx-auto max-w-xl px-4 pb-4 text-center">
    <template v-if="account">
      <p class="mb-4">
        {{
          t('account.signedInAs', { name: account.name ?? account.username })
        }}
      </p>
      <ul class="mb-4 flex list-none flex-wrap justify-center gap-4 p-0">
        <li>
          <RouterLink :to="{ name: 'watchlist' }">
            {{ t('lists.watchlist') }}
          </RouterLink>
        </li>
        <li>
          <RouterLink :to="{ name: 'favorites' }">
            {{ t('lists.favorites') }}
          </RouterLink>
        </li>
        <li>
          <RouterLink :to="{ name: 'rated' }">
            {{ t('lists.rated') }}
          </RouterLink>
        </li>
        <li>
          <RouterLink :to="{ name: 'watched' }">
            {{ t('lists.watched') }}
          </RouterLink>
        </li>
      </ul>
      <p
        v-if="offline"
        role="status"
        class="mb-4 text-sm text-surface-600 dark:text-surface-400"
      >
        {{ t('account.offline') }}
      </p>
      <div v-if="persistence === 'ask'" class="mb-4">
        <p class="mb-2 text-sm text-surface-600 dark:text-surface-400">
          {{ t('account.notRemembered') }}
        </p>
        <AppButton
          :label="t('account.rememberAnyway')"
          icon="pi pi-bookmark"
          severity="secondary"
          :disabled="busy"
          @click="session.remember()"
        />
      </div>
      <p
        v-else-if="persistence === 'unencrypted' || persistence === 'failed'"
        class="mb-4 text-sm text-surface-600 dark:text-surface-400"
      >
        {{
          t(
            persistence === 'failed'
              ? 'account.notSaved'
              : 'account.savedUnencrypted',
          )
        }}
      </p>
      <AppButton
        :label="t('account.signOut')"
        icon="pi pi-sign-out"
        severity="secondary"
        :disabled="busy"
        @click="session.logout()"
      />
    </template>

    <!-- Only in the desktop app: on the web the wait is on the TMDB website -->
    <template v-else-if="state.status === 'pending'">
      <p role="status" class="mb-4">
        {{ t('account.waiting') }}
      </p>
      <div class="flex flex-wrap justify-center gap-3">
        <AppButton
          :label="t('account.alreadyApproved')"
          icon="pi pi-check"
          :disabled="busy"
          @click="session.confirm()"
        />
        <!-- Never disabled: giving up must work while TMDB is being asked -->
        <AppButton
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
      <AppButton
        :label="failure ? t('account.tryAgain') : t('account.signInWithTmdb')"
        icon="pi pi-sign-in"
        :disabled="busy"
        @click="session.login(locale)"
      />
    </template>
  </section>
</template>
