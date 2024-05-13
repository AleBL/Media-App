/*
 * The MIT License (MIT)
 *
 * Copyright (c) Franco Cavestri
 *
 * https://github.com/cavestri/themoviedb-javascript-library
 *
 */

export const theMovieDb = {}

theMovieDb.common = {
  api_key: '67b028d3837541f10fbe8a700775f54c',
  base_uri: 'http://api.themoviedb.org/3/',
  images_uri: 'http://image.tmdb.org/t/p/',
  timeout: 5000,
  language: 'en',
  generateQuery: function (options) {
    'use strict'
    const myOptions = options || {}
    let query = `?api_key=${theMovieDb.common.api_key}&language=${theMovieDb.common.language}`

    if (Object.keys(myOptions).length > 0) {
      for (const option in myOptions) {
        if (myOptions.hasOwnProperty(option) && option !== 'id' && option !== 'body') {
          query = query + '&' + option + '=' + myOptions[option]
        }
      }
    }
    return query
  },
  validateRequired: function (args, argsReq, opt, optReq, allOpt) {
    'use strict'
    const allOptional = allOpt || false

    if (args.length !== argsReq) {
      throw new Error('The method requires  ' + argsReq + ' arguments and you are sending ' + args.length + '!')
    }

    if (allOptional) {
      return
    }

    if (argsReq > 2) {
      for (let i = 0; i < optReq.length; i = i + 1) {
        if (!opt.hasOwnProperty(optReq[i])) {
          throw new Error(optReq[i] + ' is a required parameter and is not present in the options!')
        }
      }
    }
  },
  getImage: function (options) {
    'use strict'
    const size = options.size || 'original'

    return theMovieDb.common.images_uri + size + options.file
  },

  client: async function (options) {
    'use strict'
    const method = options.method || 'GET'
    const status = options.status || 200
    const xhr = new XMLHttpRequest()

    xhr.open(method, theMovieDb.common.base_uri + options.url, true)

    xhr.responseType = 'json'
    if (options.method === 'POST') {
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.setRequestHeader('Accept', 'application/json')
    }

    xhr.timeout = theMovieDb.common.timeout

    const result = await new Promise(function (resolve, reject) {
      xhr.ontimeout = function () {
        reject(xhr)
      }

      xhr.onerror = function (e) {
        reject(xhr)
      }

      xhr.onload = function (e) {
        if (xhr.readyState === 4 && xhr.status === status) {
          resolve(xhr)
        } else {
          reject(xhr)
        }
      }

      if (options.method === 'POST') {
        xhr.send(JSON.stringify(options.body))
      } else {
        xhr.send()
      }
    })

    return result
  }
}

theMovieDb.configurations = {
  getConfiguration: function () {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0)

    return theMovieDb.common.client({
      url: 'configuration' + theMovieDb.common.generateQuery()
    })
  },
  getCountries: function () {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0)

    return theMovieDb.common.client({
      url: 'configuration/countries' + theMovieDb.common.generateQuery()
    })
  },
  getJobs: function () {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0)

    return theMovieDb.common.client({
      url: 'configuration/jobs' + theMovieDb.common.generateQuery()
    })
  },
  getLanguages: function () {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0)

    return theMovieDb.common.client({
      url: 'configuration/languages' + theMovieDb.common.generateQuery()
    })
  },
  getPrimaryTranslations: function () {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0)

    return theMovieDb.common.client({
      url: 'configuration/primary_translations' + theMovieDb.common.generateQuery()
    })
  },
  getTimezones: function () {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0)

    return theMovieDb.common.client({
      url: 'configuration/timezones' + theMovieDb.common.generateQuery()
    })
  }
}

