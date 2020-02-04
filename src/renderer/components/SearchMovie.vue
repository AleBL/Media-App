<template>
  <div class='search'>
    <h1>Search Movie List</h1>
    <input type='text' v-model='query' @keyup='getResult(query)'>
    <div v-for='result in results' :key='result.id'>
      <p>{{result.title}}</p>
      <img v-bind:src="'http://image.tmdb.org/t/p/w500/' +    result.poster_path" width='100px'>
    </div>
  </div>
</template>
<script>

import axios from 'axios'
import constants from '../store/constants'

export default {
  name: 'search',
  data () {
    return {
      query: '',
      results: ''
    }
  },
  methods: {
    getResult (query) {
      axios.get(constants.linkSearchMovieList + query)
        .then(response => { this.results = response.data.results })
      console.log(this.results)
    }
  }
}
</script>