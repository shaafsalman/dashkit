"""
What the importer knows about each structure: a readable label, a line of general anatomy, its group, its layer and its kind.

TOTAL and TOTAL_MR are copied from TotalSegmentator's own class map, which is Apache-2.0:
  https://github.com/wasserth/TotalSegmentator/blob/c59be95b839252dd993e1e32ff3369168d9f4eab/totalsegmentator/map_to_binary.py
  (version 2.18.0, read on 2026-11-06). A label's number means nothing without the map of the version that wrote the file, so check
  this list against that version. TotalSegmentator's --ml files carry their own label table, and the importer prefers that table.

The labels and descriptions are ours, written as general anatomy and not about any one person.
"""
import re

TOTAL = {
    1: "spleen", 2: "kidney_right", 3: "kidney_left", 4: "gallbladder", 5: "liver", 6: "stomach", 7: "pancreas", 8: "adrenal_gland_right", 9: "adrenal_gland_left",
    10: "lung_upper_lobe_left", 11: "lung_lower_lobe_left", 12: "lung_upper_lobe_right", 13: "lung_middle_lobe_right", 14: "lung_lower_lobe_right", 15: "esophagus",
    16: "trachea", 17: "thyroid_gland", 18: "small_bowel", 19: "duodenum", 20: "colon", 21: "urinary_bladder", 22: "prostate", 23: "kidney_cyst_left", 24: "kidney_cyst_right",
    25: "sacrum", 26: "vertebrae_S1", 27: "vertebrae_L5", 28: "vertebrae_L4", 29: "vertebrae_L3", 30: "vertebrae_L2", 31: "vertebrae_L1", 32: "vertebrae_T12", 33: "vertebrae_T11",
    34: "vertebrae_T10", 35: "vertebrae_T9", 36: "vertebrae_T8", 37: "vertebrae_T7", 38: "vertebrae_T6", 39: "vertebrae_T5", 40: "vertebrae_T4", 41: "vertebrae_T3", 42: "vertebrae_T2",
    43: "vertebrae_T1", 44: "vertebrae_C7", 45: "vertebrae_C6", 46: "vertebrae_C5", 47: "vertebrae_C4", 48: "vertebrae_C3", 49: "vertebrae_C2", 50: "vertebrae_C1", 51: "heart",
    52: "aorta", 53: "pulmonary_vein", 54: "brachiocephalic_trunk", 55: "subclavian_artery_right", 56: "subclavian_artery_left", 57: "common_carotid_artery_right",
    58: "common_carotid_artery_left", 59: "brachiocephalic_vein_left", 60: "brachiocephalic_vein_right", 61: "atrial_appendage_left", 62: "superior_vena_cava", 63: "inferior_vena_cava",
    64: "portal_vein_and_splenic_vein", 65: "iliac_artery_left", 66: "iliac_artery_right", 67: "iliac_vena_left", 68: "iliac_vena_right", 69: "humerus_left", 70: "humerus_right",
    71: "scapula_left", 72: "scapula_right", 73: "clavicula_left", 74: "clavicula_right", 75: "femur_left", 76: "femur_right", 77: "hip_left", 78: "hip_right", 79: "spinal_cord",
    80: "gluteus_maximus_left", 81: "gluteus_maximus_right", 82: "gluteus_medius_left", 83: "gluteus_medius_right", 84: "gluteus_minimus_left", 85: "gluteus_minimus_right",
    86: "autochthon_left", 87: "autochthon_right", 88: "iliopsoas_left", 89: "iliopsoas_right", 90: "brain", 91: "skull", 92: "rib_left_1", 93: "rib_left_2", 94: "rib_left_3",
    95: "rib_left_4", 96: "rib_left_5", 97: "rib_left_6", 98: "rib_left_7", 99: "rib_left_8", 100: "rib_left_9", 101: "rib_left_10", 102: "rib_left_11", 103: "rib_left_12",
    104: "rib_right_1", 105: "rib_right_2", 106: "rib_right_3", 107: "rib_right_4", 108: "rib_right_5", 109: "rib_right_6", 110: "rib_right_7", 111: "rib_right_8", 112: "rib_right_9",
    113: "rib_right_10", 114: "rib_right_11", 115: "rib_right_12", 116: "sternum", 117: "costal_cartilages",
}
TOTAL_MR = {
    1: "spleen", 2: "kidney_right", 3: "kidney_left", 4: "gallbladder", 5: "liver", 6: "stomach", 7: "pancreas", 8: "adrenal_gland_right", 9: "adrenal_gland_left", 10: "lung_left",
    11: "lung_right", 12: "esophagus", 13: "small_bowel", 14: "duodenum", 15: "colon", 16: "urinary_bladder", 17: "prostate", 18: "sacrum", 19: "vertebrae", 20: "intervertebral_discs",
    21: "spinal_cord", 22: "heart", 23: "aorta", 24: "inferior_vena_cava", 25: "portal_vein_and_splenic_vein", 26: "iliac_artery_left", 27: "iliac_artery_right", 28: "iliac_vena_left",
    29: "iliac_vena_right", 30: "humerus_left", 31: "humerus_right", 32: "scapula_left", 33: "scapula_right", 34: "clavicula_left", 35: "clavicula_right", 36: "femur_left", 37: "femur_right",
    38: "hip_left", 39: "hip_right", 40: "gluteus_maximus_left", 41: "gluteus_maximus_right", 42: "gluteus_medius_left", 43: "gluteus_medius_right", 44: "gluteus_minimus_left",
    45: "gluteus_minimus_right", 46: "autochthon_left", 47: "autochthon_right", 48: "iliopsoas_left", 49: "iliopsoas_right", 50: "brain",
}
TASKS = {"total": TOTAL, "total_mr": TOTAL_MR}