theMovieDb.account = {
  getInformation: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0, options, ['session_id'])

    return theMovieDb.common.client({
      url: 'account' + theMovieDb.common.generateQuery(options)
    })
  },
  getLists: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      url: 'account/' + options.id + '/lists' + theMovieDb.common.generateQuery(options)
    })
  },
  getFavoritesMovies: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      url: 'account/' + options.id + '/favorite/movies' + theMovieDb.common.generateQuery(options)
    })
  },
  getFavoritesTvShows: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      url: 'account/' + options.id + '/favorite/tv?' + theMovieDb.common.generateQuery(options)
    })
  },
  addFavorite: function (options) {
    'use strict'
    theMovieDb.common.validateRequired(arguments, 0, options, ['session_id', 'id', 'media_type', 'media_id', 'favorite'])

    const body = {
      media_type: options.media_type,
      media_id: options.media_id,
      favorite: options.favorite
    }

    return theMovieDb.common.client({
      url: 'account/' + options.id + '/favorite' + theMovieDb.common.generateQuery(options),
      status: 201,
      method: 'POST',
      body
    })
  },
  getRatedMovies: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      url: 'account/' + options.id + '/rated/movies' + theMovieDb.common.generateQuery(options)
    })
  },
  getRatedTvShows: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      url: 'account/' + options.id + '/rated/tv' + theMovieDb.common.generateQuery(options)
    })
  },
  getRatedTvEpisodes: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      url: 'account/' + options.id + 'rated/tv/episodes' + theMovieDb.common.generateQuery(options)
    })
  },
  getMovieWatchlist: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      url: 'account/' + options.id + '/watchlist/movies' + theMovieDb.common.generateQuery(options)
    })
  },
  getTvShowsWatchlist: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      url: 'account/' + options.id + '/watchlist/tv' + theMovieDb.common.generateQuery(options)
    })
  },
  addToWatchlist: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['session_id', 'id', 'media_type', 'media_id', 'watchlist'])

    const body = {
      media_type: options.media_type,
      media_id: options.media_id,
      watchlist: options.watchlist
    }

    return theMovieDb.common.client({
      url: 'account/' + options.id + '/watchlist' + theMovieDb.common.generateQuery(options),
      method: 'POST',
      status: 201,
      body
    })
  }
}

theMovieDb.authentication = {
  generateToken: function () {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0)

    return theMovieDb.common.client({
      url: 'authentication/token/new' + theMovieDb.common.generateQuery()
    })
  },
  askPermissions: function (options) {
    'use strict'

    window.open('https://www.themoviedb.org/authenticate/' + options.token + '?redirect_to=' + options.redirect_to)
  },
  validateUser: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['request_token', 'username', 'password'])

    return theMovieDb.common.client({
      url: 'authentication/token/validate_with_login' + theMovieDb.common.generateQuery(options)
    })
  },
  generateSession: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['request_token'])

    return theMovieDb.common.client({
      url: 'authentication/session/new' + theMovieDb.common.generateQuery(options)
    })
  },
  generateGuestSession: function () {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0)

    return theMovieDb.common.client({
      url: 'authentication/guest_session/new' + theMovieDb.common.generateQuery()
    })
  }
}

theMovieDb.certifications = {
  getMovieList: function () {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0)

    return theMovieDb.common.client({
      url: 'certification/movie/list' + theMovieDb.common.generateQuery()
    })
  },
  getTvList: function () {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0)

    return theMovieDb.common.client({
      url: 'certification/tv/list' + theMovieDb.common.generateQuery()
    })
  }
}

theMovieDb.changes = {
  getMovieChanges: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'movie/changes' + theMovieDb.common.generateQuery(options)
    })
  },
  getPersonChanges: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'person/changes' + theMovieDb.common.generateQuery(options)
    })
  },
  getTvChanges: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'tv/changes' + theMovieDb.common.generateQuery(options)
    })
  }
}

theMovieDb.collections = {
  getDetails: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'collection/' + options.id + theMovieDb.common.generateQuery(options)
    })
  },
  getImages: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'collection/' + options.id + '/images' + theMovieDb.common.generateQuery(options)
    })
  },
  getTranslations: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'collection/' + options.id + '/translations' + theMovieDb.common.generateQuery(options)
    })
  }
}

theMovieDb.companies = {
  getDetails: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'company/' + options.id + theMovieDb.common.generateQuery(options)
    })
  },
  getAlternativeNames: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'company/' + options.id + '/alternative_names' + theMovieDb.common.generateQuery(options)
    })
  }

}

theMovieDb.credits = {
  getDetails: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'credit/' + options.id + theMovieDb.common.generateQuery(options)
    })
  }
}

