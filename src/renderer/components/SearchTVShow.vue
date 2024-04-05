<template>
  <div>
    <Search title="Pesquisar Série" :searchType="this.$constants.MEDIA_TYPES.TV_SHOW"></Search>
  </div>
</template>

<script>
import Search from './Search.vue'

export default {
  name: 'search-tvshow',
  components: {
    Search
  }
}
</script>

<style>
/* Estilos para OtherComponent.vue */
</style>