KINDS = {"muscle", "artery", "pulmonary", "coronary", "vein", "valve", "lung", "airway", "cartilage", "liver", "capsule", "kidney", "pyramid", "brain", "deep", "fluid", "coral"}

# The order sets each group's hue in the Segments view (src/organs/segments.js).
GROUPS = [
    ("heart", "Heart and vessels", "The heart and the great arteries and veins that the scan shows."),
    ("organs", "Abdominal organs", "The solid organs of the upper abdomen."),
    ("lungs", "Lungs and airway", "The lobes of each lung and the windpipe that feeds them."),
    ("digestive", "Digestive tract", "The hollow tube that carries food, from the gullet to the large bowel."),
    ("muscles", "Muscles", "The large muscles that the segmentation covers: those of the back, the hips and the groin."),
    ("ribcage", "Ribs and sternum", "The cage that protects the heart and lungs and moves with each breath."),
    ("spine", "Spine", "The stack of vertebrae, from the neck down to the sacrum."),
    ("bones", "Skull and limb bones", "The skull, the shoulder and hip girdles, and the long bones of the arm and thigh."),
    ("urinary", "Kidneys, bladder and glands", "The urinary tract, with the glands that the segmentation names."),
    ("nerves", "Brain and spinal cord", "The central nervous system."),
    ("skin", "Body surface", "The outline of the body, from the scan itself."),
    ("other", "Other structures", "Structures that this importer has no entry for, shown under the names that the source tool gave them."),
]

# Peeling runs from the outside in. Vessels come late on purpose: in a torso the aorta and vena cava lie behind the organs, so taking them
# away early would remove almost nothing that can be seen. Taking the bowel and organs away first lays them bare.
LAYERS = [
    ("skin", "Skin", "The outer surface of the body.", ["skin"]),
    ("muscles", "Muscles", "The large muscles of the back, hips and groin.", ["muscles"]),
    ("skeleton", "Skeleton", "Ribs, spine, skull and limb bones.", ["ribcage", "spine", "bones"]),
    ("lungs", "Lungs and airway", "The lobes of the lungs and the windpipe, which hide the heart.", ["lungs"]),
    ("digestive", "Digestive tract", "The gullet, stomach and bowel.", ["digestive"]),
    ("organs", "Organs", "The liver, spleen, pancreas and kidneys, with the bladder and glands.", ["organs", "urinary", "other"]),
    ("vessels", "Heart and vessels", "The heart and great vessels, at the centre of the body.", ["heart"]),
    ("nerves", "Brain and spinal cord", "The central nervous system, the deepest layer.", ["nerves"]),
]
LAYER_OF_GROUP = {g: layer[0] for layer in LAYERS for g in layer[3]}


def entry(label, about, group, kind, **extra):
    return dict(label=label, about=about, group=group, kind=kind, **extra)


