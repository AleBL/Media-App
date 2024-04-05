<template>
  <div>
    <Search title="Pesquisar Filmes" :searchType="this.$constants.MEDIA_TYPES.MOVIE"></Search>
  </div>
</template>

<script>
import Search from './Search.vue'

export default {
  name: 'search-movie',
  components: {
    Search
  }
}
</script>

<style>
/* Estilos para OtherComponent.vue */
</style>
