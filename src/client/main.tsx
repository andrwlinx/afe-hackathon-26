import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { PhoneToolPage } from "./PhoneTool.js";
import "./styles.css";

const page =
  window.location.pathname === "/path" ? <App /> : <PhoneToolPage />;

createRoot(document.getElementById("root")!).render(
  <StrictMode>{page}</StrictMode>
);
