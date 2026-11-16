<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { storeToRefs } from 'pinia';
  import AppButton from '@/components/ui/AppButton.vue';
  import { useCredentialsStore } from '@/stores/credentials';

  const { t } = useI18n();
  const credentials = useCredentialsStore();
  const { hasKey, persisted, encrypted } = storeToRefs(credentials);

  // A key of the user's own, used instead of the app's credential. The typed
  // key is sent to the main process and then forgotten here: a saved key is
  // never shown again.
  const draft = ref('');
  const rejected = ref(false);
  // Shows what is being typed, to check it before saving.
  const revealed = ref(false);

  onMounted(() => credentials.load());

  async function save() {
    const apiKey = draft.value.trim();

    if (!apiKey) {
      return;
    }

    rejected.value = !(await credentials.save(apiKey));

    if (!rejected.value) {
      draft.value = '';
      revealed.value = false;
    }
  }

  async function remove() {
    rejected.value = false;
    await credentials.clear();
  }
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <label for="own-key" class="font-semibold">
      {{ t('settings.keyLabel') }}
    </label>
    <div class="flex items-center gap-3">
      <div class="relative" style="width: 330px">
        <input
          id="own-key"
          v-model="draft"
          :type="revealed && !hasKey ? 'text' : 'password'"
          class="field w-full pr-10"
          autocomplete="off"
          spellcheck="false"
          :disabled="hasKey"
          :placeholder="hasKey ? t('settings.keySaved') : ''"
          @keyup.enter="save"
        />
        <button
          v-if="!hasKey"
          type="button"
          class="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-surface-500 hover:text-surface-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-surface-400 dark:hover:text-surface-200"
          :aria-label="t('settings.showKey')"
          :aria-pressed="revealed"
          @click="revealed = !revealed"
        >
          <span
            :class="revealed ? 'pi pi-eye-slash' : 'pi pi-eye'"
            aria-hidden="true"
          />
        </button>
      </div>
      <AppButton
        v-if="hasKey"
        icon="pi pi-trash"
        severity="danger"
        :aria-label="t('settings.removeKey')"
        @click="remove"
      />
      <AppButton
        v-else
        icon="pi pi-save"
        :aria-label="t('settings.saveKey')"
        @click="save"
      />
    </div>

    <p
      v-if="rejected"
      role="alert"
      class="text-sm text-red-600 dark:text-red-400"
    >
      {{ t('settings.invalidKey') }}
    </p>
    <p v-else-if="hasKey && !persisted" role="status" class="text-sm">
      {{ t('settings.keyNotPersisted') }}
    </p>
    <p v-else-if="hasKey && !encrypted" role="status" class="text-sm">
      {{ t('settings.keyNotEncrypted') }}
    </p>
  </div>
</template>
