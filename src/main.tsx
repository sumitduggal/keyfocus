import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import DesignPrototype from "./components/DesignPrototype.tsx";
import { migrateHiddenFeatures } from "./migrate-hidden-features";

migrateHiddenFeatures(localStorage);

const showDesignPrototype =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has("variant");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {showDesignPrototype ? <DesignPrototype /> : <App />}
  </StrictMode>,
);
