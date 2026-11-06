import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Organ, OrganPicker, ORGANS } from "../src/organs/index.js";

function App() {
  const q = new URLSearchParams(location.search);
  const [name, setName] = useState(q.get("organ") ?? "heart");
  const [dark, setDark] = useState(q.get("theme") !== "light");
  const [names, setNames] = useState(ORGANS);
  useEffect(() => {
    let live = true;
    Promise.all(ORGANS.map((n) => fetch(`/organs/${n}/manifest.json`).then((r) => (r.ok ? n : null)).catch(() => null))).then((found) => live && setNames(found.filter(Boolean)));
    return () => { live = false; };
  }, []);
  return (
    <div style={{ height: "100svh", display: "flex", flexDirection: "column", gap: 8, padding: 16, boxSizing: "border-box", colorScheme: dark ? "dark" : "light", background: dark ? "#07080a" : "#f1f3f5", color: dark ? "#f3f5f7" : "#0a0b0d", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <OrganPicker names={names} value={name} onChange={setName} />
        <button type="button" onClick={() => setDark(!dark)} style={{ flex: "none", font: "inherit", color: "inherit", background: "none", border: "1px solid color-mix(in srgb,currentColor 25%,transparent)", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>
          {dark ? "Light" : "Dark"}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Organ name={name} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
