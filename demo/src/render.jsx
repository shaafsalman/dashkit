// Headless render target: one dashkit chart, sized for a Medium image.
// Config arrives base64-encoded in the URL hash so the dev server never rebuilds.
import React from "react";
import { createRoot } from "react-dom/client";
import * as DK from "dashkit";
import "./index.css";

function decode() {
  try {
    const raw = decodeURIComponent(escape(atob(location.hash.slice(1))));
    return JSON.parse(raw);
  } catch (e) {
    return { component: "BarRankingChart", props: {}, width: 900 };
  }
}

const cfg = decode();
const Comp = DK[cfg.component];
const el = document.getElementById("root");
el.style.width = (cfg.width || 900) + "px";
el.style.padding = (cfg.pad ?? 24) + "px";
el.style.background = cfg.bg || "#ffffff";

if (!Comp) {
  el.textContent = "unknown component: " + cfg.component +
    "  |  available: " + Object.keys(DK).filter(k => /Chart|Card|Grid|Tiles|Panels|Gauge/.test(k)).join(", ");
} else {
  createRoot(el).render(<Comp {...(cfg.props || {})} />);
  // let charts finish their entry animation before the screenshot
  setTimeout(() => { document.title = "READY"; }, 1200);
}
