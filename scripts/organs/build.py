"""
The organ library's builder (src/organs). Turns Human Reference Atlas models into one web-ready 3D model per organ, with every
anatomical part a separate named piece that a page can click, pull apart and isolate, its colour and shadow baked in.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/organs/build.py -- \
      --organ heart --src <folder of .glb sources> --out assets/organs [--poster-size 1024] [--samples 96]

Writes <out>/<organ>/model.raw.glb, manifest.json and poster.webp; scripts/organs/compress.sh then writes model.glb.
The shapes and part names are the atlas's. Colour, gloss and the fine surface vessels are illustration, not anatomy.
"""
import argparse, json, math, os, random, sys, time
import bmesh, bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from presets import PRESETS

MATERIALS = {
    # colours dark to light, how strongly crevices darken, fine relief
    "muscle": dict(tones=[(0.2, 0.012, 0.016), (0.42, 0.028, 0.03), (0.62, 0.06, 0.05)], crevice=0.75),
    "artery": dict(tones=[(0.3, 0.018, 0.02), (0.5, 0.035, 0.03), (0.72, 0.075, 0.055)], crevice=0.5),
    "pulmonary": dict(tones=[(0.03, 0.05, 0.2), (0.06, 0.1, 0.36), (0.14, 0.2, 0.56)], crevice=0.5),
    "coronary": dict(tones=[(0.5, 0.2, 0.05), (0.72, 0.36, 0.1), (0.88, 0.56, 0.22)], crevice=0.3),
    "vein": dict(tones=[(0.04, 0.05, 0.2), (0.08, 0.1, 0.34), (0.16, 0.18, 0.5)], crevice=0.3),
    "valve": dict(tones=[(0.62, 0.42, 0.36), (0.78, 0.6, 0.52), (0.92, 0.8, 0.72)], crevice=0.5),
    "lung": dict(tones=[(0.03, 0.14, 0.34), (0.06, 0.28, 0.58), (0.2, 0.52, 0.82)], crevice=0.5),
    "coral": dict(tones=[(0.5, 0.09, 0.05), (0.72, 0.2, 0.1), (0.88, 0.38, 0.22)], crevice=0.3),
    "airway": dict(tones=[(0.55, 0.2, 0.17), (0.72, 0.34, 0.28), (0.86, 0.52, 0.44)], crevice=0.6),
    "cartilage": dict(tones=[(0.62, 0.55, 0.46), (0.78, 0.72, 0.62), (0.9, 0.86, 0.78)], crevice=0.5),
    "liver": dict(tones=[(0.16, 0.022, 0.016), (0.3, 0.05, 0.03), (0.44, 0.1, 0.06)], crevice=0.7),
    "capsule": dict(tones=[(0.4, 0.14, 0.1), (0.5, 0.2, 0.15), (0.6, 0.28, 0.22)], crevice=0.1),
    "kidney": dict(tones=[(0.2, 0.03, 0.022), (0.36, 0.07, 0.045), (0.52, 0.14, 0.09)], crevice=0.6),
    "pyramid": dict(tones=[(0.12, 0.012, 0.02), (0.24, 0.03, 0.04), (0.38, 0.07, 0.07)], crevice=0.6),
    "brain": dict(tones=[(0.42, 0.21, 0.2), (0.62, 0.36, 0.34), (0.8, 0.54, 0.5)], crevice=0.85),
    "deep": dict(tones=[(0.36, 0.25, 0.42), (0.5, 0.38, 0.55), (0.66, 0.54, 0.7)], crevice=0.5),
    "fluid": dict(tones=[(0.1, 0.3, 0.55), (0.2, 0.46, 0.72), (0.4, 0.65, 0.86)], crevice=0.2),
}
MAX_FACES = 60000  # per part, so one organ stays a few megabytes


