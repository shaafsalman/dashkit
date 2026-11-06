// What a manifest offers, in one place. Every control reads these, so a control with nothing to act on simply does not appear,
// for an organ, a whole body or an imported scan alike.

/** The layers to peel, outermost first. A manifest without `layers` falls back to its groups. */
export function layersOf(manifest) {
  if (!manifest) return [];
  const known = new Set((manifest.parts ?? []).map((p) => p.id));
  const raw = manifest.layers?.length
    ? manifest.layers
    : (manifest.groups ?? []).map((g) => ({ id: g.id, label: g.label, about: g.about, parts: (manifest.parts ?? []).filter((p) => p.group === g.id).map((p) => p.id) }));
  return raw.map((l) => ({ ...l, parts: (l.parts ?? []).filter((id) => known.has(id)) })).filter((l) => l.parts.length);
}

/**
 * Turns the peel count and the eye toggles into what is hidden. A layer flagged `off` starts peeled away and does not count as
 * one of the peel steps. Whatever lies under a peeled layer drops its glass, to `layer.glass` or to none, so it reads solid.
 */
export function layerPlan(layers, peel, flipped) {
  const peelable = layers.filter((l) => !l.off);
  const peeled = new Set(peelable.slice(0, peel).map((l) => l.id));
  const states = layers.map((l) => {
    const base = !l.off && !peeled.has(l.id);
    return { ...l, visible: flipped?.has(l.id) ? !base : base };
  });
  const hidden = new Set();
  const restGlass = new Map();
  let opened = false;
  for (const l of states) {
    if (!l.visible) {
      l.parts.forEach((id) => hidden.add(id));
      if (!l.off) opened = true;
      continue;
    }
    if (opened) l.parts.forEach((id) => restGlass.set(id, l.glass ?? 0));
  }
  return { states, hidden, restGlass, maxPeel: Math.max(0, peelable.length - 1) };
}

export function capabilitiesOf(manifest) {
  const parts = manifest?.parts ?? [];
  const composite = parts.some((p) => p.organ);
  return {
    flows: (manifest?.flows?.length ?? 0) > 0,
    gates: (manifest?.gates?.length ?? 0) > 0,
    pins: (manifest?.pins?.length ?? 0) > 0,
    layers: layersOf(manifest).length > 1,
    pulse: composite ? parts.some((p) => p.organ === "heart" || p.organ === "lungs") : !!manifest?.pulse,
    pulseKind: manifest?.pulse ?? (parts.some((p) => p.organ === "heart") ? "heart" : parts.some((p) => p.organ === "lungs") ? "breath" : null),
    organLinks: parts.some((p) => p.organ),
  };
}
