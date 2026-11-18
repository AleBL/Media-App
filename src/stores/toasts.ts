import { defineStore } from 'pinia';
import { ref } from 'vue';

/** A short notice in the corner, such as "Added to My list. Undo". */
export interface Toast {
  id: number;
  message: string;
  /** One thing to do about it, such as undoing the change. */
  action?: { label: string; run: () => void };
}

/** The notices on screen; AppToaster shows them and takes them away. */
export const useToastsStore = defineStore('toasts', () => {
  const toasts = ref<Toast[]>([]);
  let lastId = 0;

  function show(message: string, action?: Toast['action']) {
    const id = ++lastId;

    toasts.value = [...toasts.value, { id, message, action }];

    return id;
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  return { toasts, show, dismiss };
});