def args():
    p = argparse.ArgumentParser()
    p.add_argument("--organ", required=True, choices=PRESETS)
    p.add_argument("--src", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--poster-size", type=int, default=1024)
    p.add_argument("--samples", type=int, default=96)
    return p.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def bounds(objs):
    pts = [v.co for o in objs for v in o.data.vertices]
    return Vector(min(p[i] for p in pts) for i in range(3)), Vector(max(p[i] for p in pts) for i in range(3))


def centre_of(o):
    pts = [v.co for v in o.data.vertices]
    return sum(pts, Vector()) / max(1, len(pts))


def load(folder, preset):
    """Imports the sources and gathers each part's meshes, all baked into one shared space."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sources = {}
    for name in {p["src"] for p in preset["parts"]}:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(folder, name))
        new = [o for o in bpy.data.objects if o not in before]
        for o in new:
            if o.type == "MESH":
                o.data = o.data.copy()
                o.data.transform(o.matrix_world)
                o.parent = None
                o.matrix_world.identity()
        sources[name] = [o for o in new if o.type == "MESH"]
    marks = {o.name: centre_of(o) for meshes in sources.values() for o in meshes if len(o.data.vertices)}
    used, out, used_names = set(), [], set()
    for p in preset["parts"]:
        meshes = [o for o in sources[p["src"]] if any(k in o.name for k in p["only"]) and o not in used and o.name not in used_names and not any(k in o.name for k in p.get("skip", []))]
        if not meshes:
            raise SystemExit(f"no meshes for part {p['id']}")
        used |= set(meshes)
        out.append((p, meshes))
    for o in [o for o in bpy.data.objects if o not in used]:
        bpy.data.objects.remove(o, do_unlink=True)
    return out, marks


def clip(o, lo, hi):
    """Cuts a great vessel off at a box around the organ, leaving it open like a cut vessel."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for axis in range(3):
        for value, sign in ((lo[axis], -1), (hi[axis], 1)):
            normal, point = Vector((0, 0, 0)), Vector((0, 0, 0))
            normal[axis], point[axis] = sign, value
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=point, plane_no=normal, clear_outer=True)
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()


def assemble(preset, gathered, marks):
    """Clips the vessels to a box around the core, centres the organ at a height of 2, then builds each part."""
    if any(p.get("clip") for p, _ in gathered):
        core = [o for p, meshes in gathered if p["group"] == preset["core_group"] for o in meshes]
        lo, hi = bounds(core)
        size = hi - lo
        box_lo = lo - Vector((size.x * 0.2, size.y * 0.2, size.z * 0.1))
        box_hi = hi + Vector((size.x * 0.2, size.y * 0.2, size.z * 0.5))
        for p, meshes in gathered:
            if p.get("clip"):
                for o in meshes:
                    clip(o, box_lo, box_hi)
                    if len(o.data.vertices):
                        marks[o.name] = centre_of(o)
    everything = [o for _, meshes in gathered for o in meshes if len(o.data.vertices)]
    a, b = bounds(everything)
    fit = Matrix.Rotation(math.radians(preset.get("yaw", 0)), 4, "Z") @ Matrix.Scale(2 / max(b - a), 4) @ Matrix.Translation(-(a + b) / 2)
    for k in marks:
        marks[k] = fit @ marks[k]
    built = {}
    for p, meshes in gathered:
        meshes = [o for o in meshes if len(o.data.vertices)]
        for o in meshes:
            o.data.transform(fit)
        bpy.ops.object.select_all(action="DESELECT")
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        if len(meshes) > 1:
            bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active
        o.name = o.data.name = p["id"]
        # Solid parts are rebuilt as one clean surface. Thin-walled vessels would break up, so they keep their own.
        if p.get("voxel"):
            m = o.modifiers.new("shell", "REMESH")
            m.mode, m.voxel_size = "VOXEL", p["voxel"]
            bpy.ops.object.modifier_apply(modifier=m.name)
            m = o.modifiers.new("soft", "LAPLACIANSMOOTH")
            m.iterations, m.lambda_factor, m.lambda_border = p["smooth"], 0.5, 0.0
            bpy.ops.object.modifier_apply(modifier=m.name)
        elif p.get("subsurf"):
            # Open surfaces cannot be rebuilt from their volume, so they are refined and smoothed as they are.
            m = o.modifiers.new("fine", "SUBSURF")
            m.levels = m.render_levels = p["subsurf"]
            bpy.ops.object.modifier_apply(modifier=m.name)
        if p.get("smooth") and not p.get("voxel"):
            m = o.modifiers.new("soft", "LAPLACIANSMOOTH")
            m.iterations, m.lambda_factor, m.lambda_border = p["smooth"], 0.4, 0.0
            bpy.ops.object.modifier_apply(modifier=m.name)
        slim(o, p.get("faces", MAX_FACES))
        for poly in o.data.polygons:
            poly.use_smooth = True
        o.data.materials.clear()
        o.data.materials.append(material(p["kind"], p.get("glass", 0)))
        built[p["id"]] = o
    return built


