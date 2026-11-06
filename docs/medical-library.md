# Medical library

Three things for React apps: interactive 3D organs, a real scan viewer, and 2D images for decoration. Everything fills the box you give it and takes its colours from the surrounding text colour, so it works in light and dark.

Copy `assets/` somewhere your app serves it, and point `baseUrl` at it. `three` and the viewers load only when they near the screen.

## 3D organs

```jsx
import { Organ } from "dashkit/src/organs";

<div style={{ height: 640 }}>
  <Organ name="heart" baseUrl="/organs" />
</div>
```

Models: `heart`, `lungs`, `liver`, `kidney`. Each part is a separate, named, clickable piece.

- **Views:** Anatomy, X-ray, Segments (a colour per part, with legend) and Flow (blood or air moving along the routes, with in and out labels).
- **Break down:** click a part and its group splits apart while the rest turns to glass. Peel away layers. Search parts. Isolate one.
- **Slice:** axial, coronal or sagittal, like a scan.
- **Colour:** Natural, Ocean, Ember, Hologram and High contrast.
- **Motion:** still by default. The Pulse button starts the heartbeat or breathing.

| Prop | Default | |
|---|---|---|
| `name`, `baseUrl` | `"/organs"` | Which model, and where assets are served |
| `view` / `defaultView` | `"anatomy"` | `anatomy`, `xray`, `segments`, `flow` |
| `palette` / `defaultPalette` | `"natural"` | Colour option |
| `defaultPulse` | `false` | Start beating or breathing |
| `autoRotate` | `false` | Turn slowly until touched |
| `annotations` | | Cards pinned to parts: `[{ part, label, value, tone }]`. The numbers are yours; the library invents none |
| `panel`, `decorative` | `true`, `false` | Hide the side panel; or remove all interface, for a live hero |
| `onSelect`, `onViewChange`, `onPaletteChange`, `onPeelChange` | | Callbacks |

For a custom layout, compose the pieces inside `<Organ.Provider>`, or read state with `useOrgan()`.

## A real patient's segmentation in 3D

`scripts/segmentation/import_segmentation.py` turns the output of TotalSegmentator, nnU-Net, MONAI or any NIfTI label map into the same model format, with measured volumes. See [its README](../scripts/segmentation/README.md).

```jsx
<Organ name="case1" baseUrl="/cases" />
```

## Scan viewer

CT or MR slices in the browser with the segmentation over them: axial, coronal, sagittal and 3D, windowing presets, a legend with volumes, and a readout under the pointer. Install the optional peer `@niivue/niivue`.

```jsx
import { ScanViewer } from "dashkit/src/scan";

<ScanViewer image="/scans/example/ct.nii.gz" segmentation="/scans/example/seg.nii.gz" />
```

## 2D images

```jsx
import { MedicalImage } from "dashkit/src/images";

<MedicalImage name="lungs" base="/images" />   {/* switches to the dark version with the system theme */}
<MedicalImage name="bust" theme="dark" />
```

Names: `lungs`, `bust` (each with a dark version), `lungs-vivid`, `lungs-realistic`, `bust-left`, `bust-realistic`. They are 896×1200 or 1200×896 on a solid background.

## Run the playground

```sh
npm install
(cd demo && npm install)
(cd organs-playground && npm install)
npm run organs
```

Then open http://localhost:5199/ for the organs and http://localhost:5199/scan.html for the scan viewer.

## Rebuilding models

Needs [Blender](https://www.blender.org/) 5 and the source models named in [NOTICE.md](../NOTICE.md). Scripts are in `scripts/organs/`.

## Known limits

- Liver and kidney are early builds: colour lives at the vertices, so they soften when zoomed in close, and their manifests have no `layers` yet (the viewer falls back to groups).
- The lungs model has one stray vessel fragment below the lungs.
- Texture maps are supported in the viewer's code but are not yet proven on a shipped model.
- Tested on desktop browsers on an Apple Silicon Mac. Phones and other hardware are not fully tested.

Licences and attribution: [NOTICE.md](../NOTICE.md). Not a medical device.
