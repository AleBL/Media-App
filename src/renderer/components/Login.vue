<template>
  <div class='login'>
    <h1>Login</h1>
    <input type='text' v-model='login'>
    <input type='text' v-model='password'>

    <button v-on:click='getLogin(login,password)'>Login</button>
  </div>
</template>
<script>

export default {
  name: 'login',
  data () {
    return {
      login: '',
      password: ''
    }
  },
  methods: {
    getLogin (login, password) {
      console.log(login)
      console.log(password)
    }
  }
}
</script>