theMovieDb.discover = {
  getMovies: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'discover/movie' + theMovieDb.common.generateQuery(options)
    })
  },
  getTvShows: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'discover/tv' + theMovieDb.common.generateQuery(options)
    })
  }

}

theMovieDb.find = {
  getById: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id', 'external_source'])

    return theMovieDb.common.client({
      url: 'find/' + options.id + theMovieDb.common.generateQuery(options)
    })
  }
}

theMovieDb.genres = {
  getMovieList: function (options) {
    'use strict'

    return theMovieDb.common.client({
      url: 'genre/movie/list' + theMovieDb.common.generateQuery(options)
    })
  },
  getMovies: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'genre/' + options.id + '/movies' + theMovieDb.common.generateQuery(options)
    })
  },
  getTvList: function (options) {
    'use strict'

    return theMovieDb.common.client({
      url: 'genre/tv/list' + theMovieDb.common.generateQuery(options)
    })
  }

}

theMovieDb.guestSession = {
  getRatedMovies: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, ['id'])

    return theMovieDb.common.client({
      url: 'guest_session/' + options.id + '/rated/movies' + theMovieDb.common.generateQuery()
    })
  },
  getRatedTvShows: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, ['id'])

    return theMovieDb.common.client({
      url: 'guest_session/' + options.id + '/rated/tv' + theMovieDb.common.generateQuery()
    })
  },
  getRatedTvEpisodes: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, ['id'])

    return theMovieDb.common.client({
      url: 'guest_session/' + options.id + '/rated/tv/episodes' + theMovieDb.common.generateQuery()
    })
  }
}

theMovieDb.keywords = {
  getById: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'keyword/' + options.id + theMovieDb.common.generateQuery(options)
    })
  },
  getMovies: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'keyword/' + options.id + '/movies' + theMovieDb.common.generateQuery(options)
    })
  }
}

theMovieDb.lists = {
  getById: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'list/' + options.id + theMovieDb.common.generateQuery(options)
    })
  },
  getStatusById: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id', 'movie_id'])

    return theMovieDb.common.client({
      url: 'list/' + options.id + '/item_status' + theMovieDb.common.generateQuery(options)
    })
  },
  addList: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['session_id', 'name', 'description'])

    const body = {
      name: options.name,
      description: options.description
    }

    delete options.name
    delete options.description

    if (options.hasOwnProperty('language')) {
      body.language = options.language

      delete options.language
    }

    return theMovieDb.common.client({
      method: 'POST',
      status: 201,
      url: 'list' + theMovieDb.common.generateQuery(options),
      body
    })
  },
  addItem: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['session_id', 'id', 'media_id'])

    const body = {
      media_id: options.media_id
    }

    return theMovieDb.common.client({
      method: 'POST',
      status: 201,
      url: 'list/' + options.id + '/add_item' + theMovieDb.common.generateQuery(options),
      body
    })
  },
  removeItem: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['session_id', 'id', 'media_id'])

    const body = {
      media_id: options.media_id
    }

    return theMovieDb.common.client({
      method: 'POST',
      status: 201,
      url: 'list/' + options.id + '/remove_item' + theMovieDb.common.generateQuery(options),
      body
    })
  },
  removeList: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      method: 'DELETE',
      status: 204,
      url: 'list/' + options.id + theMovieDb.common.generateQuery(options)
    })
  },
  clearList: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['session_id', 'id', 'confirm'])

    return theMovieDb.common.client({
      method: 'POST',
      status: 204,
      body: {},
      url: 'list/' + options.id + '/clear' + theMovieDb.common.generateQuery(options)
    })
  }
}

