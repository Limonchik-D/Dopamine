import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "./app/App";
import "./styles/tokens.css";
import "./styles/themes.css";
import "./styles/globals.css";
import "./styles/progress.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);
