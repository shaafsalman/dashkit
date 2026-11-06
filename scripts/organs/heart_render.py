"""Cycles renders of the built heart for checking it by eye: the whole from every side and close crops.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/organs/heart_render.py -- <model.raw.glb> <out prefix> [views] [hide]

views: comma-separated names (front, back, left, right, top, three) or name@zoom@x,y,z for a close crop centred on a model-space point.
hide: comma-separated part ids to leave out, so one part can be seen alone or a layer peeled."""
import math, sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
glb, prefix = argv[0], argv[1]
views = (argv[2] if len(argv) > 2 else "front,back,left,right,top,three").split(",")
hide = set((argv[3] if len(argv) > 3 else "").split(",")) - {""}
only = set((argv[4] if len(argv) > 4 else "").split(",")) - {""}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
for o in list(bpy.data.objects):
    if o.type != "MESH":
        continue
    name = o.name.split(".")[0]
    if name in hide or (only and name not in only):
        bpy.data.objects.remove(o, do_unlink=True)
        continue
    for slot in o.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if b is None:
            continue
        if not b.inputs["Base Color"].is_linked and o.data.color_attributes:
            # Parts drawn with vertex colour (the coronary vessels, the chordae): wire the colour in, as the viewer does.
            attr = m.node_tree.nodes.new("ShaderNodeVertexColor")
            attr.layer_name = o.data.color_attributes[0].name
            m.node_tree.links.new(attr.outputs["Color"], b.inputs["Base Color"])
        # The wet film the viewer adds: a sharp clear coat over the tissue.
        b.inputs["Coat Weight"].default_value = 0.55
        b.inputs["Coat Roughness"].default_value = 0.07
        b.inputs["Subsurface Weight"].default_value = 0.12
        b.inputs["Subsurface Radius"].default_value = (1.0, 0.25, 0.15)
        b.inputs["Subsurface Scale"].default_value = 0.01

scene = bpy.context.scene
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.get_devices()
for d in prefs.devices:
    d.use = True
scene.render.engine = "CYCLES"
scene.cycles.device = "GPU"
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
scene.render.resolution_x = scene.render.resolution_y = 1100
scene.render.film_transparent = False
scene.render.image_settings.file_format = "PNG"
# The viewer tone-maps with Khronos PBR Neutral, which keeps saturated reds; so does this.
try:
    scene.view_settings.view_transform = "Khronos PBR Neutral"
except TypeError:
    scene.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("studio")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.92, 0.93, 0.95, 1)
bg.inputs["Strength"].default_value = 0.35
scene.world = world
for name, loc, size, power, colour in [
    ("key", (-3.0, -4.4, 3.6), 3.0, 900, (1, 0.97, 0.93)),
    ("fill", (4.5, -3.0, 0.2), 5.0, 260, (0.88, 0.92, 1)),
    ("rim", (2.0, 4.6, 2.6), 2.5, 900, (1, 0.96, 0.92)),
    ("under", (-1.5, -2.5, -4.0), 4.0, 140, (1, 0.9, 0.86)),
    ("top", (0.5, 0.5, 6.0), 3.0, 300, (1, 1, 1)),
]:
    light = bpy.data.lights.new(name, "AREA")
    light.size, light.energy, light.color = size, power, colour
    lo = bpy.data.objects.new(name, light)
    scene.collection.objects.link(lo)
    lo.location = loc
    lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
cam = bpy.data.cameras.new("cam")
cam.sensor_width = 36
co = bpy.data.objects.new("cam", cam)
scene.collection.objects.link(co)
scene.camera = co
# Web model space (Y up, +Z front) into Blender's (Z up, -Y front).
DIRS = {"front": (0, -1, 0.05), "back": (0, 1, 0.05), "left": (1, 0, 0.05), "right": (-1, 0, 0.05), "top": (0, -0.02, 1), "bottom": (0, -0.02, -1), "three": (0.55, -0.8, 0.2), "three_back": (-0.6, 0.8, 0.2)}
for v in views:
    bits = v.split("@")
    d = Vector(DIRS[bits[0]]).normalized()
    zoom = float(bits[1]) if len(bits) > 1 else 1.0
    t = Vector((0, 0, 0))
    if len(bits) > 2:
        x, y, z = (float(a) for a in bits[2].split(";"))
        t = Vector((x, -z, y))
    co.location = t + d * 6.3
    # Look along -d with world Z (the model's up) kept up on screen.
    fwd = -d
    up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((0, 1, 0))
    right = fwd.cross(up).normalized()
    upv = right.cross(fwd).normalized()
    from mathutils import Matrix

    co.matrix_world = Matrix((
        (right.x, upv.x, -fwd.x, co.location.x),
        (right.y, upv.y, -fwd.y, co.location.y),
        (right.z, upv.z, -fwd.z, co.location.z),
        (0, 0, 0, 1),
    ))
    cam.angle = 2 * math.atan(math.tan(math.radians(23.9) / 2) / zoom)
    scene.render.filepath = f"{prefix}_{v.replace('@', '_').replace(';', '_')}.png"
    bpy.ops.render.render(write_still=True)
print("RENDERED", len(views))
