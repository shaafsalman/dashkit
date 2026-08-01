// Deterministic fake data for the showcase — no Math.random() so the demo
// renders identically on every build (screenshots stay stable, no layout
// jitter between reloads).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A small deterministic pseudo-random generator (mulberry32) so values look
// organic without depending on Math.random().
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function monthly(seed, { base = 100, spread = 60, months = 12 } = {}) {
  const r = rng(seed);
  return MONTHS.slice(0, months).map((name) => ({
    name,
    month: name,
    value: Math.round(base + (r() - 0.35) * spread * 2),
  }));
}

export const revenueByMonth = monthly(1, { base: 4200000, spread: 2600000 });
export const revenueByMonthPrev = monthly(11, { base: 3600000, spread: 2200000 });
export const passengersByMonth = monthly(2, { base: 18000, spread: 9000 });
export const passengersByMonthPrev = monthly(12, { base: 15000, spread: 7000 });
export const loadFactorByMonth = monthly(3, { base: 78, spread: 16 });

// Route/airport codes here are the WorldMap sample set's own airports (see
// src/lib/geo/WorldMapHelper.jsx's AIRPORT_TO_COUNTRY) — a Dubai hub spoked
// out across six continents, so the map plots a genuinely global network
// out of the box instead of clustering in one region. Swap these for your
// own network's codes (and update AIRPORT_TO_COUNTRY/AIRPORT_TO_NAME/
// CITY_COORDINATES) in a real deployment; they're sample data, not part of
// the component's contract. `label` mirrors `name` — RankedList reads
// `.label`, RankedDataWidget/RankedLocationBoard read `.name`.
export const routes = [
  { name: "DXB-JFK", value: 5200000, prev: 4600000 },
  { name: "DXB-LHR", value: 4800000, prev: 4300000 },
  { name: "DXB-SIN", value: 4100000, prev: 3700000 },
  { name: "DXB-HND", value: 3900000, prev: 4200000 },
  { name: "DXB-CDG", value: 3400000, prev: 3100000 },
  { name: "DXB-DEL", value: 3100000, prev: 2600000 },
  { name: "DXB-NBO", value: 2700000, prev: 2300000 },
  { name: "DXB-JNB", value: 2400000, prev: 2500000 },
  { name: "DXB-SYD", value: 2100000, prev: 1800000 },
  { name: "DXB-GRU", value: 1700000, prev: 1400000 },
  { name: "DXB-FRA", value: 1500000, prev: 1600000 },
  { name: "LHR-JFK", value: 1200000, prev: 1000000 },
].map((r) => ({ ...r, label: r.name }));

export const routesPax = routes.map((r) => ({
  name: r.name,
  label: r.name,
  value: Math.round(r.value / 90),
  prev: Math.round(r.prev / 90),
}));

export const destinations = [
  { name: "DXB-JFK" }, { name: "DXB-LHR" }, { name: "DXB-SIN" }, { name: "DXB-HND" },
  { name: "DXB-CDG" }, { name: "DXB-DEL" }, { name: "DXB-NBO" }, { name: "DXB-JNB" },
].map((r, i) => ({ ...r, label: r.name, value: 4000 - i * 300 }));

export const worldMapCities = [
  { departureCode: "DXB", arrivalCode: "JFK", passengers: 58000 },
  { departureCode: "DXB", arrivalCode: "LHR", passengers: 53000 },
  { departureCode: "DXB", arrivalCode: "SIN", passengers: 46000 },
  { departureCode: "DXB", arrivalCode: "HND", passengers: 44000 },
  { departureCode: "DXB", arrivalCode: "CDG", passengers: 38000 },
  { departureCode: "DXB", arrivalCode: "DEL", passengers: 35000 },
  { departureCode: "DXB", arrivalCode: "NBO", passengers: 30000 },
  { departureCode: "DXB", arrivalCode: "JNB", passengers: 27000 },
  { departureCode: "DXB", arrivalCode: "SYD", passengers: 24000 },
  { departureCode: "DXB", arrivalCode: "GRU", passengers: 19000 },
  { departureCode: "DXB", arrivalCode: "FRA", passengers: 17000 },
  { departureCode: "LHR", arrivalCode: "JFK", passengers: 14000 },
];

