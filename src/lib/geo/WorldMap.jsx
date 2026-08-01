import React, { useState, useEffect, useMemo, useRef } from "react";
import { isDarkMode } from "../../isDarkMode";
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  Line,
  Marker,
  Sphere,
  ZoomableGroup,
} from "react-simple-maps";
import {
  Move,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
  Plane,
  Radio,
} from "lucide-react";
import { colors } from "./colorConfig";
import {
  GEO_URL,
  formatNumber,
  getTextSize,
  processRouteData,
  matchCountryToGeo,
  buildRouteArcs,
  defaultMapStats,
} from "./WorldMapHelper";

// Somalia + Somaliland are rendered as a single landmass in this brand green.
const SOMALIA_COLOR = "#058B4C";

// Airport code labels only appear once you've zoomed past this, so the
// East-Africa cluster stays readable at the default view.
const AIRPORT_LABEL_ZOOM = 3.2;

// Two flat, shadowless palettes. Colours are resolved in JS rather than CSS
// variables because SVG presentation attributes can't read var().
const PALETTES = {
  // Light mode: pale land against a cool blue ocean, so water and land read
  // apart instantly and the brand-coloured countries stay the focal point.
  light: {
    shell: "#e9eff6",
    oceanTop: "#e9f2fa",
    oceanBottom: "#d5e5f2",
    sphereStroke: "rgba(15, 23, 42, 0.16)",
    land: "#f2f4f7",
    landStroke: "#9fb0c4",
    graticule: "rgba(15, 23, 42, 0.06)",
    grid: "rgba(15, 23, 42, 0.028)",
    text: "#0b1220",
    textMuted: "#48566b",
    textFaint: "#6b7a90",
    panel: "rgba(255, 255, 255, 0.95)",
    panelSolid: "#ffffff",
    panelBorder: "rgba(15, 23, 42, 0.14)",
    shellBorder: "rgba(15, 23, 42, 0.14)",
    divider: "rgba(15, 23, 42, 0.12)",
    track: "rgba(15, 23, 42, 0.11)",
    rowBg: "rgba(15, 23, 42, 0.04)",
    rowBorder: "rgba(15, 23, 42, 0.09)",
    activeStroke: "#0b1220",
    hoverBg: "rgba(15, 23, 42, 0.07)",
    arc: "#0f766e",
    arcSoft: "rgba(15, 118, 110, 0.26)",
    pulse: "#0b3f3a",
    accent: "#0f766e",
    accentBg: "rgba(15, 118, 110, 0.13)",
    accentBorder: "rgba(15, 118, 110, 0.35)",
  },
  dark: {
    shell: "#0c0c0e",
    oceanTop: "#17171b",
    oceanBottom: "#0e0e11",
    sphereStroke: "rgba(255, 255, 255, 0.1)",
    land: "#26262b",
    landStroke: "#3d3d44",
    graticule: "rgba(255, 255, 255, 0.055)",
    grid: "rgba(255, 255, 255, 0.035)",
    text: "#f4f4f5",
    textMuted: "#a1a1aa",
    textFaint: "#8b8b93",
    panel: "rgba(21, 21, 24, 0.94)",
    panelSolid: "#151518",
    panelBorder: "rgba(255, 255, 255, 0.11)",
    shellBorder: "rgba(255, 255, 255, 0.09)",
    divider: "rgba(255, 255, 255, 0.1)",
    track: "rgba(255, 255, 255, 0.11)",
    rowBg: "rgba(255, 255, 255, 0.04)",
    rowBorder: "rgba(255, 255, 255, 0.07)",
    activeStroke: "#fafafa",
    hoverBg: "rgba(255, 255, 255, 0.07)",
    arc: "#2dd4bf",
    arcSoft: "rgba(45, 212, 191, 0.26)",
    pulse: "#ccfbf1",
    accent: "#2dd4bf",
    accentBg: "rgba(45, 212, 191, 0.15)",
    accentBorder: "rgba(45, 212, 191, 0.35)",
  },
};

// Follows the APP theme (class-based dark mode, driven by useTheme's stored
// "theme" key), NOT the OS colour scheme — the rest of the app ignores
// prefers-color-scheme and toggles via the .dark class, so the map must too,
// or it renders dark while the app is in light mode (and vice versa).
const useIsDarkMode = () => isDarkMode();

// Resolve a geography to the country key used in countryData, honouring the
// Somaliland-is-Somalia and United-Arab-Emirates-is-UAE exceptions.
const geoCountryName = (geo, countryData) => {
  if (!geo) return null;
  const name = geo.properties.name;
  if (name === "Somalia" || name === "Somaliland") return "Somalia";
  if (name === "United Arab Emirates") return "UAE";
  const match = matchCountryToGeo(geo, countryData);
  return match ? match.name : null;
};

