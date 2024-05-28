<script setup lang="ts">
  import TokenInput from '@/components/Home/TokenInput.vue';

  const { t } = useI18n();
</script>

<template>
  <div class="text-center my-5">
    <h1 class="mb-3 text-2xl">
      {{ t('pageTitles.home') }}
    </h1>
  </div>

  <div class="grid justify-center pb-4">
    <ol class="list-decimal">
      <li><a href="https://www.themoviedb.org/settings/api" target="_blank">{{ t('common.clickHere') }}</a> {{ t('homePage.stepOne') }}</li>
      <li>{{ t('homePage.stepTwo') }}</li>
      <li>{{ t('homePage.stepThree') }}</li>
      <li>{{ t('homePage.stepFour') }}</li>
    </ol>
  </div>

  <div class="flex justify-center items-center gap-3">
    <TokenInput />
  </div>
</template>
