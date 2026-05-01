import { useEffect } from "react";
import { useSettings } from "./useSettings";
import { useUiSettings } from "./useUiSettings";
import { isAuthenticated } from "../../services/auth";

export function SettingsSync() {
  const authed = isAuthenticated();
  const { data } = useSettings(authed);
  const hydrateFromServer = useUiSettings((s) => s.hydrateFromServer);

  useEffect(() => {
    if (!data) return;
    hydrateFromServer({
      theme: data.theme,
      locale: data.locale,
    });
  }, [data, hydrateFromServer]);

  return null;
}
