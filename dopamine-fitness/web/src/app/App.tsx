import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "./providers";
import { AppRouter } from "./router";

export function AppRoot() {
  return (
    <AppProviders>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  );
}
