<template>
  <!-- A thin bar at the top of content that is being loaded again: what is
       there stays readable, and the stripe says that something is coming.
       Whoever shows it sets aria-busy on the content. With reduced motion
       the stripe stays still. -->
  <div
    aria-hidden="true"
    class="relative h-0.5 w-full overflow-hidden rounded-full bg-primary-100 dark:bg-primary-950"
  >
    <span
      class="absolute inset-y-0 left-0 w-1/3 animate-loading-bar rounded-full bg-primary-600 motion-reduce:animate-none dark:bg-primary-400"
    />
  </div>
</template>
