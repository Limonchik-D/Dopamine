import { Card } from "../components/ui/Card";
import { usePatchSettings, useSettings } from "../features/settings/useSettings";
import { useUiSettings } from "../features/settings/useUiSettings";

export function SettingsPage() {
  const { data } = useSettings();
  const patchSettings = usePatchSettings();
  const { theme, setTheme, locale, setLocale } = useUiSettings();

  return (
    <Card>
      <h2>Настройки</h2>
      <div className="stack">
        <label>
          Тема
          <select
            value={theme}
            onChange={(e) => {
              const selected = e.target.value as "calm" | "sport" | "minimal" | "dark";
              setTheme(selected);
              patchSettings.mutate({ theme: selected });
            }}
          >
            <option value="calm">Calm</option>
            <option value="sport">Sport</option>
            <option value="minimal">Minimal</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label>
          Язык
          <select
            value={locale}
            onChange={(e) => {
              const selected = e.target.value as "ru" | "en";
              setLocale(selected);
              patchSettings.mutate({ locale: selected });
            }}
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>

        <p>Единицы: {data?.units ?? "metric"}</p>
      </div>
    </Card>
  );
}
