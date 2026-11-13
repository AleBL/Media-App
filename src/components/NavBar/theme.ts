import { computed, watch } from 'vue';

const isDark = useDark();
const toggleDark = useToggle(isDark);

// useDark keeps 'auto', 'dark' or 'light' under this key. The native theme
// follows it, so the window chrome matches the app and 'auto' keeps tracking
// the operating system.
const colorScheme = useStorage('vueuse-color-scheme', 'auto');

watch(
  colorScheme,
  (scheme) => {
    window.api?.setNativeTheme(
      scheme === 'dark' || scheme === 'light' ? scheme : 'system',
    );
  },
  { immediate: true },
);

export class ThemeItem {
  private translate: Function;

  constructor(translate: Function) {
    this.translate = translate;
  }

  public getThemes(): {} {
    const themeLabel = computed(() => {
      return (
        this.translate('theme.text') +
        (isDark.value
          ? ` ${this.translate('theme.dark')}`
          : ` ${this.translate('theme.light')}`)
      );
    });

    const themeIcon = computed(() => {
      return isDark.value ? 'pi pi-moon' : 'pi pi-sun';
    });

    return {
      label: themeLabel,
      icon: themeIcon,
      command: () => toggleDark(),
    };
  }
}
