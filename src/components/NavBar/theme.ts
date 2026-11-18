import { watch } from 'vue';

// Without the <style> element that useDark adds to stop transitions while
// the theme changes: the Content-Security-Policy refuses inline styles.
export const isDark = useDark({ disableTransition: false });

/** Light to dark and back, as the button of the menu does. */
export const toggleTheme = useToggle(isDark);

// useDark keeps 'auto', 'dark' or 'light' under this key. The native theme
// follows it, so the window chrome matches the app and 'auto' keeps tracking
// the operating system. The settings page sets it; the menu flips between
// light and dark.
export const colorScheme = useStorage('vueuse-color-scheme', 'auto');

watch(
  colorScheme,
  (scheme) => {
    window.api?.setNativeTheme(
      scheme === 'dark' || scheme === 'light' ? scheme : 'system',
    );
  },
  { immediate: true },
);
