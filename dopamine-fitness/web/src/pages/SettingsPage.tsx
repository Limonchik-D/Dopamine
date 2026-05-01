import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { usePatchSettings, useSettings } from "../features/settings/useSettings";
import { useUiSettings } from "../features/settings/useUiSettings";

export function SettingsPage() {
  const { data, isLoading } = useSettings();
  const patchSettings = usePatchSettings();
  const { theme, setTheme, locale, setLocale } = useUiSettings();

  if (isLoading) return <Card><p className="text-muted">Загрузка...</p></Card>;

  return (
    <Card>
      <h2>Настройки</h2>
      <div className="stack">

        {/* Тема */}
        <div className="settings-row">
          <span className="settings-label">Тема</span>
          <div className="row period-switcher">
            {(["fitness", "calm", "sport", "minimal", "dark"] as const).map((t) => (
              <Button
                key={t}
                className={theme === t ? "btn-segment is-active" : "btn-segment"}
                onClick={() => {
                  setTheme(t);
                  patchSettings.mutate({ theme: t });
                }}
              >
                {t === "fitness" ? "💪 Fitness" : t === "calm" ? "🌊 Calm" : t === "sport" ? "⚡ Sport" : t === "minimal" ? "🪨 Minimal" : "🌑 Dark"}
              </Button>
            ))}
          </div>
        </div>

        {/* Язык */}
        <div className="settings-row">
          <span className="settings-label">Язык</span>
          <div className="row period-switcher">
            {(["ru", "en"] as const).map((l) => (
              <Button
                key={l}
                className={locale === l ? "btn-segment is-active" : "btn-segment"}
                onClick={() => {
                  setLocale(l);
                  patchSettings.mutate({ locale: l });
                }}
              >
                {l === "ru" ? "🇷🇺 Русский" : "🇬🇧 English"}
              </Button>
            ))}
          </div>
        </div>

        {/* Единицы */}
        <div className="settings-row">
          <span className="settings-label">Единицы</span>
          <div className="row period-switcher">
            {(["metric", "imperial"] as const).map((u) => (
              <Button
                key={u}
                className={(data?.units ?? "metric") === u ? "btn-segment is-active" : "btn-segment"}
                onClick={() => patchSettings.mutate({ units: u })}
              >
                {u === "metric" ? "🏋️ кг / см" : "🦅 lb / in"}
              </Button>
            ))}
          </div>
        </div>

        {/* Уведомления */}
        <div className="settings-row">
          <span className="settings-label">Уведомления</span>
          <button
            className={`settings-toggle${data?.notifications_enabled ? " is-on" : ""}`}
            onClick={() =>
              patchSettings.mutate({ notifications_enabled: !data?.notifications_enabled })
            }
            aria-checked={data?.notifications_enabled}
            role="switch"
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>

        {patchSettings.isPending && <p className="text-muted">Сохранение...</p>}
        {patchSettings.isError && <p className="text-error">Ошибка сохранения настроек</p>}
      </div>
    </Card>
  );
}
