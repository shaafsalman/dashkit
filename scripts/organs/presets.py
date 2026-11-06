"""What each organ in the library is made of: its groups and parts, what each is called and does, and which meshes of the
Human Reference Atlas models it is built from. The clinical text is general anatomy, for orientation, not medical advice."""

VESSELS = "VH_M_Blood_Vasculature.glb"
HEART = "heart-male.glb"
LUNG = "VH_M_Lung.glb"
LIVER = "VH_M_Liver.glb"
KIDNEY = "VH_M_Kidney_L.glb"
BRAIN = "Allen_M_Brain.glb"
ATLAS = "Shape: HRA 3D Reference Object Library, HuBMAP, from NLM Visible Human data (CC BY 4.0). Colour, surface, fine vessels and flow: illustration."
ALLEN = "Shape: Allen Human Reference Atlas, via the HRA 3D Reference Object Library (CC BY 4.0). Colour and surface: illustration."


def part(id, label, about, group, kind, src, only, **rest):
    return dict(id=id, label=label, about=about, group=group, kind=kind, src=src, only=only, **rest)


# ---------------------------------------------------------------------------------------------------------------- heart
HEART_PRESET = {
    "title": "Heart",
    "about": "A muscular pump with four chambers, four valves and its own blood supply.",
    "credit": ATLAS,
    "pulse": "heart",
    "core_group": "chambers",
    "groups": [
        dict(id="chambers", label="Chambers", about="Two atria receive blood; two ventricles pump it out."),
        dict(id="inside", label="Valves and muscles", about="One-way valves keep blood moving forward; papillary muscles hold two of them shut."),
        dict(id="vessels", label="Great vessels", about="The large vessels that carry blood into and out of the heart."),
        dict(id="supply", label="Heart's own supply", about="Surface vessels that feed the heart muscle itself."),
    ],
    "parts": [
        part("left_ventricle", "Left ventricle", "The thickest chamber. Pumps oxygen-rich blood through the aorta to the body.", "chambers", "muscle", HEART, ["heart_left_ventricle"], voxel=0.012, smooth=16),
        part("right_ventricle", "Right ventricle", "Pumps oxygen-poor blood through the pulmonary trunk to the lungs.", "chambers", "muscle", HEART, ["heart_right_ventricle"], voxel=0.012, smooth=16),
        part("left_atrium", "Left atrium", "Receives oxygen-rich blood from the lungs through the pulmonary veins.", "chambers", "muscle", HEART, ["left_cardiac_atrium"], voxel=0.026, smooth=20),
        part("right_atrium", "Right atrium", "Receives oxygen-poor blood from the body through the venae cavae.", "chambers", "muscle", HEART, ["right_cardiac_atrium"], voxel=0.026, smooth=20),
        part("septum", "Interventricular septum", "The muscular wall between the two ventricles.", "chambers", "muscle", HEART, ["interventricular_septum"], voxel=0.016, smooth=12),
        part("mitral_valve", "Mitral valve", "Two leaflets between the left atrium and left ventricle.", "inside", "valve", HEART, ["mitral_valve"], voxel=0.012, smooth=6),
        part("tricuspid_valve", "Tricuspid valve", "Three leaflets between the right atrium and right ventricle.", "inside", "valve", HEART, ["tricuspid_valve"], voxel=0.012, smooth=6),
        part("aortic_valve", "Aortic valve", "Opens to let the left ventricle eject blood into the aorta.", "inside", "valve", HEART, ["aortic_valve"], voxel=0.012, smooth=6),
        part("pulmonary_valve", "Pulmonary valve", "Opens to let the right ventricle eject blood toward the lungs.", "inside", "valve", HEART, ["pulmonary_valve"], voxel=0.012, smooth=6),
        part("papillary_muscles", "Papillary muscles", "Anchor the mitral and tricuspid valves so they do not swing back.", "inside", "muscle", HEART, ["papillary_muscle"], voxel=0.012, smooth=6),
        part("aorta", "Aorta", "The body's main artery, arching over the heart and giving off branches to the head and arms.", "vessels", "artery", VESSELS, ["aortic_arch", "ascending_aorta", "brachiocephalic_artery_a", "left_common_carotid_artery_a", "left_subclavian_artery_a"], clip=True, vessel=True),
        part("pulmonary_arteries", "Pulmonary trunk and arteries", "Carry oxygen-poor blood from the right ventricle to the lungs.", "vessels", "pulmonary", VESSELS, ["pulmonary_trunk", "pulmonary_artery_L", "pulmonary_artery_R"], clip=True, vessel=True),
        part("pulmonary_veins", "Pulmonary veins", "Return oxygen-rich blood from the lungs to the left atrium.", "vessels", "artery", VESSELS, ["pulmonary_vein"], clip=True, vessel=True),
        part("superior_vena_cava", "Superior vena cava", "Returns blood from the upper body to the right atrium.", "vessels", "pulmonary", VESSELS, ["superior_vena_cava"], clip=True, vessel=True),
        part("inferior_vena_cava", "Inferior vena cava", "Returns blood from the lower body to the right atrium.", "vessels", "pulmonary", VESSELS, ["inferior_vena_cava_a"], clip=True, vessel=True),
    ],
    # Start, heading, thickness, length. Illustrated routes, branching as they go, not traced anatomy.
    "grown": [
        dict(id="coronary_arteries", label="Coronary arteries", about="Feed the heart muscle with oxygen-rich blood. Drawn as an illustration of the network.", group="supply", kind="coronary", seed=3, surface=["chambers"], flow="artery", fat=True,
             trunks=[((0.12, -0.9, 0.3), (0.5, -0.1, -0.85), 0.026, 1.6), ((-0.48, -0.7, 0.2), (-0.3, 0.2, -0.9), 0.024, 1.4), ((0.35, -0.5, 0.42), (0.9, 0.5, -0.25), 0.022, 1.4), ((0.1, 0.8, 0.15), (0.45, 0.0, -0.9), 0.022, 1.3)]),
        dict(id="cardiac_veins", label="Cardiac veins", about="Drain used blood from the heart muscle. Drawn as an illustration of the network.", group="supply", kind="vein", seed=11, surface=["chambers"], flow="vein", drain=True,
             trunks=[((0.0, -0.9, 0.25), (0.45, -0.1, -0.9), 0.018, 1.2), ((0.5, 0.3, 0.3), (0.5, 0.5, -0.8), 0.018, 1.1), ((-0.3, 0.7, 0.1), (0.3, 0.1, -0.9), 0.017, 1.1)]),
    ],
    "routes": [
        dict(id="to_lungs_upper", label="To the lungs", about="Oxygen-poor blood: body, right atrium, right ventricle, pulmonary trunk, lungs.", kind="vein", radius=0.075, enter="From the upper body", leave="To the left lung", through=["superior_vena_cava", "right_cardiac_atrium", "tricuspid_valve", "heart_right_ventricle", "pulmonary_valve", "pulmonary_trunk", "pulmonary_artery_L"]),
        dict(id="to_lungs_lower", label="To the lungs", about="", kind="vein", radius=0.075, enter="From the lower body", leave="To the right lung", through=["inferior_vena_cava_a", "right_cardiac_atrium", "tricuspid_valve", "heart_right_ventricle", "pulmonary_valve", "pulmonary_trunk", "pulmonary_artery_R"]),
        dict(id="to_body_head", label="To the body", about="Oxygen-rich blood: lungs, left atrium, left ventricle, aorta, body.", kind="artery", radius=0.07, enter="From the lungs", leave="To the head and right arm", through=["pulmonary_vein_L_sup", "left_cardiac_atrium", "mitral_valve", "heart_left_ventricle", "aortic_valve", "ascending_aorta", "aortic_arch", "brachiocephalic_artery_a"]),
        dict(id="to_body_neck", label="To the body", about="", kind="artery", radius=0.07, enter="From the lungs", leave="To the head", through=["pulmonary_vein_R_sup", "left_cardiac_atrium", "mitral_valve", "heart_left_ventricle", "aortic_valve", "ascending_aorta", "aortic_arch", "left_common_carotid_artery_a"]),
        dict(id="to_body_arm", label="To the body", about="", kind="artery", radius=0.07, leave="To the left arm", through=["pulmonary_vein_L_inf", "left_cardiac_atrium", "mitral_valve", "heart_left_ventricle", "aortic_valve", "ascending_aorta", "aortic_arch", "left_subclavian_artery_a"]),
    ],
    "pins": ["left_ventricle", "right_ventricle", "aorta", "pulmonary_arteries", "right_atrium"],
}

