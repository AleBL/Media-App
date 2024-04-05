<template>
  <div class='search'>
    <h1>{{ title }}</h1>
    <input type='text' v-model='query' @keyup='getResult(query)' placeholder='Search title..'/>

    <div>
      <div v-for='result in results' :key='result.id' class='card'>
        <p>{{ result[resultPropertyName] }}</p>
        <img v-if='result.poster_path' v-bind:src='getImage(result.poster_path)' alt="Imagem do filme">
        <img v-else src="../assets/default_search.jpg" alt="Imagem padrão">
      </div>

      <div v-if='pager.pages && pager.pages.length' class='pagination'>
        <button v-on:click='getResult (query)'>First</button>
        <button v-on:click='getPreviousPage()'>Previous</button>

        <button v-for="page in pager.pages" :key="page" :class="{'active':page === pager.currentPage}"
          v-on:click='getResult (query, page)'>{{ page }}</button>

        <button v-on:click='getNextPage()'>Next</button>
        <button v-on:click='getResult (query, pager.totalPages)'>Last</button>
      </div>
    </div>
  </div>
</template>

<script>
import { theMovieDb } from '../util/tmdb'
import paginate from 'jw-paginate'

export default {
  name: 'search',
  props: {
    title: {
      type: String,
      default: 'Search'
    },
    searchType: Number
  },
  data () {
    return {
      query: '',
      results: [],
      pager: {},
      resultPropertyName: '',
      searchFunctionName: ''
    }
  },
  mounted() {
    switch (this.searchType) {
      case this.$constants.MEDIA_TYPES.MOVIE:
        this.resultPropertyName = 'title'
        this.searchFunctionName = 'getMovie'
        break;
      case this.$constants.MEDIA_TYPES.TV_SHOW:
        this.resultPropertyName = 'name'
        this.searchFunctionName = 'getTv'
        break;
      default:
        throw new Error('Tipo de busca inválido: ' + this.searchType)
    }
  },
  methods: {
    async getResult (query, page = 1) {
      this.results = []
      this.pager = {}

      if (!query || query.length === 0) {
        return
      }

      const params = {
        query: query,
        page: page
      }

      try {
        const { response } = await theMovieDb.search[this.searchFunctionName](params)

        this.results = response.results
        this.pager = paginate(response.total_results, page, 20)
      } catch (error) {
        console.log(error.response)
        alert('Error: ' + error.status + '\n ' +
          'Message: ' + error.response.status_message)
      }
    },
    getPreviousPage() {
      if (this.pager.currentPage > 1) {
        this.getResult(this.query, this.pager.currentPage - 1)
      }
    },
    getNextPage() {
      this.getResult(this.query, this.pager.currentPage + 1)
    },
    getImage (path) {
      const params = { file: path }

      return theMovieDb.common.getImage(params)
    }
  }
}
</script>

<style>
  @import '../style/search.css';
</style>