const WorldMap = ({ allCities, isMobile = false }) => {
  // State management
  const [hoveredGeo, setHoveredGeo] = useState(null);
  const [clickedGeo, setClickedGeo] = useState(null);
  const [position, setPosition] = useState({
    coordinates: [40, 10],
    zoom: 2.5,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [countryData, setCountryData] = useState({});
  const [mapStats, setMapStats] = useState(defaultMapStats());
  // Presentation-only state: route layer visibility + legend hover emphasis.
  const [showRoutes, setShowRoutes] = useState(true);
  const [focusedCountry, setFocusedCountry] = useState(null);
  // Ensures the default Somalia lock only happens once.
  const didLock = useRef(false);

  const isDark = useIsDarkMode();
  const t = isDark ? PALETTES.dark : PALETTES.light;

  // Process route data on initial load and when allCities changes
  useEffect(() => {
    const { countryData: processedData, mapStats: processedStats } =
      processRouteData(allCities);
    setCountryData(processedData);
    setMapStats(processedStats);
  }, [allCities]);

  // Flight arcs are a purely visual layer derived from the same route feed.
  const routeArcs = useMemo(() => buildRouteArcs(allCities), [allCities]);

  // Map interaction handlers
  const handleCountryClick = (geo) => {
    const country = matchCountryToGeo(geo, countryData);
    if (country) {
      if (clickedGeo && clickedGeo.rsmKey === geo.rsmKey) {
        setClickedGeo(null);
      } else {
        setClickedGeo(geo);
        setPosition({
          coordinates: country.coordinates,
          zoom: 4,
        });
      }
    }
  };

  const handleZoomIn = () =>
    setPosition((pos) => ({
      ...pos,
      zoom: Math.min(pos.zoom * 1.2, 8),
    }));

  const handleZoomOut = () =>
    setPosition((pos) => ({
      ...pos,
      zoom: Math.max(pos.zoom / 1.2, 1),
    }));

  const handleReset = () => {
    setPosition({ coordinates: [40, 10], zoom: 2.5 });
    setClickedGeo(null);
  };

  // Current country to display in info panel
  const currentDisplayGeo = hoveredGeo || clickedGeo;

  const legendCountries = useMemo(
    () =>
      Object.values(countryData).sort(
        (a, b) => b.totalPassengers - a.totalPassengers,
      ),
    [countryData],
  );

  // Whichever country the cursor is on — from the map or from the legend.
  // Drives the two-way highlight between the legend rows and the map.
  const hoveredCountryName = geoCountryName(hoveredGeo, countryData);
  const clickedCountryName = geoCountryName(clickedGeo, countryData);
  const activeCountry =
    focusedCountry || hoveredCountryName || clickedCountryName;

  // Legend hover isolates one country; map hover only brightens it.
  const isDimmed = (name) => focusedCountry && focusedCountry !== name;
  const isLit = (name) => name && activeCountry === name;

  const showAirportCodes = position.zoom >= AIRPORT_LABEL_ZOOM;

  // Everything inside ZoomableGroup is scaled by the current zoom, so badges
  // and markers are counter-scaled to keep a constant on-screen size. Strokes
  // use vector-effect instead, which the browser handles for us.
  const zs = 2.5 / position.zoom;

  // Nudge colliding value badges apart in latitude, then draw an arrow back to
  // the country so the link is never ambiguous. Busiest country keeps its spot.
  const badgeOffsets = useMemo(() => {
    const placed = [];
    const offsets = {};

    Object.values(countryData)
      .slice()
      .sort((a, b) => b.totalPassengers - a.totalPassengers)
      .forEach((country) => {
        if (!country.coordinates) {
          offsets[country.name] = 0;
          return;
        }
        const [lon, lat] = country.coordinates;
        const collides = (dy) =>
          placed.some(
            (p) =>
              Math.abs(p.lon - lon) < 7 && Math.abs(p.lat - (lat + dy)) < 4.5,
          );

        const dy = [0, -5, 5, -10, 10].find((d) => !collides(d)) ?? 0;
        placed.push({ lon, lat: lat + dy });
        offsets[country.name] = dy;
      });

    return offsets;
  }, [countryData]);

  const departShare = mapStats.totalPassengers
    ? (mapStats.totalDepartingPassengers / mapStats.totalPassengers) * 100
    : 0;
  const arriveShare = mapStats.totalPassengers
    ? (mapStats.totalArrivingPassengers / mapStats.totalPassengers) * 100
    : 0;

  const panelStyle = {
    background: t.panel,
    borderColor: t.panelBorder,
  };

  const labelStyle = {
    color: t.textMuted,
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  };

  return (
    <div
      className="h-full min-h-[350px] overflow-hidden relative border wm-root"
      style={{ background: t.shell, borderColor: t.shellBorder }}
    >
      {/* Fine coordinate grid for depth — no glows, no vignette */}
      <div
        className="absolute inset-0 pointer-events-none wm-grid"
        style={{ "--wm-grid": t.grid }}
      />

      {/* Main Map */}
      <ComposableMap
        projection="geoEqualEarth"
        width={800}
        height={350}
        style={{
          width: "100%",
          height: "100%",
          background: "transparent",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => {
          setIsDragging(false);
          setHoveredGeo(null);
        }}
      >
        <defs>
          <linearGradient id="wm-ocean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.oceanTop} />
            <stop offset="100%" stopColor={t.oceanBottom} />
          </linearGradient>

          {/* One arrowhead per country colour, for the badge leader lines */}
          {legendCountries.map((country, i) => (
            <marker
              key={`arrow-${country.name}`}
              id={`wm-arrow-${i}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
              markerUnits="strokeWidth"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill={country.color} />
            </marker>
          ))}
        </defs>

        <ZoomableGroup
          zoom={position.zoom}
          center={position.coordinates}
          onMoveEnd={setPosition}
        >
          {/* Globe body + coordinate grid */}
          <Sphere
            id="wm-sphere"
            fill="url(#wm-ocean)"
            stroke={t.sphereStroke}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <Graticule
            stroke={t.graticule}
            strokeWidth={1}
            step={[12, 12]}
            vectorEffect="non-scaling-stroke"
          />

          {/* Countries */}
          <Geographies geography={GEO_URL}>
            {({ geographies }) => {
              // Lock Somalia by default on first load: once the geographies
              // AND the processed country data are both ready, click Somalia
              // (shows its info panel + "Locked" badge) and zoom to it.
              // Deferred out of the render phase; no-op afterwards.
              if (!didLock.current) {
                const somGeo = geographies.find((g) => g.properties.name === "Somalia");
                const somData = countryData.Somalia;
                if (somGeo && somData) {
                  didLock.current = true;
                  setTimeout(() => {
                    setClickedGeo(somGeo);
                    setPosition({ coordinates: somData.coordinates || [40, 10], zoom: 4 });
                  }, 0);
                }
              }
              return geographies.map((geo) => {
                // Special case for Somalia and Somaliland - treat as one country without internal border
                if (
                  geo.properties.name === "Somalia" ||
                  geo.properties.name === "Somaliland"
                ) {
                  const somaliaMatch = Object.values(countryData).find(
                    (c) => c.name === "Somalia" || c.originalName === "Somalia",
                  );

                  const hasData = !!somaliaMatch;
                  const isClicked =
                    clickedGeo &&
                    (clickedGeo.properties.name === "Somalia" ||
                      clickedGeo.properties.name === "Somaliland");
                  const lit = isLit("Somalia");
                  const dimmed = isDimmed("Somalia");

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={SOMALIA_COLOR}
                      // Stroke matches the fill so the Somalia/Somaliland border
                      // never shows; selection is shown with a contrast outline.
                      stroke={lit ? t.activeStroke : SOMALIA_COLOR}
                      strokeWidth={isClicked ? 1.8 : lit ? 1.4 : 0.8}
                      vectorEffect="non-scaling-stroke"
                      onMouseEnter={() => {
                        // When hovering either Somalia or Somaliland, set both as hovered
                        // First find a reference to Somalia proper
                        const somaliaPart = geographies.find(
                          (g) => g.properties.name === "Somalia",
                        );
                        // Set the actual hovered geometry
                        setHoveredGeo(somaliaPart || geo);
                      }}
                      onMouseLeave={() => setHoveredGeo(null)}
                      style={{
                        default: {
                          outline: "none",
                          fillOpacity: dimmed
                            ? 0.22
                            : lit
                              ? 1
                              : hasData
                                ? 0.9
                                : 0.7,
                          transition: "all 220ms",
                        },
                        hover: {
                          outline: "none",
                          fillOpacity: 1,
                          cursor: "pointer",
                          transition: "all 220ms",
                        },
                        pressed: {
                          outline: "none",
                          fillOpacity: 1,
                          transition: "all 220ms",
                        },
                      }}
                      onClick={() => {
                        // Use a consistent click handler
                        const somaliaGeo =
                          geographies.find(
                            (g) => g.properties.name === "Somalia",
                          ) || geo;
                        handleCountryClick(somaliaGeo);
                      }}
                    />
                  );
                }

                // Special case for UAE
                const isUAE = geo.properties.name === "United Arab Emirates";
                const uaeData = Object.values(countryData).find(
                  (c) => c.name === "UAE",
                );

                // For all other countries
                const countryMatch = matchCountryToGeo(geo, countryData);
                const hasData = !!countryMatch;
                const isClicked =
                  clickedGeo && clickedGeo.rsmKey === geo.rsmKey;
                const hasFill = hasData || isUAE;
                const key = isUAE
                  ? "UAE"
                  : countryMatch
                    ? countryMatch.name
                    : null;
                const lit = isLit(key);
                const dimmed = isDimmed(key);
                const dataColor = isUAE
                  ? uaeData?.color || t.land
                  : hasData
                    ? countryMatch.color
                    : t.land;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={dataColor}
                    stroke={
                      lit && hasFill
                        ? t.activeStroke
                        : hasFill
                          ? dataColor
                          : t.landStroke
                    }
                    strokeWidth={isClicked ? 1.8 : lit ? 1.4 : 0.7}
                    vectorEffect="non-scaling-stroke"
                    onMouseEnter={() => setHoveredGeo(geo)}
                    onMouseLeave={() => setHoveredGeo(null)}
                    style={{
                      default: {
                        outline: "none",
                        fillOpacity: dimmed
                          ? 0.2
                          : lit
                            ? 1
                            : hasFill
                              ? 0.9
                              : 1,
                        transition: "all 220ms",
                      },
                      hover: {
                        outline: "none",
                        fillOpacity: 1,
                        cursor: hasFill ? "pointer" : "grab",
                        transition: "all 220ms",
                      },
                      pressed: {
                        outline: "none",
                        fillOpacity: 1,
                        transition: "all 220ms",
                      },
                    }}
                    onClick={() => {
                      if (hasData || isUAE) {
                        handleCountryClick(geo);
                      }
                    }}
                  />
                );
              })
            }
            }
          </Geographies>

          {/* Flight Routes - animated trails between airports */}
          {showRoutes &&
            routeArcs.map((arc) => {
              // Screen-space widths, so routes stay elegant at every zoom.
              const width = 1.1 + arc.weight * 1.5;
              const pathId = `wm-arc-${arc.id}`;
              return (
                <g key={pathId}>
                  {/* Crisp translucent base — a wider stroke, not a blur */}
                  <Line
                    coordinates={arc.coordinates}
                    strokeWidth={width * 2.6}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    style={{ stroke: t.arcSoft, fill: "none" }}
                  />
                  {/* Animated dashed trail */}
                  <Line
                    id={pathId}
                    coordinates={arc.coordinates}
                    strokeWidth={width}
                    strokeLinecap="round"
                    strokeDasharray="5 7"
                    vectorEffect="non-scaling-stroke"
                    className="wm-arc-dash"
                    style={{
                      stroke: t.arc,
                      fill: "none",
                      opacity: 0.65 + arc.weight * 0.35,
                      animationDelay: `${arc.index * 0.24}s`,
                    }}
                  />
                  {/* Travelling pulse riding the same path */}
                  <circle r={(0.5 + arc.weight * 0.3) * zs} fill={t.pulse}>
                    <animateMotion
                      dur={`${5.2 - arc.weight * 1.8}s`}
                      begin={`${arc.index * 0.45}s`}
                      repeatCount="indefinite"
                      rotate="auto"
                    >
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  </circle>
                </g>
              );
            })}

          {/* Arrowed leader lines from a nudged badge back to its country */}
          {legendCountries.map((country, i) => {
            const dy = badgeOffsets[country.name] || 0;
            if (!dy || !country.coordinates) return null;
            const lit = isLit(country.name);
            return (
              <Line
                key={`leader-${country.name}`}
                from={[country.coordinates[0], country.coordinates[1] + dy]}
                to={country.coordinates}
                strokeWidth={lit ? 1.8 : 1.1}
                vectorEffect="non-scaling-stroke"
                markerEnd={`url(#wm-arrow-${i})`}
                style={{
                  stroke: country.color,
                  fill: "none",
                  opacity: isDimmed(country.name) ? 0.2 : lit ? 1 : 0.7,
                  transition: "opacity 220ms",
                }}
              />
            );
          })}

          {/* Value badges — the name lives in the legend, so only the number
              sits on the map. Keeps the cluster readable. */}
          {legendCountries.map((country) => {
            if (!country.coordinates) return null;
            const dy = badgeOffsets[country.name] || 0;
            const lit = isLit(country.name);
            const value = formatNumber(country.departingPassengers);
            const size = getTextSize(position.zoom);
            // Pinned with textLength, so the badge can never be outgrown.
            const textW = value.length * size * 0.62;
            const badgeW = textW + 5.4;
            const badgeH = size + 4.6;

            return (
              <Marker
                key={`badge-${country.name}`}
                coordinates={[
                  country.coordinates[0],
                  country.coordinates[1] + dy,
                ]}
              >
                <g
                  transform={`scale(${zs})`}
                  style={{
                    opacity: isDimmed(country.name) ? 0.22 : 1,
                    transition: "opacity 220ms",
                    pointerEvents: "none",
                  }}
                >
                  <rect
                    x={-badgeW / 2}
                    y={-badgeH / 2}
                    width={badgeW}
                    height={badgeH}
                    rx={0}
                    fill={lit ? country.color : t.panelSolid}
                    stroke={country.color}
                    strokeWidth={lit ? 2 : 1.3}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="central"
                    textLength={textW}
                    lengthAdjust="spacing"
                    style={{
                      fill: lit ? t.panelSolid : t.text,
                      fontSize: `${size}px`,
                      fontWeight: 800,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {value}
                  </text>
                </g>
              </Marker>
            );
          })}

          {/* Airport Markers - pulsing beacons */}
          {Object.values(countryData).flatMap((country) =>
            country.cities.map((city, cityIndex) => (
              <Marker
                key={`airport-${city.code}`}
                coordinates={city.coordinates}
              >
                <g
                  transform={`scale(${zs})`}
                  style={{
                    opacity: isDimmed(country.name) ? 0.22 : 1,
                    transition: "opacity 220ms",
                  }}
                >
                  {/* Expanding radar ping */}
                  <circle
                    className="wm-ping"
                    r={1}
                    fill="none"
                    stroke={country.color}
                    strokeWidth={0.18}
                    style={{ animationDelay: `${cityIndex * 0.35}s` }}
                  />
                  {/* Airport dot */}
                  <circle
                    r={0.55}
                    fill={t.panelSolid}
                    stroke={country.color}
                    strokeWidth={0.38}
                  />

                  {/* Airport code — revealed once zoomed in */}
                  {showAirportCodes && (
                    <text
                      textAnchor="middle"
                      y={-2.1}
                      style={{
                        fill: t.text,
                        stroke: t.panelSolid,
                        strokeWidth: 0.55,
                        paintOrder: "stroke",
                        strokeLinejoin: "round",
                        fontSize: "2.4px",
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        pointerEvents: "none",
                      }}
                    >
                      {city.code}
                    </text>
                  )}
                </g>
              </Marker>
            )),
          )}
        </ZoomableGroup>
      </ComposableMap>

      {/* Left rail: live status + country legend. Hovering a row lights up that
          country, its arrow and its badge on the map. */}
      <div
        className={`absolute top-3 left-3 bottom-[4.25rem] w-[152px] backdrop-blur-md border flex flex-col overflow-hidden ${
          isMobile ? "hidden" : "flex"
        }`}
        style={panelStyle}
      >
        <div
          className="flex items-center gap-2 px-2.5 py-2 border-b shrink-0"
          style={{ borderColor: t.divider }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full wm-live-ping"
              style={{ background: t.accent }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 "
              style={{ background: t.accent }}
            />
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: t.accent }}
          >
            Live
          </span>
          <span
            className="ml-auto text-[10px] font-semibold tabular-nums"
            style={{ color: t.textMuted }}
          >
            {routeArcs.length} routes
          </span>
        </div>

        <div className="px-2.5 pt-2 pb-1 shrink-0" style={labelStyle}>
          Departures
        </div>

        <div className="flex-1 overflow-y-auto px-1.5 pb-1.5 wm-scroll">
          {legendCountries.length === 0 ? (
            <div
              className="px-1 py-1 text-[11px]"
              style={{ color: t.textFaint }}
            >
              No route data
            </div>
          ) : (
            legendCountries.map((country) => {
              const lit = isLit(country.name);
              return (
                <button
                  key={`legend-${country.name}`}
                  onMouseEnter={() => setFocusedCountry(country.name)}
                  onMouseLeave={() => setFocusedCountry(null)}
                  className="w-full flex items-center gap-1.5 px-1.5 py-1 transition-colors duration-200 wm-row"
                  style={{
                    background: lit ? t.hoverBg : "transparent",
                    borderLeft: `2px solid ${lit ? country.color : "transparent"}`,
                  }}
                  title={`${country.name} — ${formatNumber(
                    country.totalPassengers,
                  )} total passengers`}
                >
                  <span
                    className="h-2 w-2 shrink-0"
                    style={{ backgroundColor: country.color }}
                  />
                  <span
                    className="text-[11px] font-semibold truncate"
                    style={{ color: lit ? t.text : t.textMuted }}
                  >
                    {country.name}
                  </span>
                  <span
                    className="ml-auto text-[11px] font-extrabold tabular-nums shrink-0"
                    style={{ color: t.text }}
                  >
                    {formatNumber(country.departingPassengers)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Map Controls */}
      <div
        className="absolute top-3 right-3 flex items-center gap-1 p-1 backdrop-blur-md border"
        style={panelStyle}
      >
        <button
          className="w-7 h-7 flex items-center justify-center transition-colors duration-200 wm-btn"
          onClick={() => setShowRoutes((v) => !v)}
          title={showRoutes ? "Hide flight routes" : "Show flight routes"}
          style={
            showRoutes
              ? {
                  background: t.accentBg,
                  color: t.accent,
                  border: `1px solid ${t.accentBorder}`,
                }
              : { color: t.textMuted, border: "1px solid transparent" }
          }
        >
          <Plane size={14} />
        </button>
        <span
          className="w-px h-5"
          style={{ background: t.divider }}
          aria-hidden="true"
        />
        <button
          className="w-7 h-7 flex items-center justify-center transition-colors duration-200 wm-btn group"
          onClick={handleZoomIn}
          title="Zoom In"
          style={{ color: t.textMuted }}
        >
          <ZoomIn
            size={14}
            className="group-hover:scale-110 transition-transform"
          />
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center transition-colors duration-200 wm-btn group"
          onClick={handleZoomOut}
          title="Zoom Out"
          style={{ color: t.textMuted }}
        >
          <ZoomOut
            size={14}
            className="group-hover:scale-110 transition-transform"
          />
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center transition-colors duration-200 wm-btn group"
          onClick={handleReset}
          title="Reset view"
          style={{ color: t.textMuted }}
        >
          <Move
            size={14}
            className="group-hover:rotate-45 transition-transform"
          />
        </button>
      </div>

      {/* Global Statistics Panel */}
      <div
        className="absolute bottom-3 left-3 right-3 backdrop-blur-md border px-3 py-2 flex items-center gap-3 overflow-hidden"
        style={panelStyle}
      >
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <Radio size={13} style={{ color: t.accent }} />
          <span className="hidden md:inline" style={labelStyle}>
            Traffic
          </span>
        </div>

        <span
          className="hidden sm:block w-px self-stretch shrink-0"
          style={{ background: t.divider }}
          aria-hidden="true"
        />

        {/* Total passengers */}
        <div className="shrink-0">
          <div style={labelStyle}>Total</div>
          <div
            className="text-base font-extrabold tabular-nums leading-tight"
            style={{ color: t.text }}
          >
            {formatNumber(mapStats.totalPassengers)}
          </div>
        </div>

        {/* Departures */}
        <div className="flex-1 min-w-[72px]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1">
              <ArrowUp size={11} style={{ color: colors.green[500] }} />
              <span style={labelStyle}>Dep</span>
            </div>
            <span
              className="text-xs font-extrabold tabular-nums"
              style={{ color: isDark ? colors.green[400] : colors.green[700] }}
            >
              {formatNumber(mapStats.totalDepartingPassengers)}
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden"
            style={{ background: t.track }}
          >
            <div
              className="h-full wm-bar"
              style={{
                width: `${departShare}%`,
                background: `linear-gradient(90deg, ${colors.green[600]}, ${colors.green[400]})`,
              }}
            />
          </div>
        </div>

        {/* Arrivals */}
        <div className="flex-1 min-w-[72px]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1">
              <ArrowDown size={11} style={{ color: colors.blue[500] }} />
              <span style={labelStyle}>Arr</span>
            </div>
            <span
              className="text-xs font-extrabold tabular-nums"
              style={{ color: isDark ? colors.blue[400] : colors.blue[700] }}
            >
              {formatNumber(mapStats.totalArrivingPassengers)}
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden"
            style={{ background: t.track }}
          >
            <div
              className="h-full wm-bar"
              style={{
                width: `${arriveShare}%`,
                background: `linear-gradient(90deg, ${colors.blue[600]}, ${colors.blue[400]})`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Country Info Popup */}
      {currentDisplayGeo && (
        <div
          className="absolute top-14 right-3 w-[236px] max-h-[calc(100%-8rem)] backdrop-blur-xl border p-3 overflow-y-auto wm-panel wm-scroll"
          style={{ ...panelStyle, "--wm-thumb": t.divider }}
        >
          {(() => {
            // Special handling for UAE and Somalia (including Somaliland)
            let countryMatch = matchCountryToGeo(
              currentDisplayGeo,
              countryData,
            );

            // Handle Somaliland as part of Somalia with custom color
            if (
              currentDisplayGeo.properties.name === "Somaliland" ||
              currentDisplayGeo.properties.name === "Somalia"
            ) {
              countryMatch = Object.values(countryData).find(
                (c) => c.name === "Somalia",
              );
              if (countryMatch) {
                countryMatch.color = SOMALIA_COLOR; // Apply custom color
              }
            }

            // Handle UAE
            if (currentDisplayGeo.properties.name === "United Arab Emirates") {
              countryMatch = Object.values(countryData).find(
                (c) => c.name === "UAE",
              );
            }

            if (countryMatch) {
              // Calculate percentages for visual indicators
              const totalPax = countryMatch.totalPassengers || 1; // Avoid div by zero
              const departPercentage =
                (countryMatch.departingPassengers / totalPax) * 100;
              const arrivePercentage =
                (countryMatch.arrivingPassengers / totalPax) * 100;

              // Display country name (handle special cases)
              let displayCountryName = currentDisplayGeo.properties.name;
              if (currentDisplayGeo.properties.name === "Somaliland") {
                displayCountryName = "Somalia";
              } else if (
                currentDisplayGeo.properties.name === "United Arab Emirates"
              ) {
                displayCountryName = "UAE";
              }

              return (
                <>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0"
                        style={{ backgroundColor: countryMatch.color }}
                      />
                      <h3
                        className="font-extrabold text-sm uppercase tracking-[0.08em] truncate"
                        style={{ color: t.text }}
                      >
                        {displayCountryName}
                      </h3>
                    </div>
                    {clickedGeo &&
                      clickedGeo.rsmKey === currentDisplayGeo.rsmKey && (
                        <span
                          className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] border shrink-0"
                          style={{
                            background: t.accentBg,
                            color: t.accent,
                            borderColor: t.accentBorder,
                          }}
                        >
                          Locked
                        </span>
                      )}
                  </div>

                  <div
                    className="mb-3 px-2 py-2 text-center border"
                    style={{
                      background: t.rowBg,
                      borderColor: t.rowBorder,
                    }}
                  >
                    <div
                      className="text-2xl font-extrabold tabular-nums leading-none"
                      style={{ color: t.text }}
                    >
                      {formatNumber(countryMatch.totalPassengers)}
                    </div>
                    <div className="mt-1.5" style={labelStyle}>
                      Total Passengers
                    </div>
                  </div>

                  {/* Traffic flow visualization with colorful bars */}
                  <div className="space-y-2.5 mb-3">
                    {/* Departures bar */}
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1">
                          <ArrowUp
                            size={11}
                            style={{ color: colors.green[500] }}
                          />
                          <span style={labelStyle}>Departures</span>
                        </div>
                        <div
                          className="text-[11px] font-extrabold tabular-nums px-1.5 py-0.5"
                          style={{
                            backgroundColor: isDark
                              ? "rgba(34,197,94,0.16)"
                              : colors.green[100],
                            color: isDark
                              ? colors.green[300]
                              : colors.green[800],
                          }}
                        >
                          {formatNumber(countryMatch.departingPassengers)}
                        </div>
                      </div>
                      <div
                        className="h-1.5 w-full overflow-hidden"
                        style={{ background: t.track }}
                      >
                        <div
                          className="h-full "
                          style={{
                            width: `${departPercentage}%`,
                            background: `linear-gradient(90deg, ${colors.green[600]}, ${colors.green[400]})`,
                            transition: "width 0.5s ease-out",
                          }}
                        />
                      </div>
                    </div>

                    {/* Arrivals bar */}
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1">
                          <ArrowDown
                            size={11}
                            style={{ color: colors.blue[500] }}
                          />
                          <span style={labelStyle}>Arrivals</span>
                        </div>
                        <div
                          className="text-[11px] font-extrabold tabular-nums px-1.5 py-0.5"
                          style={{
                            backgroundColor: isDark
                              ? "rgba(14,165,233,0.16)"
                              : colors.blue[100],
                            color: isDark ? colors.blue[300] : colors.blue[800],
                          }}
                        >
                          {formatNumber(countryMatch.arrivingPassengers)}
                        </div>
                      </div>
                      <div
                        className="h-1.5 w-full overflow-hidden"
                        style={{ background: t.track }}
                      >
                        <div
                          className="h-full "
                          style={{
                            width: `${arrivePercentage}%`,
                            background: `linear-gradient(90deg, ${colors.blue[600]}, ${colors.blue[400]})`,
                            transition: "width 0.5s ease-out",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Airport Details */}
                  {countryMatch.cities.length > 0 && (
                    <>
                      <div
                        className="mb-2 pt-2 border-t"
                        style={{
                          ...labelStyle,
                          color: t.textFaint,
                          borderColor: t.divider,
                        }}
                      >
                        Airports
                      </div>
                      <div className="space-y-2">
                        {countryMatch.cities.map((city) => {
                          // Calculate airport traffic percentages
                          const cityTotal = city.totalPassengers || 1;
                          const cityDepartPerc =
                            (city.departingPassengers / cityTotal) * 100;
                          const cityArrivePerc =
                            (city.arrivingPassengers / cityTotal) * 100;

                          return (
                            <div
                              key={city.code}
                              className="flex flex-col border px-2 py-1.5"
                              style={{
                                background: t.rowBg,
                                borderColor: t.rowBorder,
                              }}
                            >
                              <div className="flex justify-between items-center gap-2">
                                <div
                                  className="font-bold text-[11px] truncate"
                                  style={{ color: t.text }}
                                >
                                  {city.name}
                                  <span
                                    className="ml-1 font-semibold"
                                    style={{ color: t.textFaint }}
                                  >
                                    {city.code}
                                  </span>
                                </div>
                                <div
                                  className="text-[11px] font-extrabold tabular-nums shrink-0"
                                  style={{ color: t.text }}
                                >
                                  {formatNumber(city.totalPassengers)}
                                </div>
                              </div>
                              <div
                                className="flex mt-1.5 gap-0.5 h-1.5 overflow-hidden"
                                style={{ background: t.track }}
                              >
                                {/* Mini bars for departure/arrival split */}
                                <div
                                  className=""
                                  style={{
                                    width: `${cityDepartPerc}%`,
                                    backgroundColor: colors.green[500],
                                  }}
                                />
                                <div
                                  className=""
                                  style={{
                                    width: `${cityArrivePerc}%`,
                                    backgroundColor: colors.blue[500],
                                  }}
                                />
                              </div>
                              <div className="flex justify-between mt-1">
                                <div className="flex items-center gap-0.5">
                                  <ArrowUp
                                    size={9}
                                    style={{ color: colors.green[500] }}
                                  />
                                  <span
                                    className="text-[10px] font-bold tabular-nums"
                                    style={{
                                      color: isDark
                                        ? colors.green[300]
                                        : colors.green[700],
                                    }}
                                  >
                                    {formatNumber(city.departingPassengers)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <ArrowDown
                                    size={9}
                                    style={{ color: colors.blue[500] }}
                                  />
                                  <span
                                    className="text-[10px] font-bold tabular-nums"
                                    style={{
                                      color: isDark
                                        ? colors.blue[300]
                                        : colors.blue[700],
                                    }}
                                  >
                                    {formatNumber(city.arrivingPassengers)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              );
            } else {
              return (
                <div className="py-2 text-xs" style={{ color: t.textMuted }}>
                  No passenger data available for this region
                </div>
              );
            }
          })()}
        </div>
      )}

      {/* Grid overlay, HUD animations and scrollbar styling */}
      <style>{`
        .wm-grid {
          background-image:
            linear-gradient(var(--wm-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--wm-grid) 1px, transparent 1px);
          background-size: 36px 36px;
        }
        .wm-root .wm-btn:hover {
          background: ${t.hoverBg};
          color: ${t.text};
        }
        .wm-root .wm-row:hover { background: ${t.hoverBg} !important; }
        .wm-arc-dash { animation: wm-dash 1.7s linear infinite; }
        @keyframes wm-dash {
          to { stroke-dashoffset: -17; }
        }
        .wm-ping {
          animation: wm-ping 2.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes wm-ping {
          0%   { r: 0.6; opacity: 0.8; }
          70%  { r: 3.4; opacity: 0; }
          100% { r: 3.4; opacity: 0; }
        }
        .wm-live-ping {
          animation: wm-live-ping 1.9s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes wm-live-ping {
          0%   { transform: scale(1);   opacity: 0.7; }
          75%  { transform: scale(2.6); opacity: 0; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        .wm-panel { animation: wm-panel-in 0.26s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes wm-panel-in {
          from { opacity: 0; transform: translateX(10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .wm-bar { transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        .wm-scroll::-webkit-scrollbar { width: 4px; }
        .wm-scroll::-webkit-scrollbar-track { background: transparent; }
        .wm-scroll::-webkit-scrollbar-thumb {
          background: ${t.divider};
          border-radius: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .wm-arc-dash, .wm-ping, .wm-live-ping, .wm-panel { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default React.memo(WorldMap);
