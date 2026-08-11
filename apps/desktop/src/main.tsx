import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { I18nProvider } from "./i18n";
import { readStoredLocale } from "./i18n/types";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("root element missing");
}

document.documentElement.lang = readStoredLocale();

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