LUNG_GLASS = 0.6  # Translucent at rest, so the heart and pulmonary vessels can be seen through the lobes.
GREEN_BILE = [(0.05, 0.13, 0.03), (0.11, 0.25, 0.06), (0.24, 0.42, 0.14)]  # No kind has the green of a gallbladder.
PALE_CARTILAGE = [(0.5, 0.56, 0.58), (0.66, 0.72, 0.74), (0.82, 0.87, 0.88)]  # Keeps costal cartilage apart from the ivory of the ribs beside it.
IVORY = [(0.46, 0.38, 0.27), (0.62, 0.54, 0.41), (0.76, 0.69, 0.55)]  # The kind's own cream is a part's surface, too bright for dozens of bones at once.
BOWEL = [(0.4, 0.15, 0.13), (0.58, 0.26, 0.21), (0.74, 0.4, 0.33)]  # Between the stomach's pink and the colon's tan, so the loops do not wash out.
BONE = {"group": "bones", "kind": "cartilage", "tones": IVORY}

CLASSES = {
    "heart": entry("Heart", "A four-chambered muscular pump that drives blood around the body and through the lungs.", "heart", "muscle"),
    "atrial_appendage_left": entry("Left atrial appendage", "A small pouch off the left atrium, lying against the front of the heart.", "heart", "muscle"),
    "aorta": entry("Aorta", "The body's main artery, rising from the heart, arching over and running down in front of the spine.", "heart", "artery", vessel=True),
    "pulmonary_vein": entry("Pulmonary veins", "Bring oxygen-rich blood back from the lungs to the left atrium.", "heart", "artery", vessel=True),
    "brachiocephalic_trunk": entry("Brachiocephalic trunk", "The first large branch of the aortic arch, which divides to supply the right arm and the right side of the head.", "heart", "artery", vessel=True),
    "subclavian_artery_right": entry("Right subclavian artery", "Carries blood under the collarbone toward the right arm.", "heart", "artery", vessel=True),
    "subclavian_artery_left": entry("Left subclavian artery", "Carries blood under the collarbone toward the left arm.", "heart", "artery", vessel=True),
    "common_carotid_artery_right": entry("Right common carotid artery", "Runs up the right side of the neck, carrying blood toward the head.", "heart", "artery", vessel=True),
    "common_carotid_artery_left": entry("Left common carotid artery", "Runs up the left side of the neck, carrying blood toward the head.", "heart", "artery", vessel=True),
    "brachiocephalic_vein_left": entry("Left brachiocephalic vein", "Gathers blood from the left arm and the left side of the head, crossing the chest to the superior vena cava.", "heart", "vein", vessel=True),
    "brachiocephalic_vein_right": entry("Right brachiocephalic vein", "Gathers blood from the right arm and the right side of the head into the superior vena cava.", "heart", "vein", vessel=True),
    "superior_vena_cava": entry("Superior vena cava", "Returns blood from the upper body to the right atrium.", "heart", "vein", vessel=True),
    "inferior_vena_cava": entry("Inferior vena cava", "The largest vein, returning blood from the lower body to the right atrium.", "heart", "vein", vessel=True),
    "portal_vein_and_splenic_vein": entry("Portal and splenic veins", "Carry blood from the spleen and gut to the liver, to be processed before it rejoins the circulation.", "heart", "vein", vessel=True),
    "iliac_artery_left": entry("Left common iliac artery", "A branch of the aorta that supplies the left side of the pelvis and the left leg.", "heart", "artery", vessel=True),
    "iliac_artery_right": entry("Right common iliac artery", "A branch of the aorta that supplies the right side of the pelvis and the right leg.", "heart", "artery", vessel=True),
    "iliac_vena_left": entry("Left common iliac vein", "Drains the left leg and pelvis toward the inferior vena cava.", "heart", "vein", vessel=True),
    "iliac_vena_right": entry("Right common iliac vein", "Drains the right leg and pelvis toward the inferior vena cava.", "heart", "vein", vessel=True),
    "liver": entry("Liver", "The largest internal organ, which processes what the gut absorbs, makes bile and stores energy.", "organs", "liver"),
    "spleen": entry("Spleen", "Filters the blood and stores immune cells; it sits high on the left, under the ribs.", "organs", "pyramid"),
    "pancreas": entry("Pancreas", "Lies behind the stomach and makes digestive enzymes as well as hormones such as insulin.", "organs", "coronary"),
    "gallbladder": entry("Gallbladder", "A small sac under the liver that stores and concentrates bile.", "organs", "fluid", tones=GREEN_BILE),
    "lung_upper_lobe_left": entry("Left upper lobe", "The upper of the left lung's two lobes, which includes the part that wraps around the heart.", "lungs", "lung", glass=LUNG_GLASS),
    "lung_lower_lobe_left": entry("Left lower lobe", "The lower of the left lung's two lobes, resting on the diaphragm.", "lungs", "lung", glass=LUNG_GLASS),
    "lung_upper_lobe_right": entry("Right upper lobe", "The top of the right lung's three lobes.", "lungs", "lung", glass=LUNG_GLASS),
    "lung_middle_lobe_right": entry("Right middle lobe", "The smallest lobe, found only in the right lung, at the front.", "lungs", "lung", glass=LUNG_GLASS),
    "lung_lower_lobe_right": entry("Right lower lobe", "The lowest of the right lung's three lobes, resting on the diaphragm.", "lungs", "lung", glass=LUNG_GLASS),
    "lung_left": entry("Left lung", "The left lung, smaller than the right because it makes room for the heart.", "lungs", "lung", glass=LUNG_GLASS),
    "lung_right": entry("Right lung", "The right lung, which has three lobes.", "lungs", "lung", glass=LUNG_GLASS),
    "trachea": entry("Trachea", "The windpipe, held open by rings of cartilage, which divides into the two main bronchi.", "lungs", "airway"),
    "esophagus": entry("Esophagus", "The muscular tube that carries food from the throat to the stomach, behind the windpipe and heart.", "digestive", "airway"),
    "stomach": entry("Stomach", "A muscular bag that stores food and begins to break it down with acid and enzymes.", "digestive", "airway"),
    "duodenum": entry("Duodenum", "The first, C-shaped part of the small bowel, where bile and pancreatic juices join the food.", "digestive", "airway", tones=BOWEL),
    "small_bowel": entry("Small bowel", "The long coiled tube where most nutrients are absorbed.", "digestive", "airway", tones=BOWEL),
    "colon": entry("Colon", "The large bowel, which frames the small bowel and takes up water from what is left.", "digestive", "capsule"),
    "kidney_right": entry("Right kidney", "Filters the blood and makes urine; it usually sits a little lower than the left because of the liver above it.", "urinary", "kidney"),
    "kidney_left": entry("Left kidney", "Filters the blood and makes urine; it lies behind the abdominal organs against the back wall.", "urinary", "kidney"),
    "kidney_cyst_left": entry("Left kidney cyst", "A rounded, fluid-filled space that the tool marked in the left kidney.", "urinary", "fluid"),
    "kidney_cyst_right": entry("Right kidney cyst", "A rounded, fluid-filled space that the tool marked in the right kidney.", "urinary", "fluid"),
    "urinary_bladder": entry("Urinary bladder", "A stretchy muscular bag in the pelvis that stores urine.", "urinary", "fluid"),
    "prostate": entry("Prostate", "A gland below the male bladder, surrounding the urethra, that adds fluid to semen.", "urinary", "deep"),
    "adrenal_gland_right": entry("Right adrenal gland", "A small gland on top of the right kidney that makes hormones such as cortisol and adrenaline.", "urinary", "coronary"),
    "adrenal_gland_left": entry("Left adrenal gland", "A small gland above the left kidney that makes hormones such as cortisol and adrenaline.", "urinary", "coronary"),
    "thyroid_gland": entry("Thyroid gland", "A butterfly-shaped gland at the front of the neck whose hormones set the body's metabolic rate.", "urinary", "kidney"),
    "sternum": entry("Sternum", "The breastbone, at the front of the chest, where the upper ribs meet through their cartilage.", "ribcage", "cartilage", tones=IVORY),
    "costal_cartilages": entry("Costal cartilages", "The bars of cartilage that join the ribs to the sternum and let the chest flex with each breath.", "ribcage", "cartilage", tones=PALE_CARTILAGE),
    "sacrum": entry("Sacrum", "Fused vertebrae that form the back of the pelvis and join the spine to the hip bones.", "spine", "cartilage", tones=IVORY),
    "vertebrae": entry("Vertebrae", "The bones of the spine, shown together because this task does not tell them apart.", "spine", "cartilage", tones=IVORY),
    "intervertebral_discs": entry("Intervertebral discs", "Pads of cartilage between the vertebrae that cushion and let the spine bend.", "spine", "valve"),
    "skull": entry("Skull", "The bony case of the brain and the framework of the face.", **BONE),
    "humerus_left": entry("Left humerus", "The bone of the upper arm, whose head fits into the shoulder socket.", **BONE),
    "humerus_right": entry("Right humerus", "The bone of the upper arm, whose head fits into the shoulder socket.", **BONE),
    "scapula_left": entry("Left scapula", "The flat triangular shoulder blade, which glides over the back of the ribs.", **BONE),
    "scapula_right": entry("Right scapula", "The flat triangular shoulder blade, which glides over the back of the ribs.", **BONE),
    "clavicula_left": entry("Left clavicle", "The collarbone, a strut that holds the shoulder away from the chest.", **BONE),
    "clavicula_right": entry("Right clavicle", "The collarbone, a strut that holds the shoulder away from the chest.", **BONE),
    "femur_left": entry("Left femur", "The thigh bone, the longest in the body, whose head forms the ball of the hip joint.", **BONE),
    "femur_right": entry("Right femur", "The thigh bone, the longest in the body, whose head forms the ball of the hip joint.", **BONE),
    "hip_left": entry("Left hip bone", "Three fused bones that form one side of the pelvis and the socket of the hip joint.", **BONE),
    "hip_right": entry("Right hip bone", "Three fused bones that form one side of the pelvis and the socket of the hip joint.", **BONE),
    "gluteus_maximus_left": entry("Left gluteus maximus", "The largest buttock muscle, which straightens the hip when climbing or rising.", "muscles", "muscle"),
    "gluteus_maximus_right": entry("Right gluteus maximus", "The largest buttock muscle, which straightens the hip when climbing or rising.", "muscles", "muscle"),
    "gluteus_medius_left": entry("Left gluteus medius", "A hip muscle that keeps the pelvis level when standing on one leg.", "muscles", "muscle"),
    "gluteus_medius_right": entry("Right gluteus medius", "A hip muscle that keeps the pelvis level when standing on one leg.", "muscles", "muscle"),
    "gluteus_minimus_left": entry("Left gluteus minimus", "The smallest and deepest gluteal muscle, which helps steady the hip.", "muscles", "muscle"),
    "gluteus_minimus_right": entry("Right gluteus minimus", "The smallest and deepest gluteal muscle, which helps steady the hip.", "muscles", "muscle"),
    "autochthon_left": entry("Left deep back muscles", "The muscles that run along the spine and keep it upright.", "muscles", "muscle"),
    "autochthon_right": entry("Right deep back muscles", "The muscles that run along the spine and keep it upright.", "muscles", "muscle"),
    "iliopsoas_left": entry("Left iliopsoas", "A deep muscle running from the spine and pelvis to the thigh, which lifts the leg.", "muscles", "muscle"),
    "iliopsoas_right": entry("Right iliopsoas", "A deep muscle running from the spine and pelvis to the thigh, which lifts the leg.", "muscles", "muscle"),
    "brain": entry("Brain", "The body's control centre, made of the cerebrum, cerebellum and brainstem.", "nerves", "brain"),
    "spinal_cord": entry("Spinal cord", "The nerve cable that runs down the canal inside the spine, between the brain and the body.", "nerves", "deep"),
}

