import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { UpdateState } from '@shared/api';
import { getApi } from '@/services/api';

/** A newer version of the app, as the main process found it. */
export const useUpdatesStore = defineStore('updates', () => {
  const state = ref<UpdateState>({ status: 'idle' });
  // The version the user closed the notice of, for this run of the app.
  const dismissedVersion = ref<string | null>(null);
  let stopListening: (() => void) | undefined;

  const visible = computed(
    () =>
      (state.value.status === 'ready' || state.value.status === 'available') &&
      state.value.version !== dismissedVersion.value,
  );

  async function load() {
    let changed = false;

    stopListening ??= getApi().updates.onChange((next) => {
      changed = true;
      state.value = next;
    });

    const current = await getApi().updates.state();

    // A change that came while asking is newer than the answer.
    if (!changed) {
      state.value = current;
    }
  }

  const install = () => getApi().updates.install();

  function dismiss() {
    if (state.value.status !== 'idle') {
      dismissedVersion.value = state.value.version;
    }
  }

  return { state, visible, load, install, dismiss };
});
