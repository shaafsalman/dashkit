import { colors } from "./colorConfig";

// Sample airport → country map spanning six continents, so the showcase
// map lights up broadly instead of clustering in one region. Swap this for
// your own network's codes (and update AIRPORT_TO_NAME/CITY_COORDINATES to
// match) in a real deployment — this is sample data, not a fixed contract.
export const AIRPORT_TO_COUNTRY = {
  JFK: "United States of America",
  LHR: "United Kingdom",
  CDG: "France",
  FRA: "Germany",
  DXB: "United Arab Emirates",
  NBO: "Kenya",
  JNB: "South Africa",
  SIN: "Singapore",
  HND: "Japan",
  SYD: "Australia",
  GRU: "Brazil",
  DEL: "India",
};

// Airport code to full name mapping
export const AIRPORT_TO_NAME = {
  JFK: "New York",
  LHR: "London",
  CDG: "Paris",
  FRA: "Frankfurt",
  DXB: "Dubai",
  NBO: "Nairobi",
  JNB: "Johannesburg",
  SIN: "Singapore",
  HND: "Tokyo",
  SYD: "Sydney",
  GRU: "São Paulo",
  DEL: "Delhi",
};

// Map of country name alternatives to handle GeoJSON mismatches
export const COUNTRY_NAME_MAPPINGS = {
  "United States": "United States of America",
  USA: "United States of America",
  US: "United States of America",
  UK: "United Kingdom",
  "U.A.E.": "United Arab Emirates",
  UAE: "United Arab Emirates",
};

// Country colors
export const COUNTRY_COLORS = {
  "United States of America": "#2563EB",
  "United Kingdom": "#4F46E5",
  France: "#7C3AED",
  Germany: "#334155",
  "United Arab Emirates": "#0D9488",
  Kenya: "#EA580C",
  "South Africa": colors.emerald[600],
  Singapore: "#DB2777",
  Japan: "#DC2626",
  Australia: "#16A34A",
  Brazil: "#CA8A04",
  India: "#0891B2",
};

// Placeholder coordinates for each country
export const COUNTRY_COORDINATES = {
  "United States of America": [-98.5, 39.8],
  "United Kingdom": [-2.0, 54.0],
  France: [2.5, 46.6],
  Germany: [10.4, 51.2],
  "United Arab Emirates": [54.3, 23.4],
  Kenya: [37.9, 0.0],
  "South Africa": [24.7, -28.5],
  Singapore: [103.8, 1.35],
  Japan: [138.2, 36.2],
  Australia: [133.7, -25.3],
  Brazil: [-51.9, -14.2],
  India: [78.9, 20.6],
};

// City coordinates - these would normally come from a real airport database
export const CITY_COORDINATES = {
  JFK: [-73.78, 40.64],
  LHR: [-0.46, 51.47],
  CDG: [2.55, 49.01],
  FRA: [8.57, 50.03],
  DXB: [55.36, 25.25],
  NBO: [36.93, -1.32],
  JNB: [28.25, -26.13],
  SIN: [103.99, 1.36],
  HND: [139.78, 35.55],
  SYD: [151.18, -33.95],
  GRU: [-46.47, -23.43],
  DEL: [77.1, 28.57],
};

// GeoJSON map data URL
export const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Helper to format numbers with K/M suffixes
export const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Function to get city marker style based on passenger count
export const getCityMarkerStyle = (passengerCount) => {
  // Scale marker size based on passenger count
  const baseSize = 4;
  const maxSize = 12;
  const minCount = 1000;
  const maxCount = 50000;

  // Calculate size between baseSize and maxSize based on passenger count
  const size =
    baseSize +
    ((Math.min(Math.max(passengerCount, minCount), maxCount) - minCount) /
      (maxCount - minCount)) *
      (maxSize - baseSize);

  return {
    radius: size,
    strokeWidth: 1.5,
  };
};

// Function to determine text size based on zoom and importance
export const getTextSize = (zoom, isMain = false) => {
  const baseSize = isMain ? 7 : 5.5;
  const scaleFactor = isMain ? 1.2 : 1;
  return Math.max(baseSize, (baseSize / zoom) * scaleFactor);
};