# ---------------------------------------------------------------------------------------------------------------- lungs
SEG = "A bronchopulmonary segment: a wedge of lung with its own bronchus and artery, which is why surgeons and radiologists describe disease by segment."


def lung_seg(side, name, label, group):
    return part(f"{side}_{name}", f"{side.capitalize()} {label} segment", SEG, group, "lung", LUNG, [f"{side}_{name}_bronchopulmonary_segment"], subsurf=2, smooth=6, glass=0.62)


LUNGS_PRESET = {
    "title": "Lungs",
    "about": "Paired organs of gas exchange: the right lung has three lobes, the left has two, and each divides into segments.",
    "credit": ATLAS,
    "pulse": "breath",
    "groups": [
        dict(id="right_upper", label="Right upper lobe", about="Three segments at the top of the right lung."),
        dict(id="right_middle", label="Right middle lobe", about="Two segments, found only on the right."),
        dict(id="right_lower", label="Right lower lobe", about="Five segments at the base of the right lung."),
        dict(id="left_upper", label="Left upper lobe", about="The upper left lobe, including the lingula."),
        dict(id="left_lower", label="Left lower lobe", about="The base of the left lung."),
        dict(id="airway", label="Airway", about="Air travels down the trachea and divides again and again through the bronchi."),
        dict(id="vessels", label="Pulmonary vessels", about="Carry blood through the lungs to collect oxygen."),
    ],
    "parts": [
        lung_seg("right", "apical", "apical", "right_upper"), lung_seg("right", "posterior", "posterior", "right_upper"), lung_seg("right", "anterior", "anterior", "right_upper"),
        lung_seg("right", "lateral", "lateral", "right_middle"), lung_seg("right", "medial", "medial", "right_middle"),
        lung_seg("right", "superior", "superior", "right_lower"), lung_seg("right", "anterior_basal", "anterior basal", "right_lower"), lung_seg("right", "lateral_basal", "lateral basal", "right_lower"), lung_seg("right", "medial_basal", "medial basal", "right_lower"), lung_seg("right", "posterior_basal", "posterior basal", "right_lower"),
        lung_seg("left", "apical", "apical", "left_upper"), lung_seg("left", "posterior", "posterior", "left_upper"), lung_seg("left", "anterior", "anterior", "left_upper"), lung_seg("left", "lingula_superior", "superior lingular", "left_upper"), lung_seg("left", "lingula_inferior", "inferior lingular", "left_upper"),
        lung_seg("left", "superior", "superior", "left_lower"), lung_seg("left", "anterior_basal", "anterior basal", "left_lower"), lung_seg("left", "lateral_basal", "lateral basal", "left_lower"), lung_seg("left", "medial_basal", "medial basal", "left_lower"),
        part("left_posterior_basal", "Left posterior basal segment", SEG, "left_lower", "lung", LUNG, ["left_posetrior_basal_bronchopulmonary_segment"], subsurf=2, smooth=6, glass=0.62),
        part("trachea", "Trachea", "The windpipe, held open by rings of cartilage.", "airway", "airway", LUNG, ["VH_M_trachea", "tracheal_cartilage"], vessel=True),
        part("larynx", "Larynx cartilages", "The cartilages that frame the voice box above the trachea.", "airway", "cartilage", LUNG, ["cricoid_cartilage", "thyroid_cartilage", "epiglottic_cartilage", "arytenoid_cartilage", "corniculate_cartilage"], vessel=True),
        part("main_bronchi", "Main bronchi", "The first division of the airway, one to each lung.", "airway", "airway", LUNG, ["carina", "left_main_bronchus", "right_main_bronchus"], vessel=True),
        part("lobar_bronchi", "Lobar bronchi", "One to each lobe.", "airway", "airway", LUNG, ["lobar_bronchus", "right_intermediate_bronchus"], vessel=True),
        part("segmental_bronchi", "Segmental bronchi", "One to each segment, branching on toward the air sacs.", "airway", "airway", LUNG, ["bronchus", "right_posterior_basal", "bronchial_cartilage"], skip=["bronchopulmonary"], vessel=True),
    ],
    "grown": [
        dict(id="pulmonary_arteries", label="Pulmonary arteries", about="Bring oxygen-poor blood to the air sacs. Drawn as an illustration of the branching.", group="vessels", kind="coral", seed=5, inside=["right_upper", "right_middle", "right_lower", "left_upper", "left_lower"], flow="vein", depth=5, rate=0.2, bevel=1, raw_walls=True,
             feeders=[dict(at="hilum_R", towards=(-0.22, 0, 0.12), label="Pulmonary artery", io="in", radius=0.034), dict(at="hilum_L", towards=(0.22, 0, 0.12), label="Pulmonary artery", io="in", radius=0.034)],
             trunks=[("hilum_R", (0.7, -0.1, 0.8), 0.03, 1.1), ("hilum_R", (0.8, 0.1, -0.9), 0.03, 1.3), ("hilum_R", (0.9, -0.5, -0.2), 0.026, 1.0), ("hilum_R", (0.6, 0.6, 0.1), 0.026, 1.0), ("hilum_L", (-0.7, -0.1, 0.8), 0.03, 1.1), ("hilum_L", (-0.8, 0.1, -0.9), 0.03, 1.3), ("hilum_L", (-0.9, -0.5, -0.2), 0.026, 1.0), ("hilum_L", (-0.6, 0.6, 0.1), 0.026, 1.0)]),
        dict(id="pulmonary_veins", label="Pulmonary veins", about="Carry oxygen-rich blood back toward the heart. Drawn as an illustration of the branching.", group="vessels", kind="vein", seed=9, inside=["right_upper", "right_middle", "right_lower", "left_upper", "left_lower"], flow="artery", depth=4, rate=0.16, bevel=1, raw_walls=True, drain=True,
             feeders=[dict(at="hilum_R", towards=(-0.22, -0.1, -0.1), label="Pulmonary vein", io="out", radius=0.028), dict(at="hilum_L", towards=(0.22, -0.1, -0.1), label="Pulmonary vein", io="out", radius=0.028)],
             trunks=[("hilum_R", (0.8, 0.3, 0.5), 0.022, 1.0), ("hilum_R", (0.7, -0.3, -0.7), 0.022, 1.1), ("hilum_L", (-0.8, 0.3, 0.5), 0.022, 1.0), ("hilum_L", (-0.7, -0.3, -0.7), 0.022, 1.1)]),
    ],
    "routes": [
        dict(id="air_right_upper", label="Air", about="Air moves down the trachea, through the bronchi, toward the air sacs.", kind="air", radius=0.04, through=["VH_M_trachea", "carina", "right_main_bronchus", "right_superior_lobar_bronchus", "right_apical_bronchus"]),
        dict(id="air_right_lower", label="Air", about="", kind="air", radius=0.04, through=["VH_M_trachea", "carina", "right_main_bronchus", "right_intermediate_bronchus", "right_lower_lobar_bronchus", "right_posterior_basal"]),
        dict(id="air_right_middle", label="Air", about="", kind="air", radius=0.04, through=["VH_M_trachea", "carina", "right_main_bronchus", "right_intermediate_bronchus", "right_middle_lobar_bronchus", "right_lateral_bronchus"]),
        dict(id="air_left_upper", label="Air", about="", kind="air", radius=0.04, through=["VH_M_trachea", "carina", "left_main_bronchus", "left_superior_lobar_bronchus", "left_apical_bronchus"]),
        dict(id="air_left_lower", label="Air", about="", kind="air", radius=0.04, through=["VH_M_trachea", "carina", "left_main_bronchus", "left_inferior_lobar_bronchus", "left_posterior_basal_bronchus"]),
    ],
    "pins": ["trachea", "right_apical", "right_lateral", "left_apical", "left_lateral_basal"],
}