def slim(o, limit=MAX_FACES):
    faces = len(o.data.polygons)
    if faces > limit:
        bpy.context.view_layer.objects.active = o
        m = o.modifiers.new("slim", "DECIMATE")
        m.ratio = limit / faces
        bpy.ops.object.modifier_apply(modifier=m.name)


def merged_bvh(objs):
    verts, faces = [], []
    for o in objs:
        base = len(verts)
        verts += [v.co.copy() for v in o.data.vertices]
        faces += [[i + base for i in f.vertices] for f in o.data.polygons]
    return BVHTree.FromPolygons(verts, faces)


def outer_shell(objs, voxel=0.03):
    """One closed surface around several touching parts, without their inner walls, for vessels to grow inside."""
    copies = []
    for o in objs:
        c = o.copy()
        c.data = o.data.copy()
        bpy.context.scene.collection.objects.link(c)
        copies.append(c)
    bpy.ops.object.select_all(action="DESELECT")
    for c in copies:
        c.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.join()
    c = bpy.context.view_layer.objects.active
    m = c.modifiers.new("shell", "REMESH")
    m.mode, m.voxel_size = "VOXEL", voxel
    bpy.ops.object.modifier_apply(modifier=m.name)
    tree = merged_bvh([c])
    bpy.data.objects.remove(c, do_unlink=True)
    return tree


def grow(tree, spec, marks):
    """Grows a branching network: each vessel walks on (or inside) a surface, wandering a little, thinning as it goes and
    throwing off side branches. Seeded, so a build can be repeated exactly. Returns the object and its paths."""
    rng = random.Random(spec["seed"])
    step, paths = 0.028, []
    inside = "inside" in spec
    rate, deepest = spec.get("rate", 0.13), spec.get("depth", 3)

    def walk(at, heading, radius, length, depth):
        points, d, p = [], Vector(heading).normalized(), Vector(at)
        count = int(length / step)
        for i in range(count):
            loc, normal, _, dist = tree.find_nearest(p)
            if loc is None:
                break
            taper = radius * (1 - i / count) ** 0.7 + 0.0022
            if inside:
                # Keep clear of the walls: inside the shell, turning back when it comes close.
                out = (p - loc).dot(normal) > 0
                if out:
                    p = loc - normal * 0.02
                if out or (dist < 0.05 and not spec.get("raw_walls")):
                    d = (d - normal * 0.75).normalized()
                points.append((p.copy(), taper))
            else:
                points.append((loc + normal * taper * 0.35, taper))
                d = (d - normal * d.dot(normal)).normalized()
            wander = 0.14 if inside else 0.2
            d = (d + Vector((rng.gauss(0, wander), rng.gauss(0, wander), rng.gauss(0, wander)))).normalized()
            base = p if inside else loc
            p = base + d * step
            if depth < deepest and i > 2 and rng.random() < rate:
                side = d.cross(normal) * rng.choice((-1, 1))
                turn = (d * 0.55 + side + Vector((rng.gauss(0, 0.3), rng.gauss(0, 0.3), rng.gauss(0, 0.3)))).normalized()
                walk(base, turn, taper * 0.74, (length - i * step) * rng.uniform(0.45, 0.8), depth + 1)
        if len(points) > 2:
            paths.append(points)

    def where(at):
        if isinstance(at, str):
            mark = next((v for k, v in marks.items() if k.endswith(at)), None)
            if mark is None:
                raise SystemExit(f"no mark {at}")
            return Vector(mark)
        return Vector(at)

    # The large vessel that comes into or leaves the organ, drawn out past its edge.
    gates, mains = [], []
    for f in spec.get("feeders", []):
        root = where(f["at"]) + Vector(f.get("shift", (0, 0, 0)))
        out_dir = Vector(f["towards"]).normalized() if f.get("towards") else root.normalized()
        far = root + out_dir * max(0.5, 1.5 - root.length)
        bend = out_dir.orthogonal().normalized() * 0.05
        path = []
        for i in range(29):
            t = i / 28
            co = far.lerp(root, t) + bend * math.sin(t * math.pi)
            path.append((co, f["radius"] * (1 - 0.15 * t)))
        paths.append(path)
        mains.append(path)
        gates.append({"label": f["label"], "io": f["io"], "at": far})

    for start, heading, radius, length in spec["trunks"]:
        start = where(start)
        walk(start, heading or (-start).normalized(), radius, length, 0)
    curve = bpy.data.curves.new(spec["id"], "CURVE")
    curve.dimensions, curve.bevel_depth, curve.bevel_resolution, curve.resolution_u = "3D", 1.0, spec.get("bevel", 2), 2
    for points in paths:
        sp = curve.splines.new("POLY")
        sp.points.add(len(points) - 1)
        for pt, (co, r) in zip(sp.points, points):
            pt.co, pt.radius = (*co, 1), r
    o = bpy.data.objects.new(spec["id"], curve)
    bpy.context.scene.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.view_layer.objects.active
    o.name = o.data.name = spec["id"]
    for poly in o.data.polygons:
        poly.use_smooth = True
    o.data.materials.append(material(spec["kind"]))
    print(f"GROW {spec['id']}: {len(paths)} vessels, {len(o.data.polygons)} faces", flush=True)
    return o, paths, gates, mains


