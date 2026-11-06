# Licences and attribution

Dashkit's code is under the [MIT License](LICENSE). The anatomy data, images and sample scans under `assets/` keep their own licences, listed here. Keep this
file with them, and credit the sources wherever your product lists its sources.

| What | Source | Licence |
|---|---|---|
| `assets/organs/heart` | [BodyParts3D 4.0](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html), © The Database Center for Life Science, read through the [Human Atlas](https://github.com/ashemag/human-atlas) packing. Publication: Mitsuhashi et al. (2009), [doi:10.1093/nar/gkn613](https://doi.org/10.1093/nar/gkn613) | [CC BY 4.0](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html) |
| `assets/organs/lungs` | [HRA 3D Reference Object Library](https://github.com/hubmapconsortium/ccf-releases), HuBMAP, from NLM Visible Human data, with BodyParts3D vessels | CC BY 4.0 |
| `assets/organs/liver`, `assets/organs/kidney` | HRA 3D Reference Object Library, HuBMAP, from NLM Visible Human data | CC BY 4.0 |
| `assets/cases/case1` | [TotalSegmentator training dataset v2.0.1](https://zenodo.org/records/10047263), subject s0461, Wasserthal et al. | CC BY 4.0 |
| `assets/scans/example` | Test scans from [TotalSegmentator](https://github.com/wasserth/TotalSegmentator), `tests/reference_files`, downsampled | Apache-2.0 (the repository's licence) |
| `assets/images` | Generated with Google Gemini through Antigravity, from written prompts | See below |

All of these were adapted: remeshed, smoothed, coloured and reduced for the browser. Each model's `manifest.json` carries its own `credit` line, which the viewer shows.
Colour, surface, the finest vessels and the blood flow are illustration, not measurement.

**Code ideas.** `src/organs/scene.js` takes its per-part GPU state texture from Human Atlas, © its authors, under the MIT License.

**AI images.** `assets/images` were generated from text descriptions, with no third-party image given to the generator. They were made in the style of designs we admired, so
check them against your own legal and brand requirements before commercial use. Their copyright status varies by country, and they carry Google's SynthID watermark. Illustration only.

## Not a medical device

Nothing in this library is a medical device. It is not for diagnosis or treatment. Anatomy text is general orientation, and reference models and sample scans do not represent any patient you are treating.
TotalSegmentator's `total` task is Apache-2.0; other tasks may need a licence from its authors. See [scripts/segmentation/README.md](scripts/segmentation/README.md).
