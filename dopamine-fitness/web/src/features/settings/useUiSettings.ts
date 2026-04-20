import { create } from "zustand";

type ThemeName = "calm" | "sport" | "minimal" | "dark";
type LocaleName = "ru" | "en";

type UiSettingsState = {
  theme: ThemeName;
  locale: LocaleName;
  setTheme: (theme: ThemeName) => void;
  setLocale: (locale: LocaleName) => void;
};

const THEME_KEY = "df_theme";
const LOCALE_KEY = "df_locale";

export const useUiSettings = create<UiSettingsState>((set) => ({
  theme: (localStorage.getItem(THEME_KEY) as ThemeName) ?? "calm",
  locale: (localStorage.getItem(LOCALE_KEY) as LocaleName) ?? "ru",
  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
  setLocale: (locale) => {
    localStorage.setItem(LOCALE_KEY, locale);
    set({ locale });
  },
}));