# TotalSegmentator's open body task. Wholly glass, or it would hide everything; and leave it out with --skip for any scan of a face.
SKIN_GLASS = 0.9
for name, label, about in (
    ("skin", "Skin", "The body's outer covering, as a thin shell."),
    ("body", "Body outline", "The whole outline of the body as the scan shows it."),
    ("body_trunc", "Trunk outline", "The outline of the trunk and head, without the limbs."),
    ("body_extremities", "Limb outline", "The outline of the arms and legs."),
):
    CLASSES[name] = entry(label, about, "skin", "capsule", glass=SKIN_GLASS)

VERTEBRA_ABOUT = {
    "C1": "The atlas, a ring of bone that carries the skull.",
    "C2": "The axis, whose upright peg lets the head turn.",
    "C7": "The lowest neck vertebra, whose long spine can be felt at the base of the neck.",
    "S1": "The first segment of the sacrum, where the spine meets the pelvis.",
}
for level in [f"C{i}" for i in range(1, 8)] + [f"T{i}" for i in range(1, 13)] + [f"L{i}" for i in range(1, 6)] + ["S1"]:
    about = VERTEBRA_ABOUT.get(level) or {
        "C": "A small neck vertebra, with holes in its sides for the vertebral arteries.",
        "T": "A thoracic vertebra, which carries a pair of ribs.",
        "L": "A lumbar vertebra, large because it bears the weight of the upper body.",
    }[level[0]]
    CLASSES[f"vertebrae_{level}"] = entry(f"{level} vertebra", about, "spine", "cartilage", tones=IVORY)