// Hub-and-spoke topology for NetworkGraphChart, derived the same way the
// production dashboard derives it: split each route on "-", sum passengers
// per airport to rank the hub, and pull out the single busiest edge.
export const networkProps = (() => {
  const edges = routesPax
    .map((r) => {
      const [from, to] = r.name.split("-");
      return { from, to, value: r.value };
    })
    .filter((e) => e.value > 0);
  const nodeTotals = {};
  edges.forEach((e) => {
    nodeTotals[e.from] = (nodeTotals[e.from] || 0) + e.value;
    nodeTotals[e.to] = (nodeTotals[e.to] || 0) + e.value;
  });
  const nodes = Object.keys(nodeTotals).sort((a, b) => nodeTotals[b] - nodeTotals[a]);
  const busiest = [...edges].sort((a, b) => b.value - a.value)[0];
  return {
    nodes, edges, nodeTotals,
    activeAirports: nodes.length,
    routeDirections: edges.length,
    primaryHub: nodes[0],
    busiestRoute: busiest ? `${busiest.from}-${busiest.to}` : "—",
  };
})();

export const tails = [
  { name: "N101DK", value: 1216 },
  { name: "N102DK", value: 1184 },
  { name: "N103DK", value: 850 },
  { name: "N104DK", value: 306 },
  { name: "N105DK", value: 229 },
];

export const stations = [
  { name: "JFK", flights: 420, revenue: 8100000, otp: 91 },
  { name: "LAX", flights: 380, revenue: 7400000, otp: 84 },
  { name: "ORD", flights: 310, revenue: 5200000, otp: 78 },
  { name: "SFO", flights: 260, revenue: 4600000, otp: 88 },
  { name: "MIA", flights: 190, revenue: 3100000, otp: 73 },
];

export const costBreakdown = [
  { name: "Fuel", value: 6200000 },
  { name: "Crew", value: 4100000 },
  { name: "MRO", value: 2600000 },
  { name: "Airport fees", value: 1800000 },
  { name: "Leasing", value: 1400000 },
  { name: "Other", value: 900000 },
];

export const fuelMonths = monthly(4, { base: 900, spread: 300 }).map((m) => ({
  name: m.name, month: m.name, fuel: m.value * 7.4, flights: 60 + Math.round(m.value / 30),
}));

export const flightsByDay = (() => {
  const r = rng(5);
  const out = [];
  for (let m = 1; m <= 7; m++) {
    const days = new Date(2026, m, 0).getDate();
    for (let d = 1; d <= days; d++) {
      out.push({ date: `2026-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, value: Math.round(4 + r() * 12) });
    }
  }
  return out;
})();

export const flightsByMonth = monthly(6, { base: 1800, spread: 900 });

// ComparisonChart wants `data` keyed by year, each year an array of
// {name, value} where `name` is the FULL month name (its internal sort
// keys off the full name, not the 3-letter abbreviation).
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function comparisonYearData(seedA, seedB, { base = 4000000, spread = 2000000 } = {}) {
  const rA = rng(seedA);
  const rB = rng(seedB);
  return {
    2026: FULL_MONTHS.map((name) => ({ name, value: Math.round(base + (rA() - 0.3) * spread * 2) })),
    2025: FULL_MONTHS.map((name) => ({ name, value: Math.round(base * 0.82 + (rB() - 0.3) * spread * 1.6) })),
  };
}
export const comparisonRevenueData = comparisonYearData(21, 22);
export const comparisonPaxData = comparisonYearData(23, 24, { base: 16000, spread: 8000 });

export const healthMetrics = [
  { label: "Load Factor", value: 78 },
  { label: "On-Time", value: 86 },
  { label: "Op. Margin", value: 11 },
];

export const kpis = [
  { label: "Revenue", value: "$26.7M", sub: "vs $22.1M last year", delta: 20.8, tone: "forest" },
  { label: "Operating Income", value: "$3.1M", sub: "11.6% margin", delta: 14.2, tone: "ocean" },
  { label: "Passengers", value: "210.4K", sub: "1.9M seat-miles", delta: 8.4, tone: "slate" },
  { label: "Load Factor", value: "78%", sub: "target 75%", delta: 4.0, tone: "ember" },
  { label: "On-Time", value: "86%", sub: "industry avg 79%", delta: -1.2, tone: "crimson" },
  { label: "Fleet", value: "24", sub: "5 tails top-utilized", delta: 0, tone: "violet" },
];