def material(kind, glass=0):
    spec = MATERIALS[kind]
    mat = bpy.data.materials.new(kind)
    mat.use_nodes = True
    n, l = mat.node_tree.nodes, mat.node_tree.links
    b = n["Principled BSDF"]
    co = n.new("ShaderNodeTexCoord")
    tone = n.new("ShaderNodeTexNoise")
    tone.inputs["Scale"].default_value, tone.inputs["Detail"].default_value = 2.6, 6.0
    l.new(co.outputs["Object"], tone.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position, cr.elements[0].color = 0.34, (*spec["tones"][0], 1)
    cr.elements[1].position, cr.elements[1].color = 0.66, (*spec["tones"][2], 1)
    cr.elements.new(0.5).color = (*spec["tones"][1], 1)
    l.new(tone.outputs["Fac"], ramp.inputs["Fac"])
    geo = n.new("ShaderNodeNewGeometry")
    deep = n.new("ShaderNodeMapRange")
    deep.inputs["From Min"].default_value, deep.inputs["From Max"].default_value = 0.44, 0.52
    deep.inputs["To Min"].default_value, deep.inputs["To Max"].default_value = spec["crevice"], 0.0
    l.new(geo.outputs["Pointiness"], deep.inputs["Value"])
    shade = n.new("ShaderNodeMix")
    shade.data_type = "RGBA"
    shade.inputs["B"].default_value = (*[c * 0.22 for c in spec["tones"][0]], 1)
    l.new(deep.outputs[0], shade.inputs["Factor"])
    l.new(ramp.outputs["Color"], shade.inputs["A"])
    l.new(shade.outputs["Result"], b.inputs["Base Color"])
    if glass:
        # For the poster: what is inside glass parts shows through them, as it will on the page.
        b.inputs["Alpha"].default_value = max(0.06, 1 - glass)
    b.inputs["Roughness"].default_value = 0.36
    b.inputs["Coat Weight"].default_value = 0.5
    b.inputs["Coat Roughness"].default_value = 0.26
    b.inputs["Subsurface Weight"].default_value = 0.25
    b.inputs["Subsurface Radius"].default_value = (0.5, 0.12, 0.08)
    b.inputs["Subsurface Scale"].default_value = 0.05
    return mat


def bake(objs, samples, glass, fat):
    """Bakes each part's colour and its shadow from the assembled organ into its vertices, so the web model carries them
    without any textures. Glass parts cast no shadow, and fat gathers along the main surface vessels."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    for g in glass:
        g.hide_render = True
    for o in objs:
        mesh = o.data
        mesh.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        mesh.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
        was_hidden = o.hide_render
        o.hide_render = False
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        mesh.color_attributes.active_color = mesh.color_attributes["Col"]
        scene.cycles.samples = 1
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, target="VERTEX_COLORS")
        mesh.color_attributes.active_color = mesh.color_attributes["AO"]
        scene.cycles.samples = samples
        bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
        o.hide_render = was_hidden
        col, ao = mesh.color_attributes["Col"], mesh.color_attributes["AO"]
        for i, (c, a) in enumerate(zip(col.data, ao.data)):
            shade = 0.2 + 0.8 * a.color[0]
            r, g, bl = c.color[0], c.color[1], c.color[2]
            if fat and o in fat["on"]:
                near = fat["tree"].find(o.data.vertices[i].co)[2]
                # Noise-free falloff, broken up a little by the vertex's own tone.
                w = max(0.0, 1 - near / (0.05 + r * 0.14)) ** 1.4
                r, g, bl = r + (0.86 - r) * w, g + (0.62 - g) * w, bl + (0.26 - bl) * w
            c.color = (r * shade, g * shade, bl * shade, 1)
        mesh.color_attributes.remove(mesh.color_attributes["AO"])
        mesh.color_attributes.active_color = mesh.color_attributes["Col"]
    for g in glass:
        g.hide_render = False
    print(f"BAKED {len(objs)} parts", flush=True)


def stage(scene, size, samples):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 6
    scene.cycles.samples = samples
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.quality = 88
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    world = bpy.data.worlds.new("soft")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.85, 0.95, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.16
    scene.world = world
    cam = bpy.data.cameras.new("cam")
    cam.lens = 85
    o = bpy.data.objects.new("cam", cam)
    scene.collection.objects.link(o)
    o.location = (0, -6.3, 0.3)
    o.rotation_euler = (math.radians(87.3), 0, 0)
    scene.camera = o
    for name, loc, area, power, colour in [
        ("key", (-3.0, -4.4, 3.6), 2.6, 320, (1, 0.97, 0.93)),
        ("fill", (4.5, -3.0, 0.2), 5.0, 70, (0.88, 0.92, 1)),
        ("rim", (2.0, 4.6, 2.6), 2.0, 420, (1, 0.96, 0.92)),
        ("under", (-1.5, -2.5, -4.0), 4.0, 50, (1, 0.9, 0.86)),
    ]:
        light = bpy.data.lights.new(name, "AREA")
        light.size, light.energy, light.color = area, power, colour
        lo = bpy.data.objects.new(name, light)
        scene.collection.objects.link(lo)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


def to_web(v):
    """Blender's Z-up to the web model's Y-up."""
    return [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]


def pins(preset, built, centres):
    """A point on the visible surface for each pinned part, for the page to mark it."""
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for pid in preset["pins"]:
        c = centres[pid]
        ray = Vector((c.x, c.y, c.z * 0.4)).normalized()
        hit, loc, *_ = bpy.context.scene.ray_cast(dg, c + ray * 4, -ray)
        out.append({"part": pid, "at": to_web(loc if hit else c)})
    return out


def flows_from(preset, marks, grown_paths):
    """The routes that things travel along, and the labelled gates where they enter and leave: named journeys through the
    real parts, the large vessels at the organ's edge, and the longest grown vessels."""
    out, gates = [], []
    for r in preset.get("routes", []):
        points = []
        for name in r["through"]:
            mark = next((v for k, v in marks.items() if k.endswith(name)), None)
            if mark is None:
                raise SystemExit(f"route {r['id']}: no mark {name}")
            points.append(to_web(mark))
        out.append({"id": r["id"], "label": r["label"], "about": r["about"], "kind": r["kind"], "radius": r["radius"], "cell": 0.021, "points": points})
        if r.get("enter"):
            gates.append({"label": r["enter"], "io": "in", "kind": r["kind"], "at": points[0]})
        if r.get("leave"):
            gates.append({"label": r["leave"], "io": "out", "kind": r["kind"], "at": points[-1]})
    for spec, paths, spec_gates, mains in grown_paths:
        if not spec.get("flow"):
            continue
        drain = spec.get("drain")
        for g in spec_gates:
            gates.append({"label": g["label"], "io": g["io"], "kind": spec["flow"], "at": to_web(g["at"])})
        rest = [p for p in sorted(paths, key=len, reverse=True) if not any(p is m for m in mains)]
        for i, path in enumerate(mains + rest[: spec.get("flows", 22)]):
            pts = [to_web(p[0]) for p in path[:: 2]]
            if len(pts) < 4:
                continue
            if drain:
                pts.reverse()
            main = any(path is m for m in mains)
            cell = 0.021 if main else round(max(0.009, path[0][1] * 0.62), 4)
            out.append({"id": f"{spec['id']}_{i}", "label": spec["label"], "about": "", "kind": spec["flow"], "radius": round(path[0][1] * 0.45, 4), "cell": cell, "points": pts})
    return out, gates


def main():
    a = args()
    preset = PRESETS[a.organ]
    t0 = time.time()
    gathered, marks = load(os.path.abspath(a.src), preset)
    built = assemble(preset, gathered, marks)
    scene = bpy.context.scene
    stage(scene, a.poster_size, a.samples)
    bpy.context.view_layer.update()

    grown_paths = []
    fat = None
    for g in preset.get("grown", []):
        groups = g.get("surface") or g.get("inside")
        walls = [built[p["id"]] for p in preset["parts"] if (p["id"] in g["walls"] if g.get("walls") else p["group"] in groups)]
        tree = outer_shell(walls) if "inside" in g and not g.get("walls") and not g.get("raw_walls") else merged_bvh(walls)
        o, paths, gates, mains = grow(tree, g, marks)
        built[g["id"]] = o
        grown_paths.append((g, paths, gates, mains))
        if g.get("fat"):
            kd = KDTree(sum(len(p) for p in paths if len(p) > 12))
            n = 0
            for p in paths:
                if len(p) > 12:
                    for co, _ in p:
                        kd.insert(co, n)
                        n += 1
            kd.balance()
            fat = {"tree": kd, "on": walls}
    bpy.context.view_layer.update()
    print(f"BUILT in {time.time() - t0:.0f}s, {sum(len(o.data.polygons) for o in built.values())} faces", flush=True)

    out = os.path.abspath(os.path.join(a.out, a.organ))
    os.makedirs(out, exist_ok=True)
    scene.render.filepath = os.path.join(out, "poster.webp")
    bpy.ops.render.render(write_still=True)
    print(f"POSTER at {time.time() - t0:.0f}s", flush=True)

    centres = {k: centre_of(o) for k, o in built.items()}
    pinned = pins(preset, built, centres)
    parts = preset["parts"] + preset.get("grown", [])
    flows, gates = flows_from(preset, marks, grown_paths)
    glass = [built[p["id"]] for p in parts if p.get("glass", 0) > 0.3]
    bake(list(built.values()), 32, glass, fat)

    bpy.ops.object.select_all(action="DESELECT")
    for o in built.values():
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(out, "model.raw.glb"), export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_normals=True, export_texcoords=False, export_tangents=False, export_materials="NONE", export_vertex_color="ACTIVE",
        export_cameras=False, export_lights=False, export_animations=False,
    )
    with open(os.path.join(out, "manifest.json"), "w") as f:
        json.dump(
            {
                "name": a.organ,
                "title": preset["title"],
                "about": preset["about"],
                "credit": preset["credit"],
                "pulse": preset.get("pulse"),
                "groups": preset["groups"],
                "parts": [{"id": p["id"], "label": p["label"], "about": p["about"], "group": p["group"], "kind": p["kind"], **({"glass": p["glass"]} if p.get("glass") else {}), **({"vessel": True} if p.get("vessel") or "trunks" in p else {})} for p in parts],
                "pins": pinned,
                "flows": flows,
                "gates": gates,
            },
            f,
        )
    print(f"DONE {a.organ} in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