# ---------------------------------------------------------------------------------------------------------------- liver
COUINAUD = "A functional liver segment with its own blood supply and bile drainage, which is how surgeons plan a resection."
LIVER_PRESET = {
    "title": "Liver",
    "about": "The body's chemical works, divided into segments that can each be fed and drained on their own.",
    "credit": ATLAS,
    "groups": [
        dict(id="right", label="Right lobe", about="The larger lobe, made of four segments."),
        dict(id="left", label="Left lobe", about="The smaller lobe, crossing the midline."),
        dict(id="central", label="Central lobes", about="The caudate and quadrate lobes, between the two sides."),
        dict(id="surface", label="Surface and ligaments", about="The capsule around the liver and the ligaments that hold it in place."),
        dict(id="vessels", label="Blood supply", about="Blood reaches the liver from two sources and drains through the hepatic veins."),
    ],
    "parts": [
        part("right_anterosuperior", "Right anterosuperior segment", COUINAUD, "right", "liver", LIVER, ["right_anterosuperior_segment"], subsurf=2, smooth=6),
        part("right_anteroinferior", "Right anteroinferior segment", COUINAUD, "right", "liver", LIVER, ["right_anteroinferior_segment"], subsurf=2, smooth=6),
        part("right_posterosuperior", "Right posterosuperior segment", COUINAUD, "right", "liver", LIVER, ["right_posterosuperior_segment"], subsurf=2, smooth=6),
        part("right_posteroinferior", "Right posteroinferior segment", COUINAUD, "right", "liver", LIVER, ["right_posteroinferior_segment"], subsurf=2, smooth=6),
        part("left_anterolateral", "Left anterolateral segment", COUINAUD, "left", "liver", LIVER, ["left_anterolateral_segment"], subsurf=2, smooth=6),
        part("left_posterolateral", "Left posterolateral segment", COUINAUD, "left", "liver", LIVER, ["left_posterolateral_segment"], subsurf=2, smooth=6),
        part("left_superiomedial", "Left superomedial segment", COUINAUD, "left", "liver", LIVER, ["left_superiomedial_segment"], subsurf=2, smooth=6),
        part("left_inferomedial", "Left inferomedial segment", COUINAUD, "left", "liver", LIVER, ["left_inferomedial_segment"], subsurf=2, smooth=6),
        part("caudate", "Caudate lobe", "A small lobe at the back of the liver, with its own venous drainage.", "central", "liver", LIVER, ["caudate_lobe_of_liver"], subsurf=2, smooth=6),
        part("quadrate", "Quadrate lobe", "A small lobe on the underside, beside the gallbladder.", "central", "liver", LIVER, ["quadrate_lobe_of_liver"], subsurf=2, smooth=6),
        part("capsule", "Liver capsule", "The thin fibrous layer over the whole surface.", "surface", "capsule", LIVER, ["liver_capsule"], glass=0.82, vessel=True),
        part("ligaments", "Ligaments", "Falciform, round, coronary and triangular ligaments, which anchor the liver.", "surface", "cartilage", LIVER, ["falciform_ligament", "round_ligament", "coronary_ligament", "triangular_ligament", "ligamentum_venosum", "hepataduodenal_ligament"], vessel=True),
    ],
    "grown": [
        dict(id="portal_vein", label="Portal vein", about="Brings nutrient-rich blood from the gut into the liver. Drawn as an illustration of the branching.", group="vessels", kind="vein", seed=4, walls=["capsule"], inside=["surface"], flow="vein", depth=4, rate=0.17, bevel=1,
             feeders=[dict(at="porta_hepatis", towards=(0.1, -0.1, -0.85), label="Portal vein", io="in", radius=0.04)],
             trunks=[("porta_hepatis", (-0.9, 0.0, 0.3), 0.034, 1.3), ("porta_hepatis", (0.9, 0.0, 0.3), 0.03, 1.1), ("porta_hepatis", (-0.5, 0.6, 0.5), 0.03, 1.1), ("porta_hepatis", (-0.6, -0.6, -0.1), 0.03, 1.0)]),
        dict(id="hepatic_artery", label="Hepatic artery", about="Brings oxygen-rich blood to the liver. Drawn as an illustration of the branching.", group="vessels", kind="coral", seed=8, walls=["capsule"], inside=["surface"], flow="artery", depth=4, rate=0.16, bevel=1,
             feeders=[dict(at="porta_hepatis", towards=(0.35, -0.3, -0.75), label="Hepatic artery", io="in", radius=0.024)],
             trunks=[("porta_hepatis", (-0.8, -0.3, 0.1), 0.02, 1.2), ("porta_hepatis", (0.8, -0.2, 0.1), 0.02, 1.0), ("porta_hepatis", (-0.3, 0.5, 0.7), 0.018, 1.0)]),
        dict(id="hepatic_veins", label="Hepatic veins", about="Drain the liver into the inferior vena cava. Drawn as an illustration of the branching.", group="vessels", kind="pulmonary", seed=15, walls=["capsule"], inside=["surface"], flow="vein", depth=4, rate=0.15, bevel=1, drain=True,
             feeders=[dict(at="caudate_lobe_of_liver", towards=(0.05, 0.25, 0.95), label="Hepatic veins", io="out", radius=0.036)],
             trunks=[("caudate_lobe_of_liver", (-0.8, -0.2, -0.3), 0.03, 1.2), ("caudate_lobe_of_liver", (0.8, -0.3, -0.2), 0.026, 1.0), ("caudate_lobe_of_liver", (-0.3, -0.7, -0.5), 0.026, 1.0)]),
    ],
    "pins": ["right_anteroinferior", "left_anterolateral", "quadrate", "right_posterosuperior"],
}

