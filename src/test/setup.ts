import { vi } from 'vitest';

// Unit tests must never reach the real TMDB API. Anything that is not
// mocked fails loudly here instead of doing a network request.
vi.stubGlobal(
  'XMLHttpRequest',
  class {
    constructor() {
      throw new Error(
        'Network access is not allowed in unit tests: mock theMovieDb instead',
      );
    }
  },
);
