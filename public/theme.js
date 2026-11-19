// Runs before the page paints, so the loading screen already has the theme
// and the size the user chose. useDark keeps the theme under its key ('auto',
// 'dark' or 'light'; see src/components/NavBar/theme.ts), and the settings
// store the size of the interface under 'ui-size' ('auto' or a percentage;
// see src/stores/settings.ts). A file and not inline code, which the
// Content-Security-Policy refuses.
(function () {
  var scheme = 'auto';
  var size = 'auto';

  try {
    scheme = localStorage.getItem('vueuse-color-scheme') || 'auto';
    size = localStorage.getItem('ui-size') || 'auto';
  } catch (error) {
    // Storage that cannot be read: the theme of the system, the automatic
    // size.
  }

  var dark =
    scheme === 'dark' ||
    (scheme !== 'light' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', dark);

  if (['90', '100', '110', '125'].indexOf(size) !== -1) {
    document.documentElement.setAttribute('data-ui-size', size);
  }
})();