# --------------------------------------------------------------------------------------------------------------- kidney
PYRAMID = "A cone of collecting tubules. Urine leaves at its tip, the papilla, and drains into the renal pelvis."
KIDNEY_PRESET = {
    "title": "Kidney",
    "about": "Filters the blood and makes urine: a cortex of filters around cones of collecting tubules.",
    "credit": ATLAS,
    "groups": [
        dict(id="outer", label="Outer layers", about="The capsule and the cortex, where blood is filtered."),
        dict(id="pyramids", label="Renal pyramids", about="Nine cones in this model, which gather urine and pass it inward."),
        dict(id="centre", label="Columns and hilum", about="Tissue between the pyramids, and the doorway for vessels and the ureter."),
        dict(id="vessels", label="Blood supply", about="The kidney receives a large share of the blood the heart pumps."),
    ],
    "parts": [
        part("capsule", "Renal capsule", "A tough fibrous layer around the kidney.", "outer", "capsule", KIDNEY, ["kidney_capsule"], glass=0.86, vessel=True),
        part("cortex", "Renal cortex", "The outer layer, packed with the filtering units called nephrons.", "outer", "kidney", KIDNEY, ["outer_cortex"], glass=0.58, subsurf=1, smooth=4),
        *[part(f"pyramid_{c}", f"Renal pyramid {i + 1}", PYRAMID, "pyramids", "pyramid", KIDNEY, [f"renal_pyramid_L_{c}", f"renal_papilla_L_{c}"], subsurf=1, smooth=4) for i, c in enumerate("abcdefghi")],
        part("columns", "Renal columns", "Bands of cortex-like tissue that run between the pyramids.", "centre", "kidney", KIDNEY, ["renal_column"], smooth=3, glass=0.4),
        part("hilum", "Renal hilum", "Where the renal artery, renal vein and ureter enter and leave.", "centre", "cartilage", KIDNEY, ["hilum_of_kidney"], subsurf=1, smooth=4),
    ],
    "grown": [
        dict(id="renal_arteries", label="Renal arteries", about="Bring blood to be filtered. Drawn as an illustration of the branching.", group="vessels", kind="coral", seed=6, walls=["capsule"], inside=["outer"], flow="artery", depth=4, rate=0.2, bevel=1,
             feeders=[dict(at="hilum_of_kidney_L", towards=None, label="Renal artery", io="in", radius=0.036, shift=(0, 0, 0.05))],
             trunks=[("hilum_of_kidney_L", None, 0.03, 1.2), ("hilum_of_kidney_L", (0.3, 0.2, 0.8), 0.026, 1.1), ("hilum_of_kidney_L", (0.3, -0.2, -0.8), 0.026, 1.1), ("hilum_of_kidney_L", (0.3, 0.8, 0.1), 0.024, 1.0)]),
        dict(id="renal_veins", label="Renal veins", about="Return filtered blood. Drawn as an illustration of the branching.", group="vessels", kind="vein", seed=12, walls=["capsule"], inside=["outer"], flow="vein", depth=3, rate=0.18, bevel=1, drain=True,
             feeders=[dict(at="hilum_of_kidney_L", towards=None, label="Renal vein", io="out", radius=0.04, shift=(0, 0, -0.06))],
             trunks=[("hilum_of_kidney_L", (0.5, 0.1, 0.5), 0.024, 1.0), ("hilum_of_kidney_L", (0.5, -0.1, -0.5), 0.024, 1.0)]),
    ],
    "pins": ["cortex", "pyramid_a", "pyramid_e", "hilum"],
}

