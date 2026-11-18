// Runs before the page paints, so the loading screen already has the theme
// the user chose: useDark keeps it under this key ('auto', 'dark' or
// 'light'; see src/components/NavBar/theme.ts). A file and not inline code,
// which the Content-Security-Policy refuses.
(function () {
  var scheme = 'auto';

  try {
    scheme = localStorage.getItem('vueuse-color-scheme') || 'auto';
  } catch (error) {
    // Storage that cannot be read: the theme of the system.
  }

  var dark =
    scheme === 'dark' ||
    (scheme !== 'light' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', dark);
})();
