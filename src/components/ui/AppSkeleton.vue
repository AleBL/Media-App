<template>
  <!-- A grey block in the shape of what is coming; whoever shows it gives
       its size and says that something is loading (aria-busy or a status).
       It stops pulsing with reduced motion. -->
  <span
    aria-hidden="true"
    class="block animate-pulse rounded-md bg-surface-200 motion-reduce:animate-none dark:bg-surface-700"
  />
</template>
