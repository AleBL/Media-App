import { vi } from 'vitest';

// The renderer reaches TMDB only through window.api, and unit tests must
// never reach the network: a request made by mistake fails loudly here.
vi.stubGlobal(
  'XMLHttpRequest',
  class {
    constructor() {
      throw new Error(
        'Network access is not allowed in unit tests: use installFakeApi()',
      );
    }
  },
);
