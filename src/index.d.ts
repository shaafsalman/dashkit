import type * as React from "react";

/* ----------------------------------------------------------------------------
 * Theme
 * -------------------------------------------------------------------------- */

export type ChartSize = "xs" | "s" | "m" | "l" | "xl" | "fill";

/** `mono` follows the page; `inverse` is the contrast card (white-on-dark / black-on-light). */
export type ThemeVariant = "mono" | "inverse";

export interface ChartThemeTokens {
  mode: "light" | "dark";
  surface: string;
  border: string;
  shadow: string;
  backdrop: string;
  radius: number;
  pad: number;
  text: { primary: string; secondary: string; muted: string };
  accent: string;
  track: string;
  grid: string;
  control: { bg: string; border: string; text: string; hover: string };
  series: string[];
  /** true for the monotone variants */
  mono?: boolean;
  tooltip?: { bg?: string; border?: string };
  /** CSS custom properties ChartCard scopes on its root (axis/tick colours). */
  vars?: Record<string, string>;
}

/**
 * Partial theme accepted by every chart. Colour-scheme fields (`base`, `mode`,
 * `surface`, `text`, ...) are ignored unless you use `solid` or `variant`;
 * the light/dark scheme always comes from `<html class="dark">`.
 */
export interface ChartTheme {
  base?: "light" | "dark" | "solid" | (string & {});
  /** Monotone surface. Resolves against the live dark-mode state. */
  variant?: ThemeVariant;
  /** `{ preset: "mono" }` is shorthand for `variant: "mono"`; add `inverse: true` to flip it. */
  preset?: "mono";
  inverse?: boolean;
  accent?: string;
  /** Explicit colours, or `"mono"` for a greyscale ramp matched to the surface. */
  series?: string[] | "mono";
  /** `"color"` keeps this chart in colour while the page-wide mono switch is on. */
  tone?: "color";
  /** `false` removes the card's film-grain texture. */
  texture?: boolean;
  radius?: number;
  pad?: number;
  backdrop?: string;
  shadow?: string;
  frame?: { border?: string };
  solid?: Partial<
    Pick<ChartThemeTokens, "surface" | "border" | "track" | "grid" | "mode">
  > & {
    text?: Partial<ChartThemeTokens["text"]>;
    control?: Partial<ChartThemeTokens["control"]>;
  };
  [key: string]: unknown;
}

export const LIGHT_THEME: ChartThemeTokens;
export const DARK_THEME: ChartThemeTokens;
export const SERIES_PALETTE: string[];
export const RIBBON_PALETTE: string[];
export const MONO_SERIES_ON_DARK: string[];
export const MONO_SERIES_ON_LIGHT: string[];
/** Greyscale ramp for a surface of the given scheme. */
export function monoSeries(surfaceScheme: "light" | "dark"): string[];
export function resolveTheme(
  theme?: ChartTheme | "light" | "dark" | "mono" | "inverse",
  fallbackMode?: "light" | "dark",
): ChartThemeTokens;
export function lighten(color: string, amount: number): string;
export function darken(color: string, amount: number): string;
export function isDarkMode(): boolean;
/** True while the page-wide black & white switch is on (`chart-mono` class on <html>). */
export function isMonotone(): boolean;
/** Turn every chart black & white ("mono") or back to colour ("color"); remount charts after toggling. */
export function setChartTone(tone: "mono" | "color"): void;
/** A data colour, or the i-th greyscale step when the theme is monotone. */
export function toneColor(theme: ChartThemeTokens, color: string, index?: number): string;
/** Series colour: explicit > theme palette (if one was passed) > chart default; greyscale in mono. */
export function seriesColor(theme: ChartThemeTokens, explicit: string | undefined, index: number, fallback: string): string;
export function compactNumber(value: number | string, opts?: { maximumFractionDigits?: number }): string;
export function compactCurrency(value: number | string, currency?: string): string;

/* ----------------------------------------------------------------------------
 * Shared chart props
 * -------------------------------------------------------------------------- */

