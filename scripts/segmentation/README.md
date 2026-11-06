# Imported cases: from a segmentation tool to `<Organ>`

`import_segmentation.py` turns the output of a medical segmentation tool into the organ library's model format, so that this shows a real scan:

```jsx
<Organ name="case1" baseUrl="/cases" />
```

Every structure becomes a clickable part with a label, a line of general anatomy, its group, its layer and its volume in millilitres. Anatomy, X-ray, Segments, Slice, Break apart and Layers work as they do for the atlas organs. There is no Flow view, because a segmentation holds no flow.

**None of this is a medical device, and a case made with it must not be used for diagnosis or treatment.** See [Not a medical device](#not-a-medical-device).

## Running it

```sh
python3.12 -m venv ~/venvs/seg            # keep it out of the repo
~/venvs/seg/bin/pip install -r scripts/segmentation/requirements.txt

# From the dashkit root. Writes assets/cases/case1/{model.glb,manifest.json}
~/venvs/seg/bin/python scripts/segmentation/import_segmentation.py path/to/segmentations --name case1 \
    --title "Case 1" --source-credit "Where the scan came from, with its licence"

~/venvs/seg/bin/python scripts/segmentation/test_import.py    # the checks against shapes of known volume
```

Compression uses `scripts/organs/compress.sh`, so `npx` must be available. `--poster 1024` also renders `poster.webp` with Blender (set `BLENDER` if it is not in `/Applications`, and `POSTER_CPU=1` when other renders hold the GPU).

| Input | How to pass it | Where the names come from |
| --- | --- | --- |
| A folder of per-class masks (TotalSegmentator's default) | `seg/` | The file names. `statistics.json` beside them is read too. A dataset folder with `segmentations/` inside also works. |
| One multilabel file (TotalSegmentator's `--ml`) | `seg.nii.gz` | The label table inside the file. With no table, `--task total` or `--task total_mr`. |
| A label map from nnU-Net, a MONAI bundle or anything else | `pred.nii.gz --labels x.json` | nnU-Net's `dataset.json` (v1 and v2, regions too), a bundle's `metadata.json` (`channel_def`) or `label_dict.json`, `{"liver": 1}`, `{"1": "liver"}` or `[{"id": 1, "name": "liver"}]`. |
| A 3D Slicer segmentation | `x.seg.nrrd` | The file's own segment names. One or several layers, so overlapping segments work. |

A label with no name still becomes a part, called `label_7`. A class with no table entry still works: its kind and group are guessed from the words in its name, with `deep` as the generic kind. A labels JSON can set any part's wording and look: `{"3": {"name": "tumour", "kind": "coral", "group": "organs", "about": "...", "glass": 0.4}}`.

Useful options: `--skip skull,brain`, `--only liver,spleen`, `--add skin.nii.gz` (a mask from another run on the same grid), `--budget` (triangles for the whole case, default 420,000), `--min-ml`, `--pins`. `python import_segmentation.py --help` has the rest.

## From a CT to the page, for real

```sh
pip install TotalSegmentator       # about 1.7 GB with torch; a venv of its own keeps it apart from the importer
export TOTALSEG_HOME_DIR=/somewhere/.totalsegmentator    # weights go here; the --fast model is 135 MB
# It sends anonymous usage statistics unless send_usage_stats is false in that folder's config.json.
TotalSegmentator -i ct.nii.gz -o seg --fast --statistics --device mps
python scripts/segmentation/import_segmentation.py seg --name mycase --source-credit "..."
```

Measured on an M4 with 16 GB while other heavy jobs ran: 2.5 minutes including the weights download for a 122 × 101 × 112 image, 3.8 minutes for 269 × 269 × 447, and 1 minute for `-ta body --fast` on the same. The 1.5 mm model, without `--fast`, was not tried. On CPU its README says to use `--fast` or `--roi_subset`.

## What is measured and what is not

| | |
| --- | --- |
| **Shape** | From the segmentation. Surfaces are smoothed, and the tests check that each still encloses its voxels' volume to within a few per cent. |
| **Size and proportions** | Real. One uniform scale fits the longest side to 2 units. `source.mmPerUnit` in the manifest gives that scale. |
| **Volume** | Voxel count × voxel volume, not the mesh. It matched TotalSegmentator's own `statistics.json` exactly wherever that file reported a volume. |
| **Left, right, front, back** | From the file's affine. If the file records no orientation, the importer warns and `source.orientationRecorded` is false. |
| **Label accuracy** | Whatever the tool got right. Nothing here checks it. |
| **Colour, gloss, shadow** | Illustration. The credit says so. The tones are `MATERIALS` from `scripts/organs/build.py`, read at run time. |
| **Descriptions** | General anatomy, never about this person. |

A structure that touches the edge of the image may go on outside it. Its `measure` then reads "Volume in scan (cut off)", "at least 1,420 mL", its description says which edge, and `stats.cutAt` lists the edges. TotalSegmentator by default reports zero in `statistics.json` for such structures. That is kept as `stats.toolSaysIncomplete`, and the volume from the voxels is still shown.

Orientation works like this. An affine always leads to RAS+ world space, however the voxels are stored. RAS+ then maps to the model as X = −right, Y = top, Z = front, so the patient faces the Front button and their right is on the viewer's left, as in an anatomy atlas. This is a rotation, not a mirror. A mirroring affine, such as the common LAS order, would turn the triangles inside out, so each surface's signed volume is checked and its winding flipped if needed.

Extra manifest keys beyond the contract: `stats` on each part (`ml`, `voxels`, `toolMl`, `intensity`, `cutAt`) and `source` at the top (format, grid, spacing, `mmPerUnit`, and which classes were empty or too small to shape).

### Layers

`layers` runs outermost first: Skin (only with `--add skin.nii.gz`), Muscles, Skeleton, Lungs and airway, Digestive tract, Organs, Heart and vessels, Brain and spinal cord. Vessels come late on purpose. In a torso the aorta and vena cava lie behind the organs, so peeling them early would remove almost nothing visible, and peeling the bowel and organs first lays them bare. The table is `LAYERS` in `classes.py`.

## What has been tested, and on what

- **Synthetic** (`test_import.py`): ellipsoids of known volume. Measured volume within 1.5% (5% for very small shapes, where counting voxels has a real error), and smoothed surface within 4% of its voxels. The same patient stored as RAS, LPS, LAS, PIR, ASL, RSP, on an oblique grid and in 1.5 × 1.5 × 5 mm voxels lands in the same place. Also: cut-off detection, each labels JSON form, region labels, one-channel-per-class files, `.seg.nrrd` in one and two layers, and the embedded label table.
- **Real, TotalSegmentator's test files**: `example_seg_fast/` (folder), `example_seg.nii.gz`, `example_seg_fast.nii.gz` and `example_seg_roi_subset.nii.gz` (multilabel, RAS), and `example_seg_mr.nii.gz` (multilabel, stored LPS). Checked by anatomy: liver on the patient's right, spleen on the left, aorta in front of the spine. These crops are small: `example_seg` is 90 mm of upper abdomen at 3 mm.
- **Real, a TotalSegmentator run on this machine**: `example_ct.nii.gz` with `--fast`, which is `assets/cases/example-fast`. It covers the lung bases to the top of the thighs at 3 mm, not a whole body.
- **Real, a torso**: subject s0461 of the TotalSegmentator dataset v2.0.1 (Zenodo 10047263, CC BY 4.0), 1.5 mm, neck to upper thigh, 109 structures, which is `assets/cases/case1`. It is a training-set subject, so the agreement of our `--fast` run with its labels (Dice 0.82 to 0.98 on 15 structures, volumes within 4%) shows the path works and says nothing about the tool's accuracy on new scans.
- **Real, 3D Slicer**: `Segmentation.seg.nrrd` and `SegmentationOverlapping.seg.nrrd` from the [slicerio](https://github.com/lassoan/slicerio) repository (MIT), which Slicer wrote.
- **Not tested**: output from an actual nnU-Net or MONAI run. Their label files were tested from the documented formats, with synthetic images.

## Other tools, and how they reach this importer

Licences were read from each repository on 2026-11-06. They can change, and this is not legal advice. Check again before shipping anything.

| Tool | What it is for | Commercial use | Route into the importer |
| --- | --- | --- | --- |
| **[TotalSegmentator](https://github.com/wasserth/TotalSegmentator)** | Automatic CT and MR segmentation of 117 and 50 structures, plus many subtasks. | Code and the open tasks: yes, Apache-2.0. Others need a licence (below). | Folder or `--ml`. Tested. |
| **[nnU-Net](https://github.com/MIC-DKFZ/nnUNet)** | A framework that configures and trains a segmentation model for your own dataset. | Code: yes, Apache-2.0. A trained model also carries the terms of its training data. | `nnUNetv2_predict` writes label maps; pass the model's `dataset.json` as `--labels`. |
| **[MONAI](https://github.com/Project-MONAI/MONAI)** | The PyTorch framework for medical imaging. | Code: yes, Apache-2.0. | Save a label map, with `--labels` naming the classes. |
| **[MONAI Model Zoo](https://github.com/Project-MONAI/model-zoo)** | Ready-made bundles of model and config. | Bundle by bundle. The repository is Apache-2.0, but its README says each bundle's own licence applies, and some are non-commercial. | `--labels metadata.json` |
| **[VISTA3D](https://github.com/Project-MONAI/VISTA)** | A CT model with 132 classes, automatic and point-click. | Depends on which weights. Code: Apache-2.0. NVIDIA's `NV-Segment-CT` weights: NVIDIA Open Model License, which NVIDIA calls commercial friendly. `NV-Segment-CTMR` weights: non-commercial. The `vista3d` bundle in the Model Zoo: its weights licence limits use to non-commercial. | `--labels label_dict.json` |
| **[MedSAM](https://github.com/bowang-lab/MedSAM)**, **[MedSAM2](https://github.com/bowang-lab/MedSAM2)** | Prompted segmentation: you draw a box. Slice by slice for MedSAM, 3D and video for MedSAM2. | Code: Apache-2.0. MedSAM's README names no licence for its checkpoint, so treat it as not cleared. MedSAM2's weights on Hugging Face are tagged CC-BY-SA-4.0: attribution and share-alike. | One mask at a time. Save as NIfTI on the scan's grid, then a label map with `--labels`. |
| **[SAM-Med3D](https://github.com/uni-medical/SAM-Med3D)** | Prompted 3D segmentation from a few points. | Project: Apache-2.0. The checkpoint page carries no licence of its own, so ask before shipping its output in a product. | Writes `.nii.gz`; label map with `--labels`. |
| **[3D Slicer](https://github.com/Slicer/Slicer)** | Desktop app for viewing scans and for editing segmentations by hand. Often the best way to fix a tool's mistakes before importing. | Its own BSD-style licence allows it, at your own risk, and extensions have their own licences. | `.seg.nrrd`. Tested on files Slicer wrote. [SlicerTotalSegmentator](https://github.com/lassoan/SlicerTotalSegmentator) runs TotalSegmentator inside it. |
| **[NiiVue](https://github.com/niivue/niivue)** | Browser viewer for the scan itself: slices and volumes, label overlays, meshes. | Yes, BSD-2-Clause. | Not a segmenter. It could sit beside `<Organ>` to show the real CT slices. Its `saveImage` can write a drawn mask as NIfTI, which would go in as a label map. Not tried. |
| **[Cornerstone3D](https://github.com/cornerstonejs/cornerstone3D)** | Radiology viewer toolkit for the browser, DICOMweb first, with segmentation tools. | Yes, MIT. | The same: for showing DICOM. Its adapters work with DICOM SEG, which this importer does not read, so a mask would need converting to NIfTI first. Not tried. |
| **[vtk.js](https://github.com/Kitware/vtk-js)** | A rendering library for volumes and geometry. | Yes, BSD-3-Clause. | None of its own; lower level than the two above. Not tried. |

**TotalSegmentator's tasks.** Open under Apache-2.0: `total`, `total_mr`, `body`, `body_mr`, `lung_vessels`, `liver_vessels`, `liver_segments`, `vertebrae_mr`, `vertebrae_body`, `vertebrae_pp`, `kidney_cysts`, `lung_nodules`, `breasts`, `trunk_cavities`, `abdominal_muscles`, `head_glands_cavities`, `head_muscles`, `headneck_muscles`, `headneck_bones_vessels`, `teeth`, `craniofacial_structures`, `ventricle_parts`, `pleural_pericard_effusion`, `cerebral_bleed`, `hip_implant` and others. Several of these ask for a paper to be cited. Licence needed (free for non-commercial use, otherwise ask the author): `heartchambers_highres`, `coronary_arteries`, `appendicular_bones`, `tissue_types`, `tissue_4_types`, `brain_structures`, `face`, `thigh_shoulder_muscles`, `aortic_sinuses`, and also `renal_arteries`, `aorta_annulus`, `aortic_dissection` and `pulmonary_artery_landmarks` in the code's `commercial_models` table. `brain_aneurysm` is CC BY-NC 4.0 with no commercial licence available. The class list in `classes.py` is pinned to a commit of `map_to_binary.py`, so check that file when moving to a new version.

## Not a medical device

TotalSegmentator's own README says: "This is not a medical device and is not intended for clinical usage." It adds that the tool is a certified component of some FDA-approved products, which says nothing about using it on its own or through this importer. 3D Slicer's licence says it was designed for research and has not been reviewed by the FDA, and the MONAI Model Zoo makes no claim that any model suits diagnostic or therapeutic use. Treat every other tool here the same way: none of them is a medical device unless that specific product says so, and a page built from them is not one either. The manifest's `credit` carries this, so keep it visible wherever a case is shown.

## Patient data

Only import scans you have the right to use, and keep them out of this repository. Only the derived model and manifest belong in `assets/cases/`. Removing names from a scan does not make it anonymous: a surface rebuilt from a CT of the head can show a recognisable face, so use `--skip skull,skin` or do not import head scans at all. `case1` runs from the neck down.

## Files

`import_segmentation.py` is the importer, `classes.py` the class maps and the table of 117+ structures, `poster.py` the optional Blender still, `test_import.py` the checks.
