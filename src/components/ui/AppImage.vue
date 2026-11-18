<script setup lang="ts">
  import { ref, watch } from 'vue';

  const props = withDefaults(
    defineProps<{
      /** The address of the image; none shows the icon instead. */
      src?: string | null;
      /** Empty for an image that only decorates. */
      alt?: string;
      /** Keeps the space of the image while it loads. */
      shape?: 'poster' | 'square' | 'video';
      /** A PrimeIcons class, shown when there is no image or it failed. */
      icon?: string;
      /** For an image at the top of the page, which should not wait. */
      eager?: boolean;
    }>(),
    {
      src: null,
      alt: '',
      shape: 'poster',
      icon: 'pi pi-image',
      eager: false,
    },
  );

  const state = ref<'loading' | 'loaded' | 'failed'>(
    props.src ? 'loading' : 'failed',
  );

  watch(
    () => props.src,
    (src) => {
      state.value = src ? 'loading' : 'failed';
    },
  );

  const SHAPES = {
    poster: 'aspect-[2/3]',
    square: 'aspect-square',
    video: 'aspect-video',
  };
</script>

<template>
  <!-- The box keeps its size from the start, so nothing moves when the image
       arrives: it pulses while loading and the image fades in. -->
  <div
    :class="[
      'relative overflow-hidden bg-surface-100 dark:bg-surface-800',
      SHAPES[shape],
      state === 'loading' && 'animate-pulse motion-reduce:animate-none',
    ]"
    :data-state="state"
  >
    <img
      v-if="src && state !== 'failed'"
      :src="src"
      :alt="alt"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      :class="[
        'h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none',
        state === 'loaded' ? 'opacity-100' : 'opacity-0',
      ]"
      @load="state = 'loaded'"
      @error="state = 'failed'"
    />
    <!-- Without the image, the icon; still named when the image was. -->
    <div
      v-else
      class="flex h-full w-full items-center justify-center text-surface-400 dark:text-surface-500"
      :role="alt ? 'img' : undefined"
      :aria-label="alt || undefined"
    >
      <span :class="[icon, 'text-3xl']" aria-hidden="true" />
    </div>
  </div>
</template>
