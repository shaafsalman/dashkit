import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { FolderOpen, Moon, Sun } from "lucide-react";
import { ScanViewer } from "../src/scan/index.js";

const SAMPLES = [
  { id: "ct", label: "CT, chest to thighs (112 slices)", image: "/scans/example/ct.nii.gz", segmentation: "/scans/example/seg.nii.gz" },
  { id: "ct_crop", label: "CT, upper abdomen crop (30 slices)", image: "/scans/example/ct_crop.nii.gz", segmentation: "/scans/example/seg_crop.nii.gz" },
  { id: "mr", label: "MR, abdomen crop (20 slices)", image: "/scans/example/mr.nii.gz", segmentation: "/scans/example/seg_mr.nii.gz" },
];

const params = new URLSearchParams(location.search);

// A label map is a whole-number image, and a segmentation file is usually named as one. Good enough to sort two dropped files.
const looksLikeSegmentation = (file) => /seg|label|mask|pred/i.test(file.name);

function App() {
  const [dark, setDark] = useState(params.get("theme") !== "light");
  const [sampleId, setSampleId] = useState(params.get("sample") ?? "ct");
  const [opened, setOpened] = useState(null);
  const input = useRef(null);
  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0];
  const embed = params.has("embed");

  const open = (files) => {
    const list = [...files];
    const json = list.find((f) => f.name.endsWith(".json"));
    const volumes = list.filter((f) => f !== json);
    if (!volumes.length) return;
    const seg = volumes.length > 1 ? volumes.find(looksLikeSegmentation) ?? volumes[1] : null;
    const image = volumes.find((f) => f !== seg);
    const apply = (labels) => setOpened({ image, segmentation: seg, labels, name: image.name });
    if (json) json.text().then((t) => apply(JSON.parse(t)));
    else apply(undefined);
  };

  const viewer = (
    <ScanViewer
      image={opened ? opened.image : sample.image}
      segmentation={opened ? opened.segmentation : sample.segmentation}
      labels={opened?.labels}
    />
  );

  return (
    <div style={{ minHeight: "100svh", height: embed ? "auto" : "100svh", display: "flex", flexDirection: "column", gap: 8, padding: 10, boxSizing: "border-box", colorScheme: dark ? "dark" : "light", background: dark ? "#08090b" : "#f3f4f6", color: dark ? "#eef0f3" : "#111317", fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
        <select value={opened ? "" : sampleId} onChange={(e) => { setOpened(null); setSampleId(e.target.value); }} aria-label="Sample scan" style={{ font: "inherit", color: "inherit", background: "color-mix(in srgb,currentColor 7%,transparent)", border: 0, borderRadius: 8, height: 28, padding: "0 8px" }}>
          {opened && <option value="">{opened.name}</option>}
          {SAMPLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => input.current?.click()} style={chrome} title="Open a NIfTI scan, its label map, and optionally a labels JSON such as nnU-Net's dataset.json">
          <FolderOpen size={14} aria-hidden="true" /> Open files
        </button>
        <input ref={input} type="file" multiple accept=".nii,.gz,.json,.mgz,.nrrd" hidden onChange={(e) => open(e.target.files)} />
        <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.55 }}>Test scans from TotalSegmentator (Apache-2.0). NiiVue (BSD-2-Clause). 3 mm voxels.</span>
        <button type="button" onClick={() => setDark(!dark)} style={chrome} aria-label={dark ? "Light theme" : "Dark theme"}>
          {dark ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
        </button>
      </div>
      {embed ? (
        <>
          <p style={{ margin: 0, height: "200vh", opacity: 0.6 }}>Tall page above the viewer, to check lazy loading and scrolling past it.</p>
          <div style={{ height: "70vh" }}>{viewer}</div>
          <p style={{ margin: 0, height: "200vh", opacity: 0.6 }}>Tall page below the viewer.</p>
        </>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>{viewer}</div>
      )}
    </div>
  );
}

const chrome = { font: "inherit", color: "inherit", display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 8px", background: "color-mix(in srgb,currentColor 7%,transparent)", border: 0, borderRadius: 8, cursor: "pointer" };

createRoot(document.getElementById("root")).render(params.has("strict") ? <StrictMode><App /></StrictMode> : <App />);
