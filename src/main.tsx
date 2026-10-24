import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { downloadTextFile, migrateHiddenFeatures } from "./migrate-hidden-features";

migrateHiddenFeatures(localStorage, downloadTextFile);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
