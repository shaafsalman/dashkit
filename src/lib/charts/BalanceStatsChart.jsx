import React from "react";
import RibbonStackChart from "./RibbonStackChart";

/**
 * BalanceStatsChart — "Balance Statistics" preset.
 * Thin wrapper over the generalized RibbonStackChart: light theme, $-axis with
 * dashed gridlines, bottom-left "Total Balance" headline, a "Monthly" dropdown,
 * and bars on alternate periods (the ribbon flows through the gaps).
 */

const BALANCE_SERIES = [
  { key: "low", label: "Low", color: "#5e241a" },
  { key: "mid", label: "Mid", color: "#e0653a" },
  { key: "high", label: "High", color: "#f3c9b9" },
];

const BALANCE_DATA = [
  { label: "Jan", values: { low: 22000, mid: 9000, high: 6000 } },
  { label: "Feb", bar: false },
  { label: "Mar", values: { low: 33000, mid: 18000, high: 13000 } },
  { label: "Apr", bar: false },
  { label: "May", values: { low: 62000, mid: 30000, high: 16000 } },
];

const BalanceStatsChart = ({ size = "l", ...props }) => (
  <RibbonStackChart
    title="Balance Statistics"
    theme="light"
    series={BALANCE_SERIES}
    data={BALANCE_DATA}
    total={50847}
    headlinePosition="bottom"
    headlineLabel="Total Balance"
    currency="$"
    decimals={0}
    showAxis
    yTicks={[0, 25000, 50000, 75000, 100000]}
    axisFormat={(v) => `$${Math.round(v / 1000)}K`}
    showLegend={false}
    showBarLabels={false}
    width={760}
    size={size}
    {...props}
  />
);

export default BalanceStatsChart;
