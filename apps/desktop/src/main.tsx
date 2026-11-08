import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { GuideProvider } from "./help/Guide";
import { I18nProvider } from "./i18n";
import { readStoredLocale } from "./i18n/types";
import { ReportProblemProvider } from "./report/ReportProblemContext";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("root element missing");
}

document.documentElement.lang = readStoredLocale();

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <ReportProblemProvider>
        <GuideProvider>
          <App />
        </GuideProvider>
      </ReportProblemProvider>
    </I18nProvider>
  </StrictMode>,
);