export type ControlType = "filter" | "sort" | "dropdown" | "period" | "more" | "moreV";
export interface ChartControlOption {
  value?: string | number;
  key?: string | number;
  label: React.ReactNode;
}
export interface ChartControl {
  type: ControlType | (string & {});
  label?: string;
  value?: string | number;
  options?: ChartControlOption[];
  iconOnly?: boolean;
  onToggle?: (value: string | number) => void;
  [key: string]: unknown;
}
export type ChartControlInput = ControlType | ChartControl;

export interface BaseChartProps {
  title?: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: string;
  theme?: ChartTheme | "mono" | "inverse";
  controls?: ChartControlInput[];
  onControl?: (control: ChartControl, value?: unknown) => void;
  width?: number;
  size?: ChartSize;
  expandable?: boolean;
  className?: string;
  radius?: number;
}

/* ----------------------------------------------------------------------------
 * ChartCard
 * -------------------------------------------------------------------------- */

export interface ChartCardProps {
  /** A resolved theme (use `resolveTheme(theme)`). */
  theme: ChartThemeTokens;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: string;
  subtitle?: React.ReactNode;
  controls?: ChartControlInput[];
  onControl?: (control: ChartControl, value?: unknown) => void;
  headerRight?: React.ReactNode;
  headline?: { label?: React.ReactNode; value: React.ReactNode; change?: number };
  footer?: React.ReactNode;
  footerDetailed?: React.ReactNode;
  width?: number;
  size?: ChartSize;
  className?: string;
  style?: React.CSSProperties;
  expandable?: boolean;
  floatingHeader?: boolean;
  radius?: number;
  compact?: boolean;
  headerMarginBottom?: number;
  children?: React.ReactNode | ((ctx: { detailed: boolean }) => React.ReactNode);
}
export const ChartCard: React.NamedExoticComponent<ChartCardProps>;
export const SIZES: Record<Exclude<ChartSize, "fill">, number>;

/* ----------------------------------------------------------------------------
 * Typed components
 * -------------------------------------------------------------------------- */

export type KpiTone =
  | "forest" | "slate" | "ocean" | "violet" | "ember" | "crimson"
  | "mono" | "inverse";
export const KPI_TONES: KpiTone[];

export interface KpiCardProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  /** Percent change; sign picks ▲/▼. Monochrome in `mono` / `inverse` tones. */
  delta?: number | null;
  tone?: KpiTone;
  loading?: boolean;
  onClick?: (event: React.SyntheticEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}
export function KpiCard(props: KpiCardProps): React.JSX.Element;

export interface AreaTrendChartProps extends BaseChartProps {
  total?: number | string;
  changePct?: number | null;
  valueLabel?: string;
  labels?: string[];
  values?: Array<number | null>;
  accent?: string;
  formatValue?: (value: number) => string;
}
export const AreaTrendChart: React.NamedExoticComponent<AreaTrendChartProps>;
export function bucketize(...args: unknown[]): unknown;

export interface StackedBarSeries { key: string; label: string; color: string }
export interface StackedBarDatum { label: string; values: Record<string, number> }
export interface StackedBarChartProps extends BaseChartProps {
  /** `false` hides the series-filter pill. `controls={[]}` also removes it. */
  filter?: boolean;
  headerStatLabel?: string;
  headerStatValue?: React.ReactNode;
  headerStatChange?: number;
  floatingHeader?: boolean;
  showLegend?: boolean;
  series?: StackedBarSeries[];
  data?: StackedBarDatum[];
  suffix?: string;
  grouped?: boolean;
  axisFormat?: (value: number) => string;
  valueFormat?: (value: number) => string;
  heightScale?: number;
  emptyLabel?: React.ReactNode;
}
export const StackedBarChart: React.NamedExoticComponent<StackedBarChartProps>;