# ---------------------------------------------------------------------------------------------------------------- brain
LOBES = {
    "frontal": ("Frontal lobe", "Planning, decisions, movement and speech production.", {
        "precentral_gyrus": "Holds the primary motor cortex, which starts voluntary movement.", "superior_frontal_gyrus": "", "middle_frontal_gyrus": "", "inferior_frontal_gyrus_triangular_part": "With the opercular part, forms Broca's area on the dominant side, for speech production.", "inferior_frontal_gyrus_opercular_part": "With the triangular part, forms Broca's area on the dominant side, for speech production.", "gyrus_rectus_straight_gyrus": "", "medial_orbital_gyrus": "", "anterior_intermediate_orbital_gyrus": "", "posterior_intermediate_orbital_gyrus": "", "lateral_orbital_gyrus": "", "paracentral_lobule_rostral_part": "", "frontal_operculum": "", "rostral_gyrus": "", "frontomarginal_gyrus": "", "frontal_pole": ""}),
    "parietal": ("Parietal lobe", "Touch, body position and spatial awareness.", {
        "postcentral_gyrus": "Holds the primary sensory cortex, which registers touch from the body.", "supraparietal_lobule": "", "supramarginal_gyrus": "", "angular_gyrus": "", "precuneus": "", "paracentral_lobule_caudal_part": "", "parietal_operculum": ""}),
    "temporal": ("Temporal lobe", "Hearing, language understanding and memory.", {
        "superior_temporal_gyrus": "Includes areas that process sound and language.", "middle_temporal_gyrus": "", "inferior_temporal_gyrus": "", "occipitotemporal_fusiform_gyrus_temporal_part": "", "transverse_temporal_gyrus_Heschls_gyrus": "Heschl's gyrus, the primary auditory cortex.", "planum_temporale": "", "temporal_pole": "", "planum_polare": "", "perirhinal_gyrus_rostral_part_of_FuGt": ""}),
    "occipital": ("Occipital lobe", "Vision.", {
        "occipital_pole": "", "cuneus": "", "lingual_gyrus_medial_occipitotemporal_gyrus": "", "lateral_occipitotemporal_fusiform_gyrus_occipital_part": "", "inferior_occipital_gyrus": "", "superior_occipital_gyrus": ""}),
    "limbic": ("Limbic and insula", "Emotion, memory and internal body sense.", {
        "cingulate_gyrus_rostral_anterior_part": "", "cingulate_gyrus_caudal_posterior_part": "", "paracingulate_gyrus": "", "ingulo_parahippocampal_isthmus": "", "subcallosal_gyrus_parolfactory_gyrus": "", "anterior_parahippocampal_gyrus": "", "posterior_parahippocampal_gyrus": "", "gyrus_ambiens": "", "long_insular_gyri": "", "short_insular_gyri": "", "limen_insula": ""}),
}
DEEP = {
    "hippocampus": ("Hippocampus", "Forms new memories.", ["head_of_hippocampus", "body_of_hippocampus", "tail_of_hippocampus"]),
    "amygdala": ("Amygdala", "Processes emotion, especially fear.", ["amygdaloid_complex", "anterior_amygdaloid_area", "central_nuclear_group", "lateral_nucleus", "basolateral_nucleus", "basomedial_nucleus", "anterior_cortical_nucleus", "posterior_cortical_nucleus", "medial_nucleus", "amygdalohippocampal_area"]),
    "thalamus": ("Thalamus", "Relays signals between the body and the cortex.", ["thalamus", "lateral_dorsal_nucleus", "reuniens_nucleus", "lateral_posterior_nucleus", "pulvinar", "ventral_anterior_nucleus", "ventral_lateral_nucleus", "ventral_posterior", "geniculate", "centromedian", "parafascicular", "habenular", "midline_nuclear_complex", "anterior_nuclear_complex", "mediodorsal"]),
    "basal_ganglia": ("Basal ganglia", "Help select and smooth movement.", ["caudate", "putamen", "nucleus_accumbens", "globus_pallidus"]),
    "hypothalamus": ("Hypothalamus", "Regulates temperature, hunger and hormones.", ["hypothalamus", "supraoptic_region", "mammillary_region", "tuberal_region", "preoptic_region", "subthalamic_nucleus"]),
    "corpus_callosum": ("Corpus callosum", "The great bundle of fibres joining the two hemispheres.", ["corpus_callosum"]),
    "ventricles": ("Ventricles", "Fluid-filled spaces that make and hold cerebrospinal fluid.", ["horn_of_lateral_ventricle", "body_of_lateral_ventricle", "atrium_of_lateral_ventricle", "third_ventricle"]),
}
HINDBRAIN = {
    "cerebellum": ("Cerebellum", "Coordinates balance and fine movement.", ["lateral_hemisphere_of_cerebellum", "paravermis_of_cerebellum", "cerebellar_vermis", "cerebellar_deep_nuclei"]),
    "midbrain": ("Midbrain", "Eye movement and part of the motor pathway.", ["midbrain_tegmentum", "red_nucleus", "substantia_nigra", "superior_colliculus", "inferior_colliculus", "cerebral_peduncle", "pretectal_region"]),
    "pons": ("Pons", "Relays signals to the cerebellum and helps control breathing.", ["basilar_part_of_pons", "pontine_tegmentum", "middle_cerebellar_peduncle"]),
    "medulla": ("Medulla", "Controls heartbeat, blood pressure and breathing.", ["pyramidal_part_of_medulla", "tegmentum_of_medulla", "inferior_olive", "inferior_cerebellar_peduncle"]),
}


