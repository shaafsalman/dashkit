// colorConfig.js

// Base colors
const colors = {
  // Greens (primary brand color)
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  orange: {
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
    base: '#FFA500', // Original bright orange
  },
  
  yellow: {
    100: '#fef9c3',
    200: '#fef08a',
    300: '#fde047',
    400: '#facc15', // Original warm yellow
    500: '#eab308',
    600: '#ca8a04',
    700: '#a16207',
    800: '#854d0e',
    900: '#713f12',
  },
  
  teal: {
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6', // Original teal
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },
  
  blue: {
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9', // Original seaBlue
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
  
  purple: {
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7', // Original purple
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
  
  // New color: Coral
  coral: {
    100: '#ffe4e4',
    200: '#ffc9c9',
    300: '#ff9d9d',
    400: '#ff7171',
    500: '#ff4c4c',
    600: '#df3939',
    700: '#be2a2a',
    800: '#9e1e1e',
    900: '#7e1515',
    base: '#FF6F61',
  },
  
  // New color: Indigo
  indigo: {
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    base: '#4F46E5',
  },
  
  // New color: Emerald
  emerald: {
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    base: '#10B981',
  },
  
  red: {
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  
  // Named secondary colors
  orange: '#FFA500',     // Bright orange
  yellow: '#facc15',     // Warm yellow
  teal: '#14b8a6',       // Teal
  seaBlue: '#0ea5e9',    // Sea blue
  purple: '#a855f7',     // Purple
  
  // Grays
  gray: {
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
  },
  
  slate: {
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  
  // Utility colors
  white: '#ffffff',
};

// Chart color palettes
const chartPalettes = {
  // Green monochromatic palette
  greenPalette: [
    colors.green[500],  // #22c55e
    colors.green[600],  // #16a34a
    colors.green[700],  // #15803d
    colors.green[800],  // #166534
    colors.green[900],  // #14532d
  ],
  
  // Multi-color palette
  multiPalette: [
    "#0f766e",
    colors.teal,        // #14b8a6
    colors.yellow,      // #facc15
    colors.orange,      // #FFA500
    '#5eead4',
    colors.seaBlue,     // #0ea5e9
    colors.green[500],  // #22c55e
    '#a8a89f',     // Light olive-gray rock, warm stone
    '#d7c8b3',     // Pale neutral beige, with a gentle warm hue
    '#e1d0c6',     // Light beige/stone with a skin-like quality
    colors.gray[300],        // #d1d5db (Light gray)
    colors.gray[400],        // #9ca3af (Gray)
    colors.gray[500],        // #6b7280 (Dark gray)
    colors.slate[900],       // #0f172a (Very dark slate gray)
    '#000000',               // Black


  ],



  // Header stat cards backgrounds with opacity
  headerCards: {
    revenue: 'bg-teal-600/90',
    taxes: 'bg-teal-600/90',
    commission: 'bg-teal-600/90',
    net: 'bg-teal-600/90',


    passengers: 'bg-slate-600/80',
    flights: 'bg-slate-600/80',
    reservations:  'bg-slate-600/80',
    agencies: 'bg-slate-600/80',

  }


  
  // // Header stat cards backgrounds with opacity
  // headerCards: {
  //   revenue: 'bg-blue-400/90',
  //   taxes: 'bg-slate-400/90',

  //   flights: 'bg-teal-800/80',
  //   reservations: 'bg-red-700/80',
  //   passengers: 'bg-purple-800/80',
  //   commission: 'bg-slate-900/90',
  //    agencies: 'bg-rose-900/80',
  //    net: 'bg-stone-700/80'

  // }
};

export { colors, chartPalettes };
export default { colors, chartPalettes };