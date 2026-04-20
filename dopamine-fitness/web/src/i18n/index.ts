import ru from "./ru.json";
import en from "./en.json";
import { useUiSettings } from "../features/settings/useUiSettings";

const dictionaries = { ru, en };

type DictionaryKey = keyof typeof ru;

export function useT() {
  const locale = useUiSettings((s) => s.locale);
  return (key: DictionaryKey) => dictionaries[locale][key] ?? key;
}