for number in range(1, 13):
    kind_of_rib = ("A true rib, joined to the sternum by its own cartilage." if number <= 7
                   else "A false rib, whose cartilage joins the one above it." if number <= 10
                   else "A floating rib, ending free in the muscles of the flank.")
    for side in ("left", "right"):
        CLASSES[f"rib_{side}_{number}"] = entry(f"{side.capitalize()} rib {number}", kind_of_rib, "ribcage", "cartilage", tones=IVORY)

# Lookups go through normalise(), which lowers case: TotalSegmentator writes vertebrae_T12, others write t12.
CLASSES = {name.lower(): info for name, info in CLASSES.items()}
# The panel lists parts in the table's order, so a spine runs from top to bottom as it does in the body.
ORDER = {name: i for i, name in enumerate(CLASSES)}

# For anything outside the table, so another tool's labels still get a sensible look. First match wins, so the specific words come first.
HINTS = [
    (r"cyst|effusion|fluid|ascites|bladder|csf", dict(kind="fluid", group="other")),
    (r"tumou?r|lesion|nodule|bleed|hemorrhage|haemorrhage|metasta|mass\b|cancer", dict(kind="coral", group="other")),
    (r"pulmonary_arter|lung_arter", dict(kind="pulmonary", group="heart", vessel=True)),
    (r"coronar", dict(kind="coronary", group="heart", vessel=True)),
    (r"arter|aorta|carotid", dict(kind="artery", group="heart", vessel=True)),
    (r"vein|vena|venous|jugular|vessel", dict(kind="vein", group="heart", vessel=True)),
    (r"myocard|atrium|ventricle_(left|right)|heart|cardiac", dict(kind="muscle", group="heart")),
    (r"trachea|bronch|airway|larynx|pharyn", dict(kind="airway", group="lungs")),
    (r"lung|lobe_(upper|lower|middle)", dict(kind="lung", group="lungs", glass=LUNG_GLASS)),
    (r"liver|hepat", dict(kind="liver", group="organs")),
    (r"kidney|renal", dict(kind="kidney", group="urinary")),
    (r"spleen|pancrea|gland", dict(kind="kidney", group="organs")),
    (r"stomach|bowel|colon|duoden|esophag|oesophag|rectum|intestin", dict(kind="airway", group="digestive")),
    (r"brain|cerebr|cortex|lobe|thalam|caudate|cerebell", dict(kind="brain", group="nerves")),
    (r"nerve|cord", dict(kind="deep", group="nerves")),
    (r"cartilage|disc|meniscus", dict(kind="cartilage", group="bones")),
    (r"(^|_)ribs?(_|$)|sternum", dict(kind="cartilage", group="ribcage", tones=IVORY)),
    (r"vertebra|sacrum|spine", dict(kind="cartilage", group="spine", tones=IVORY)),
    (r"bone|femur|tibia|fibula|humerus|radius|ulna|skull|mandible|jaw|teeth|tooth|patella|scapula|clavic|hip|pelvis|tarsal|carpal", dict(kind="cartilage", group="bones", tones=IVORY)),
    (r"tissue|(^|_)fat(_|$)|skin|(^|_)body(_|$)", dict(kind="capsule", group="skin", glass=SKIN_GLASS)),  # Anything this large around the rest would hide it.
    (r"muscle|gluteus|psoas|rectus|oblique|pectoralis|trapezius|deltoid|masseter|quadriceps|tongue", dict(kind="muscle", group="muscles")),
]
GENERIC_KIND = "deep"


def normalise(name):
    """'Left Kidney' and 'left-kidney' are spelled as the table spells them: kidney_left."""
    n = re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")
    m = re.match(r"^(left|right)_(.+)$", n)
    return f"{m.group(2)}_{m.group(1)}" if m else n


def pretty(name):
    words = re.sub(r"[_\-]+", " ", name).strip()
    return words[:1].upper() + words[1:]


def describe(name, overrides=None):
    """A structure's entry, whatever its name: from the table when it is known, else a guess from its words with a generic kind as the last resort."""
    key = normalise(name)
    if key in CLASSES:
        info = dict(CLASSES[key])
    else:
        info = dict(label=pretty(name), about=f"A structure the source tool labelled \"{pretty(name).lower()}\".", group="other", kind=GENERIC_KIND)
        for pattern, hint in HINTS:
            if re.search(pattern, key):
                info.update(hint)
                break
    info.update(overrides or {})
    if info["kind"] not in KINDS:
        raise SystemExit(f"{name}: kind {info['kind']} is not in the model contract; a new kind needs an entry in src/organs/scene.js")
    return info
