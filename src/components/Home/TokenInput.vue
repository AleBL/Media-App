<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { storeToRefs } from 'pinia';
  import Password from 'primevue/password';
  import Button from 'primevue/button';
  import { useCredentialsStore } from '@/stores/credentials';

  const { t } = useI18n();
  const credentials = useCredentialsStore();
  const { hasKey, persisted, encrypted } = storeToRefs(credentials);

  // The typed key is sent to the main process and then forgotten here: a
  // saved key is never shown again.
  const draft = ref('');
  const rejected = ref(false);

  onMounted(() => credentials.load());

  async function save() {
    const apiKey = draft.value.trim();

    if (!apiKey) {
      return;
    }

    rejected.value = !(await credentials.save(apiKey));

    if (!rejected.value) {
      draft.value = '';
    }
  }

  async function remove() {
    rejected.value = false;
    await credentials.clear();
  }
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div class="flex items-center gap-3">
      <Password
        v-model="draft"
        :feedback="false"
        :toggle-mask="!hasKey"
        :disabled="hasKey"
        :placeholder="hasKey ? t('homePage.keySaved') : ''"
        style="width: 330px"
        @keyup.enter="save"
      />
      <Button
        v-if="hasKey"
        icon="pi pi-trash"
        severity="danger"
        :aria-label="t('homePage.removeKey')"
        @click="remove"
      />
      <Button
        v-else
        icon="pi pi-save"
        :aria-label="t('homePage.saveKey')"
        @click="save"
      />
    </div>

    <p
      v-if="rejected"
      role="alert"
      class="text-sm text-red-600 dark:text-red-400"
    >
      {{ t('homePage.invalidKey') }}
    </p>
    <p v-else-if="hasKey && !persisted" role="status" class="text-sm">
      {{ t('homePage.keyNotPersisted') }}
    </p>
    <p v-else-if="hasKey && !encrypted" role="status" class="text-sm">
      {{ t('homePage.keyNotEncrypted') }}
    </p>
  </div>
</template>
