import type { Router } from 'vue-router';

/**
 * Where the sign in goes back to, from the `next` of its address: a page of
 * the app, never an address of another site, and never the sign in itself.
 */
export function pageAfterSignIn(router: Router, next: unknown) {
  if (
    typeof next !== 'string' ||
    !next.startsWith('/') ||
    next.startsWith('//')
  ) {
    return null;
  }

  const page = router.resolve(next);

  return page.matched.length > 0 && page.name !== 'account'
    ? page.fullPath
    : null;
}
