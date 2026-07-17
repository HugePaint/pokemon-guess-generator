import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { TEMPLATE_URL } from "./features/rendering/template";
import "./styles.css";

const templatePreload = document.createElement("link");
templatePreload.rel = "preload";
templatePreload.as = "image";
templatePreload.href = TEMPLATE_URL;
document.head.append(templatePreload);

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