theMovieDb.movies = {
  getById: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + theMovieDb.common.generateQuery(options)
    })
  },
  getAccountStates: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/account_states' + theMovieDb.common.generateQuery(options)
    })
  },
  getAccountStatesGuest: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['guest_session_id', 'id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/account_states' + theMovieDb.common.generateQuery(options)
    })
  },
  getAlternativeTitles: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/alternative_titles' + theMovieDb.common.generateQuery(options)
    })
  },
  getChanges: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/changes' + theMovieDb.common.generateQuery(options)
    })
  },
  getCredits: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/credits' + theMovieDb.common.generateQuery(options)
    })
  },
  getExternalIds: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/external_ids' + theMovieDb.common.generateQuery(options)
    })
  },
  getImages: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/images' + theMovieDb.common.generateQuery(options)
    })
  },
  getKeywords: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/keywords' + theMovieDb.common.generateQuery(options)
    })
  },
  getReleases: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/release_dates' + theMovieDb.common.generateQuery(options)
    })
  },
  getVideos: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/videos' + theMovieDb.common.generateQuery(options)
    })
  },
  getTranslations: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/translations' + theMovieDb.common.generateQuery(options)
    })
  },
  getRecommendations: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/recommendations' + theMovieDb.common.generateQuery(options)
    })
  },
  getSimilarMovies: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/similar' + theMovieDb.common.generateQuery(options)
    })
  },
  getReviews: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/reviews' + theMovieDb.common.generateQuery(options)
    })
  },
  getLists: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'movie/' + options.id + '/lists' + theMovieDb.common.generateQuery(options)
    })
  },
  getLatest: function () {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0)

    return theMovieDb.common.client({
      url: 'movie/latest' + theMovieDb.common.generateQuery()
    })
  },
  getUpcoming: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'movie/upcoming' + theMovieDb.common.generateQuery(options)
    })
  },
  getNowPlaying: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'movie/now_playing' + theMovieDb.common.generateQuery(options)
    })
  },
  getPopular: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'movie/popular' + theMovieDb.common.generateQuery(options)
    })
  },
  getTopRated: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'movie/top_rated' + theMovieDb.common.generateQuery(options)
    })
  },
  rate: function (options, rate) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 2, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      method: 'POST',
      status: 201,
      url: 'movie/' + options.id + '/rating' + theMovieDb.common.generateQuery(options),
      body: {
        value: rate
      }
    })
  },
  rateGuest: function (options, rate) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 2, options, ['guest_session_id', 'id'])

    return theMovieDb.common.client({
      method: 'POST',
      status: 201,
      url: 'movie/' + options.id + '/rating' + theMovieDb.common.generateQuery(options),
      body: {
        value: rate
      }
    })
  },
  removeRate: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      method: 'DELETE',
      status: 200,
      url: 'movie/' + options.id + '/rating' + theMovieDb.common.generateQuery(options)
    })
  },
  removeRateGuest: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['guest_session_id', 'id'])

    return theMovieDb.common.client({
      method: 'DELETE',
      status: 200,
      url: 'movie/' + options.id + '/rating' + theMovieDb.common.generateQuery(options)
    })
  }
}

theMovieDb.networks = {
  getById: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'network/' + options.id + theMovieDb.common.generateQuery(options)
    })
  },
  getAlternativeNames: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'network/' + options.id + '/alternative_names' + theMovieDb.common.generateQuery(options)
    })
  }
}

theMovieDb.people = {
  getById: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'person/' + options.id + theMovieDb.common.generateQuery(options)
    })
  },
  getMovieCredits: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'person/' + options.id + '/movie_credits' + theMovieDb.common.generateQuery(options)
    })
  },
  getTvCredits: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'person/' + options.id + '/tv_credits' + theMovieDb.common.generateQuery(options)
    })
  },
  getCredits: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'person/' + options.id + '/combined_credits' + theMovieDb.common.generateQuery(options)
    })
  },
  getExternalIds: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'person/' + options.id + '/external_ids' + theMovieDb.common.generateQuery(options)
    })
  },
  getImages: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'person/' + options.id + '/images' + theMovieDb.common.generateQuery(options)
    })
  },
  getTaggedImages: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'person/' + options.id + '/tagged_images' + theMovieDb.common.generateQuery(options)
    })
  },
  getChanges: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'person/' + options.id + '/changes' + theMovieDb.common.generateQuery(options)
    })
  },
  getPopular: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'person/popular' + theMovieDb.common.generateQuery(options)
    })
  },
  getLatest: function () {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0)

    return theMovieDb.common.client({
      url: 'person/latest' + theMovieDb.common.generateQuery()
    })
  }
}

theMovieDb.reviews = {
  getById: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'review/' + options.id + theMovieDb.common.generateQuery(options)
    })
  }
}

