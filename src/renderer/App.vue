<template>
  <div id="app">
    <div class="navbar">
      <div class="colum">
        <RouterLink :to="{ name: 'landing-page' }">
          <h4>Information</h4>
        </RouterLink>

        <RouterLink :to="{ name: 'searchmovie' }">
          <h4> Search Movie </h4>
        </RouterLink>

        <RouterLink :to="{ name: 'searchtv' }">
          <h4> Search TV Show </h4>
        </RouterLink>

        <RouterLink v-if="!false" :to="{ name: 'login' }">
          <h4> Login </h4>
        </RouterLink>
      </div>
    </div>

    <RouterView />
  </div>
</template>

<style>
  .navbar{
    width: 100%;
    height: 60px;
    background-color: #c8d7ff;
    box-shadow: 0.1px 0.1px 15px 0.1px #273c75;
    border-radius:10px;
    display: flex;
  }

  .colum{
    display: flex;
    width: 95%;
    height: 40px;
    margin-top: 10px;
    margin-left: 10px;
    
  }

  a {
    text-decoration: none;
    color: black;
    font-size: larger;
    padding: 0px 5px;
  }

  .colum > a > h4 {
    margin-top: 8px;
  }

  a:hover {
    color: white;
  }

  .router-link-exact-active{
    color: #0041da;
  }
</style>