// Process flight route data into country and airport statistics
export const processRouteData = (allCities) => {
  if (!allCities || allCities.length === 0) {
    return { countryData: {}, mapStats: defaultMapStats() };
  }

  const normalize = (c) => (c ? String(c).trim().toUpperCase() : null);

  const countryGroups = {};
  const airportMap = {};

  let totalMapPassengers = 0;
  let totalMapFlights = 0;
  let totalArrivingCount = 0;
  let totalDepartingCount = 0;

  allCities.forEach((route) => {
    const depCode = normalize(route.departureCode);
    const arrCode = normalize(route.arrivalCode);
    const passCount = route.passengers || 0;

    const depCountry = AIRPORT_TO_COUNTRY[depCode];
    const arrCountry = AIRPORT_TO_COUNTRY[arrCode];

    // ❌ DROP UNKNOWN AIRPORTS COMPLETELY
    if (!depCountry || !arrCountry) return;

    // ---- Departure airport ----
    if (!airportMap[depCode]) {
      airportMap[depCode] = {
        code: depCode,
        name: AIRPORT_TO_NAME[depCode] || depCode,
        country: depCountry,
        coordinates: CITY_COORDINATES[depCode],
        departingPassengers: 0,
        arrivingPassengers: 0,
        totalPassengers: 0,
      };
    }

    // ---- Arrival airport ----
    if (!airportMap[arrCode]) {
      airportMap[arrCode] = {
        code: arrCode,
        name: AIRPORT_TO_NAME[arrCode] || arrCode,
        country: arrCountry,
        coordinates: CITY_COORDINATES[arrCode],
        departingPassengers: 0,
        arrivingPassengers: 0,
        totalPassengers: 0,
      };
    }

    airportMap[depCode].departingPassengers += passCount;
    airportMap[depCode].totalPassengers += passCount;

    airportMap[arrCode].arrivingPassengers += passCount;
    airportMap[arrCode].totalPassengers += passCount;

    totalMapPassengers += passCount;
    totalDepartingCount += passCount;
    totalArrivingCount += passCount;
    totalMapFlights += route.flightCount || 1;
  });

  Object.values(airportMap).forEach((airport) => {
    const country = airport.country;

    if (!countryGroups[country]) {
      countryGroups[country] = {
        name: country,
        totalPassengers: 0,
        departingPassengers: 0,
        arrivingPassengers: 0,
        cities: [],
        coordinates: COUNTRY_COORDINATES[country],
        color: COUNTRY_COLORS[country],
      };
    }

    countryGroups[country].cities.push(airport);
    countryGroups[country].totalPassengers += airport.totalPassengers;
    countryGroups[country].departingPassengers += airport.departingPassengers;
    countryGroups[country].arrivingPassengers += airport.arrivingPassengers;
  });

  return {
    countryData: countryGroups,
    mapStats: {
      totalPassengers: totalMapPassengers,
      totalFlights: totalMapFlights,
      totalArrivingPassengers: totalArrivingCount,
      totalDepartingPassengers: totalDepartingCount,
    },
  };
};

// Default map stats for initialization
export const defaultMapStats = () => ({
  totalPassengers: 0,
  totalFlights: 0,
  totalArrivingPassengers: 0,
  totalDepartingPassengers: 0,
});

// Sample points along a gently bowed path between two [lon, lat] pairs.
// Used purely for the flight-path layer — the bow always leans north so every
// arc reads the same way regardless of travel direction.
const arcPoints = (from, to, segments = 40, bowFactor = 0.2) => {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;

  // Perpendicular unit vector, flipped so the lift is always northward.
  const px = -dy / len;
  const py = dx / len;
  const sign = py < 0 ? -1 : 1;
  const bow = len * bowFactor * sign;

  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lift = Math.sin(Math.PI * t) * bow;
    points.push([x1 + dx * t + px * lift, y1 + dy * t + py * lift]);
  }
  return points;
};

// Build the animated route arcs drawn between airports.
// Directions are merged into a single arc per city pair, and unknown airports
// are dropped exactly as processRouteData drops them.
export const buildRouteArcs = (allCities, limit = 18) => {
  if (!allCities || allCities.length === 0) return [];

  const normalize = (c) => (c ? String(c).trim().toUpperCase() : null);
  const pairs = {};

  allCities.forEach((route) => {
    const depCode = normalize(route.departureCode);
    const arrCode = normalize(route.arrivalCode);
    if (!depCode || !arrCode || depCode === arrCode) return;
    if (!AIRPORT_TO_COUNTRY[depCode] || !AIRPORT_TO_COUNTRY[arrCode]) return;

    const from = CITY_COORDINATES[depCode];
    const to = CITY_COORDINATES[arrCode];
    if (!from || !to) return;

    const key = [depCode, arrCode].sort().join("-");
    if (!pairs[key]) {
      pairs[key] = {
        id: key,
        from,
        to,
        fromCode: depCode,
        toCode: arrCode,
        passengers: 0,
      };
    }
    pairs[key].passengers += route.passengers || 0;
  });

  const arcs = Object.values(pairs)
    .sort((a, b) => b.passengers - a.passengers)
    .slice(0, limit);

  const busiest = arcs.reduce((max, a) => Math.max(max, a.passengers), 0) || 1;

  return arcs.map((arc, index) => ({
    ...arc,
    index,
    // 0..1 share of the busiest route, drives stroke width and pulse speed.
    weight: arc.passengers / busiest,
    coordinates: arcPoints(arc.from, arc.to),
  }));
};

// Function to match geo with country data
export const matchCountryToGeo = (geo, countryData) => {
  if (!geo) return null;

  // Get the country name from geo
  const geoName = geo.properties.name;

  // First try direct match
  let country = Object.values(countryData).find(
    (c) => c.name.toLowerCase() === geoName.toLowerCase()
  );

  // If no direct match, try alternative names
  if (!country) {
    // Check if this geo name has a mapping
    const mappedName = COUNTRY_NAME_MAPPINGS[geoName];
    if (mappedName) {
      country = Object.values(countryData).find(
        (c) => c.name.toLowerCase() === mappedName.toLowerCase()
      );
    }
  }

  return country;
};
