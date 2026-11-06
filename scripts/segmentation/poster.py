"""
A still of an imported case for <Organ>'s poster, with the same camera and lights as the organ library, so that the page opens on a picture while three loads.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/segmentation/poster.py -- <model.raw.glb> <manifest.json> <poster.webp> [size] [samples]

import_segmentation.py runs this for you, before it compresses the model. Set VIEW=back or VIEW=side to look from elsewhere while checking a case.
"""
import json, math, os, sys
import bpy

here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(here, "..", "organs"))
from build import stage  # The camera and lights live there. Only read.

argv = sys.argv[sys.argv.index("--") + 1 :]
glb, manifest_path, out = argv[:3]
size = int(argv[3]) if len(argv) > 3 else 1024
samples = int(argv[4]) if len(argv) > 4 else 64
manifest = json.load(open(manifest_path))
glass = {p["id"]: p.get("glass", 0) for p in manifest["parts"]}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
scene = bpy.context.scene
stage(scene, size, samples)
if os.environ.get("POSTER_CPU"):  # When other renders hold the GPU, a poster on the CPU still finishes.
    scene.cycles.device = "CPU"


def material_for(amount):
    mat = bpy.data.materials.new(f"case_{amount}")
    mat.use_nodes = True
    n, l = mat.node_tree.nodes, mat.node_tree.links
    b = n["Principled BSDF"]
    col = n.new("ShaderNodeVertexColor")
    col.layer_name = "Color"
    l.new(col.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.36
    b.inputs["Coat Weight"].default_value = 0.5
    b.inputs["Coat Roughness"].default_value = 0.26
    if amount:
        b.inputs["Alpha"].default_value = max(0.06, 1 - amount * 0.75)
    return mat


made = {}
for o in scene.objects:
    if o.type != "MESH":
        continue
    amount = glass.get(o.name, glass.get(o.name.split(".")[0], 0)) or 0
    mat = made.setdefault(amount, material_for(amount))
    o.data.materials.clear()
    o.data.materials.append(mat)
    for poly in o.data.polygons:
        poly.use_smooth = True

view = os.environ.get("VIEW")
if view:
    cam = scene.camera
    if view == "back":
        cam.location, cam.rotation_euler = (0, 6.3, 0.3), (math.radians(87.3), 0, math.radians(180))
    elif view == "side":  # Standing at the patient's left.
        cam.location, cam.rotation_euler = (6.3, 0, 0.3), (math.radians(87.3), 0, math.radians(90))
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print(f"POSTER {out}", flush=True)
