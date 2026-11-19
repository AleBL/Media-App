<script setup lang="ts">
  import { computed } from 'vue';
  import {
    DialogClose,
    DialogContent,
    DialogOverlay,
    DialogPortal,
    DialogRoot,
    DialogTitle,
    DialogTrigger,
  } from 'reka-ui';
  import AppButton from '@/components/ui/AppButton.vue';

  const props = defineProps<{
    /** The YouTube video. */
    videoKey: string;
    /** The title it is the trailer of. */
    title: string;
  }>();

  const { t } = useI18n();

  const key = computed(() => encodeURIComponent(props.videoKey));
  // YouTube without its cookies until the video plays; it starts at once,
  // since it was asked for, and ends without videos of other channels.
  const player = computed(
    () =>
      `https://www.youtube-nocookie.com/embed/${key.value}?autoplay=1&rel=0`,
  );
  const onYouTube = computed(
    () => `https://www.youtube.com/watch?v=${key.value}`,
  );
  const name = computed(() => t('details.trailerOf', { title: props.title }));
</script>

<template>
  <!-- The trailer over the page, in the middle. Esc, a click outside and
       the close button take it away, and the video stops with it: the
       player leaves the page. The focus goes back to the button. -->
  <DialogRoot>
    <DialogTrigger as-child>
      <AppButton :label="t('details.trailer')" icon="pi pi-youtube" />
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-surface-950/80" />
      <!-- As wide as fits, and no taller than the window. -->
      <DialogContent
        :aria-describedby="undefined"
        class="fixed left-1/2 top-1/2 z-50 w-[min(64rem,calc(100vw_-_2rem),calc((100dvh_-_9rem)*16/9))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface-0 p-3 shadow-2xl focus:outline-hidden sm:p-4 dark:bg-surface-900"
      >
        <div class="mb-3 flex items-center justify-between gap-3">
          <DialogTitle
            class="truncate text-base font-semibold text-surface-900 dark:text-surface-0"
          >
            {{ name }}
          </DialogTitle>
          <DialogClose as-child>
            <AppButton
              severity="ghost"
              icon="pi pi-times"
              :aria-label="t('details.closeTrailer')"
            />
          </DialogClose>
        </div>

        <!-- The app sends who it is to YouTube: the referrer on the web,
             the main process on the desktop. -->
        <iframe
          :src="player"
          :title="name"
          class="block aspect-video w-full rounded-lg bg-black"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowfullscreen
        />

        <div class="mt-3 flex justify-end">
          <AppButton
            :href="onYouTube"
            :label="t('details.openOnYouTube')"
            icon="pi pi-external-link"
            severity="ghost"
            size="sm"
          />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