def nice(name):
    return name.split("_gyrus_")[0].replace("_", " ").replace("ingulo", "cingulo").replace(" part of FuGt", "").strip()


def brain_parts():
    out = []
    for lobe, (title, role, gyri) in LOBES.items():
        for g, note in gyri.items():
            for side, sfx in (("Left", "L"), ("Right", "R")):
                name = nice(g)
                out.append(part(f"{g}_{sfx}", f"{side} {name}", note or f"Part of the {title.lower()}: {role[0].lower() + role[1:]}", lobe, "brain", BRAIN, [f"Allen_{g}_{sfx}"], faces=3200))
    for key, (title, role, meshes) in DEEP.items():
        kind = "fluid" if key == "ventricles" else "deep"
        out.append(part(key, title, role, "deep", kind, BRAIN, meshes, faces=9000))
    for key, (title, role, meshes) in HINDBRAIN.items():
        out.append(part(key, title, role, "hindbrain", "deep" if key != "cerebellum" else "brain", BRAIN, meshes, faces=22000 if key == "cerebellum" else 9000))
    return out


BRAIN_PRESET = {
    "title": "Brain",
    "about": "Each fold is a named region. This model holds the cortex gyrus by gyrus, with the deep structures beneath it.",
    "credit": ALLEN,
    "yaw": 90,
    "groups": [
        *[dict(id=k, label=v[0], about=v[1]) for k, v in LOBES.items()],
        dict(id="deep", label="Deep structures", about="The nuclei and fluid spaces buried under the cortex."),
        dict(id="hindbrain", label="Cerebellum and brainstem", about="Balance, coordination and the body's vital controls."),
        dict(id="vessels", label="Blood supply", about="Arteries reach the brain from below and spread over its surface; veins drain it."),
    ],
    "parts": brain_parts(),
    "grown": [
        dict(id="cerebral_arteries", label="Cerebral arteries", about="Bring oxygen-rich blood over the surface of the brain. Drawn as an illustration of the network.", group="vessels", kind="coral", seed=7, surface=["frontal", "parietal", "temporal", "occipital"], flow="artery", depth=4, rate=0.14, bevel=1,
             feeders=[dict(at=(0.12, 0.25, -0.55), towards=(0.02, 0.02, -1), label="Carotid artery", io="in", radius=0.03), dict(at=(-0.12, 0.25, -0.55), towards=(-0.02, 0.02, -1), label="Carotid artery", io="in", radius=0.03), dict(at=(0, -0.3, -0.72), towards=(0, -0.05, -1), label="Vertebral artery", io="in", radius=0.024)],
             trunks=[((0.75, 0.2, -0.3), (0.0, -0.5, 0.9), 0.022, 1.6), ((-0.75, 0.2, -0.3), (0.0, -0.5, 0.9), 0.022, 1.6), ((0.35, 0.8, -0.1), (0.1, -0.3, 0.9), 0.02, 1.5), ((-0.35, 0.8, -0.1), (-0.1, -0.3, 0.9), 0.02, 1.5), ((0.3, -0.75, -0.2), (0.1, 0.4, 0.9), 0.02, 1.3), ((-0.3, -0.75, -0.2), (-0.1, 0.4, 0.9), 0.02, 1.3)]),
        dict(id="cerebral_veins", label="Cerebral veins", about="Drain used blood from the brain. Drawn as an illustration of the network.", group="vessels", kind="vein", seed=13, surface=["frontal", "parietal", "temporal", "occipital"], flow="vein", depth=3, rate=0.12, bevel=1, drain=True,
             feeders=[dict(at=(0.3, -0.55, -0.55), towards=(0.08, -0.05, -1), label="Jugular vein", io="out", radius=0.028), dict(at=(-0.3, -0.55, -0.55), towards=(-0.08, -0.05, -1), label="Jugular vein", io="out", radius=0.028)],
             trunks=[((0.55, -0.5, -0.2), (0.0, 0.5, 0.9), 0.018, 1.4), ((-0.55, -0.5, -0.2), (0.0, 0.5, 0.9), 0.018, 1.4), ((0.2, 0.3, 0.75), (0.0, -0.9, 0.0), 0.016, 1.2)]),
    ],
    "pins": ["precentral_gyrus_R", "superior_temporal_gyrus_R", "occipital_pole_R", "cerebellum", "postcentral_gyrus_R"],
}

PRESETS = {"heart": HEART_PRESET, "lungs": LUNGS_PRESET, "liver": LIVER_PRESET, "kidney": KIDNEY_PRESET, "brain": BRAIN_PRESET}
