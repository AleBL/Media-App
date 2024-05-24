import { computed } from 'vue';

const isDark = useDark();
const toggleDark = useToggle(isDark);

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