export interface DonutSegment { label: string; value: number; color?: string }
export interface DonutChartProps extends BaseChartProps {
  segments?: DonutSegment[];
  total?: number;
  centerLabel?: string;
  thickness?: number;
  formatValue?: (value: number) => string;
  compact?: boolean;
}
export const DonutChart: React.NamedExoticComponent<DonutChartProps>;

/* ----------------------------------------------------------------------------
 * Everything else — loosely typed until it gets a dedicated interface.
 * Props are optional and open, so nothing is spuriously required.
 * -------------------------------------------------------------------------- */

export interface LooseChartProps extends BaseChartProps {
  [prop: string]: any;
}
type Loose = React.ComponentType<LooseChartProps>;

export const ComparisonChart: Loose;
export const LoadingState: React.ComponentType<{ [prop: string]: any }>;
export const RibbonStackChart: Loose;
export const DEFAULT_SERIES: unknown[];
export const BalanceStatsChart: Loose;
export const HexHealthChart: Loose;
export const DualLineChart: Loose;
export const ResponseRatePanels: Loose;
export const ProgressGauge: Loose;
export const GaugeCard: Loose;
export const BarcodeMeterCard: Loose;
export const EarningsBarChart: Loose;
export const RadialBarsChart: Loose;
export const BarRankingChart: Loose;
export const RadarChart: Loose;
export const HeatmapGrid: Loose;
export const WaterfallChart: Loose;
export const SpeedometerChart: Loose;
export const FunnelChart: Loose;
export const NetworkGraphChart: Loose;
export const StatTiles: Loose;

export const GradientStatCard: Loose;
export const FleetSnapshotCard: Loose;
export const TrendBarcodeCard: Loose;
export const ActivityCalendar: Loose;
export const ProgressTrackList: Loose;
export const RadialBladeChart: Loose;
export const PercentGradientCard: Loose;
export const MetricsTable: Loose;
export const WeekdayBars: Loose;
export const RankedLocationBoard: Loose;
export const CompositionBar: Loose;
export const TargetBarcodeChart: Loose;
export const RankedList: Loose;
export const GRADIENTS: Record<string, unknown>;
export const SECTIONS: Record<string, any>;
export function whiteTheme(...args: any[]): ChartTheme;
export function solidTheme(...args: any[]): ChartTheme;
export function sectionRowHeight(...args: any[]): number;

export const WorldMap: React.ComponentType<{ allCities?: any; isMobile?: boolean; [prop: string]: any }>;

export const RankedDataWidget: React.ComponentType<{ [prop: string]: any }>;
export const WidgetHeader: React.ComponentType<{ [prop: string]: any }>;
export const WidgetFooter: React.ComponentType<{ [prop: string]: any }>;
export const HorizontalBarView: React.ComponentType<{ [prop: string]: any }>;
export const VerticalBarView: React.ComponentType<{ [prop: string]: any }>;
export const PieChartView: React.ComponentType<{ [prop: string]: any }>;
export const AreaChartView: React.ComponentType<{ [prop: string]: any }>;
export const LineChartView: React.ComponentType<{ [prop: string]: any }>;
export const HoverTooltip: React.ComponentType<{ [prop: string]: any }>;
export const CustomTooltip: React.ComponentType<{ [prop: string]: any }>;

/* chrome helpers */
export const HeaderControls: React.ComponentType<{ [prop: string]: any }>;
export const Legend: React.ComponentType<{ [prop: string]: any }>;
export const ChangePill: React.ComponentType<{ value?: number; color?: string; theme?: ChartThemeTokens }>;
export const Stat: React.ComponentType<{ [prop: string]: any }>;
export const ChartTooltip: React.ComponentType<{ [prop: string]: any }>;
export const Icons: Record<string, React.ComponentType<any>>;
export const CHART_FONT_SANS: string;
export const CHART_FONT_MONO: string;
export const AXIS_CATEGORY_TICK: Record<string, unknown>;
export const AXIS_VALUE_TICK: Record<string, unknown>;
export const AXIS_LINE_PROPS: Record<string, unknown>;
export const AXIS_GRID_PROPS: Record<string, unknown>;