theMovieDb.search = {
  getMovie: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['query'])

    return theMovieDb.common.client({
      url: 'search/movie' + theMovieDb.common.generateQuery(options)
    })
  },
  getCollection: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['query'])

    return theMovieDb.common.client({
      url: 'search/collection' + theMovieDb.common.generateQuery(options)
    })
  },
  getTv: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['query'])

    return theMovieDb.common.client({
      url: 'search/tv' + theMovieDb.common.generateQuery(options)
    })
  },
  getPerson: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['query'])

    return theMovieDb.common.client({
      url: 'search/person' + theMovieDb.common.generateQuery(options)
    })
  },
  getCompany: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['query'])

    return theMovieDb.common.client({
      url: 'search/company' + theMovieDb.common.generateQuery(options)
    })
  },
  getKeyword: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['query'])

    return theMovieDb.common.client({
      url: 'search/keyword' + theMovieDb.common.generateQuery(options)
    })
  },
  getMulti: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['query'])

    return theMovieDb.common.client({
      url: 'search/multi' + theMovieDb.common.generateQuery(options)
    })
  }
}

theMovieDb.tv = {
  getById: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + theMovieDb.common.generateQuery(options)
    })
  },
  getAccountStates: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/account_states' + theMovieDb.common.generateQuery(options)
    })
  },
  getAccountStatesGuest: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['guest_session_id', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/account_states' + theMovieDb.common.generateQuery(options)
    })
  },
  getAlternativeTitles: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/alternative_titles' + theMovieDb.common.generateQuery(options)
    })
  },
  getChanges: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/changes' + theMovieDb.common.generateQuery(options)
    })
  },
  getContentRatings: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/content_ratings' + theMovieDb.common.generateQuery(options)
    })
  },
  getCredits: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/credits' + theMovieDb.common.generateQuery(options)
    })
  },
  getExternalIds: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/external_ids' + theMovieDb.common.generateQuery(options)
    })
  },
  getImages: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/images' + theMovieDb.common.generateQuery(options)
    })
  },
  getKeywords: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/keywords' + theMovieDb.common.generateQuery(options)
    })
  },
  getRecommendations: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/recommendations' + theMovieDb.common.generateQuery(options)
    })
  },
  getReviews: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/reviews' + theMovieDb.common.generateQuery(options)
    })
  },
  getScreenedTheatrically: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/screened_theatrically' + theMovieDb.common.generateQuery(options)
    })
  },
  getSimilar: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/similar' + theMovieDb.common.generateQuery(options)
    })
  },
  getTranslations: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/translations' + theMovieDb.common.generateQuery(options)
    })
  },
  getVideos: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/videos' + theMovieDb.common.generateQuery(options)
    })
  },
  getAiringToday: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'tv/airing_today' + theMovieDb.common.generateQuery(options)
    })
  },
  getLatest: function () {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 0, '', '', true)

    return theMovieDb.common.client({
      url: 'tv/latest' + theMovieDb.common.generateQuery()
    })
  },
  getOnTheAir: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'tv/on_the_air' + theMovieDb.common.generateQuery(options)
    })
  },
  getPopular: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'tv/popular' + theMovieDb.common.generateQuery(options)
    })
  },
  getTopRated: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, '', '', true)

    return theMovieDb.common.client({
      url: 'tv/top_rated' + theMovieDb.common.generateQuery(options)
    })
  },
  rate: function (options, rate) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 2, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      method: 'POST',
      status: 201,
      url: 'tv/' + options.id + '/rating' + theMovieDb.common.generateQuery(options),
      body: {
        value: rate
      }
    })
  },
  rateGuest: function (options, rate) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 2, options, ['guest_session_id', 'id'])

    return theMovieDb.common.client({
      method: 'POST',
      status: 201,
      url: 'tv/' + options.id + '/rating' + theMovieDb.common.generateQuery(options),
      body: {
        value: rate
      }
    })
  },
  removeRate: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['session_id', 'id'])

    return theMovieDb.common.client({
      method: 'DELETE',
      status: 200,
      url: 'tv/' + options.id + '/rating' + theMovieDb.common.generateQuery(options)
    })
  },
  removeRateGuest: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['guest_session_id', 'id'])

    return theMovieDb.common.client({
      method: 'DELETE',
      status: 200,
      url: 'tv/' + options.id + '/rating' + theMovieDb.common.generateQuery(options)
    })
  }
}

