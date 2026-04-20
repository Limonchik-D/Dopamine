import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "./providers";
import { AppRouter } from "./router";

export function AppRoot() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  );
}