theMovieDb.tvSeasons = {
  getById: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + theMovieDb.common.generateQuery(options)
    })
  },
  getChanges: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/season/' + options.id + '/changes' + theMovieDb.common.generateQuery(options)
    })
  },
  getAccountStates: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['session_id', 'season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + '/account_states' + theMovieDb.common.generateQuery(options)
    })
  },
  getAccountStatesGuest: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['guest_session_id', 'season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + '/account_states' + theMovieDb.common.generateQuery(options)
    })
  },
  getCredits: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + '/credits' + theMovieDb.common.generateQuery(options)
    })
  },
  getExternalIds: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + '/external_ids' + theMovieDb.common.generateQuery(options)
    })
  },
  getImages: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + '/images' + theMovieDb.common.generateQuery(options)
    })
  },
  getVideos: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + '/videos' + theMovieDb.common.generateQuery(options)
    })
  }
}

theMovieDb.tvEpisodes = {
  getById: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['episode_number', 'season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + '/episode/' + options.episode_number + theMovieDb.common.generateQuery(options)
    })
  },
  getChanges: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['id'])

    return theMovieDb.common.client({
      url: 'tv/episode/' + options.id + '/changes' + theMovieDb.common.generateQuery(options)
    })
  },
  getAccountStates: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['session_id', 'episode_number', 'season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + '/episode/' + options.episode_number + '/account_states' + theMovieDb.common.generateQuery(options)
    })
  },
  getAccountStatesGuest: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['guest_session_id', 'episode_number', 'season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + '/episode/' + options.episode_number + '/account_states' + theMovieDb.common.generateQuery(options)
    })
  },
  getCredits: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['episode_number', 'season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + '/episode/' + options.episode_number + '/credits' + theMovieDb.common.generateQuery(options)
    })
  },
  getExternalIds: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['episode_number', 'season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + '/episode/' + options.episode_number + '/external_ids' + theMovieDb.common.generateQuery(options)
    })
  },
  getImages: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['episode_number', 'season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + '/episode/' + options.episode_number + '/images' + theMovieDb.common.generateQuery(options)
    })
  },
  getVideos: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['episode_number', 'season_number', 'id'])

    return theMovieDb.common.client({
      url: 'tv/' + options.id + '/season/' + options.season_number + '/episode/' + options.episode_number + '/videos' + theMovieDb.common.generateQuery(options)
    })
  },
  rate: function (options, rate) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 2, options, ['episode_number', 'season_number', 'session_id', 'id'])

    return theMovieDb.common.client({
      method: 'POST',
      status: 201,
      url: 'tv/' + options.id + '/season/' + options.season_number + '/episode/' + options.episode_number + '/rating' + theMovieDb.common.generateQuery(options),
      body: {
        value: rate
      }
    })
  },
  rateGuest: function (options, rate) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 2, options, ['episode_number', 'season_number', 'guest_session_id', 'id'])

    return theMovieDb.common.client({
      method: 'POST',
      status: 201,
      url: 'tv/' + options.id + '/season/' + options.season_number + '/episode/' + options.episode_number + '/rating' + theMovieDb.common.generateQuery(options),
      body: {
        value: rate
      }
    })
  },
  removeRate: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['episode_number', 'season_number', 'session_id', 'id'])

    return theMovieDb.common.client({
      method: 'DELETE',
      status: 200,
      url: 'tv/' + options.id + '/season/' + options.season_number + '/episode/' + options.episode_number + '/rating' + theMovieDb.common.generateQuery(options)
    })
  },
  removeRateGuest: function (options) {
    'use strict'

    theMovieDb.common.validateRequired(arguments, 1, options, ['episode_number', 'season_number', 'guest_session_id', 'id'])

    return theMovieDb.common.client({
      method: 'DELETE',
      status: 200,
      url: 'tv/' + options.id + '/season/' + options.season_number + '/episode/' + options.episode_number + '/rating' + theMovieDb.common.generateQuery(options)
    })
  }
}

if ((typeof module !== 'undefined') && (module.exports)) {
  module.exports = theMovieDb
}
