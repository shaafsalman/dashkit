#!/usr/bin/env python3
"""Dependency-free MCP server for the Dashkit React component library."""

from __future__ import annotations

import json
import sys
from typing import Any


COMPONENT_GROUPS = {
    "change-over-time": [
        ("trend", "Trend comparison", "DualLineChart"),
        ("comparison", "Multi-year comparison", "ComparisonChart"),
        ("area-trend", "Area trend", "AreaTrendChart"),
        ("stacked-columns", "Stacked columns", "StackedBarChart"),
        ("ribbon-stack", "Ribbon stack", "RibbonStackChart"),
        ("earnings-bars", "Earnings bars", "EarningsBarChart"),
        ("waterfall", "Waterfall bridge", "WaterfallChart"),
        ("trend-barcode", "Trend barcode", "TrendBarcodeCard"),
        ("weekday-bars", "Weekday bars", "WeekdayBars"),
        ("target-barcode", "Target barcode", "TargetBarcodeChart"),
    ],
    "ranking-distribution": [
        ("bar-ranking", "Bar ranking", "BarRankingChart"),
        ("radar", "Radar profile", "RadarChart"),
        ("heatmap", "Activity heatmap", "HeatmapGrid"),
        ("responses", "Response panels", "ResponseRatePanels"),
        ("activity-calendar", "Activity calendar", "ActivityCalendar"),
        ("ranked-list", "Ranked list", "RankedList"),
        ("progress-tracks", "Progress tracks", "ProgressTrackList"),
        ("metrics-table", "Metrics table", "MetricsTable"),
    ],
    "composition": [
        ("donut", "Donut composition", "DonutChart"),
        ("funnel", "Conversion funnel", "FunnelChart"),
        ("radial-bars", "Radial bars", "RadialBarsChart"),
        ("composition-bar", "Composition bar", "CompositionBar"),
        ("radial-blade", "Radial blade", "RadialBladeChart"),
    ],
    "progress-health": [
        ("progress-gauge", "Progress gauge", "ProgressGauge"),
        ("gauge-card", "Gauge card", "GaugeCard"),
        ("speedometer", "Speedometer", "SpeedometerChart"),
        ("barcode-meter", "Barcode meter", "BarcodeMeterCard"),
        ("health-score", "Health score", "HexHealthChart"),
        ("percent-gradient", "Percent gradient", "PercentGradientCard"),
    ],
    "summary-relationships": [
        ("stat-tiles", "Stat tiles", "StatTiles"),
        ("balance-statistics", "Balance statistics", "BalanceStatsChart"),
        ("network", "Network graph", "NetworkGraphChart"),
        ("kpi", "KPI card", "KpiCard"),
        ("gradient-stat", "Gradient statistic", "GradientStatCard"),
        ("resource-snapshot", "Resource snapshot", "FleetSnapshotCard"),
        ("location-ranking", "Location ranking", "RankedLocationBoard"),
        ("multi-view-ranking", "Multi-view ranking", "RankedDataWidget"),
        ("world-map", "World map", "WorldMap"),
    ],
}

COMPONENTS = {
    key: {"key": key, "label": label, "component": component, "category": category}
    for category, entries in COMPONENT_GROUPS.items()
    for key, label, component in entries
}

DEFAULT_NEUTRAL = ["#3B82F6", "#94A3B8", "#0EA5E9", "#7C3AED", "#F59E0B", "#E11D48"]
DEFAULT_BRAND = ["#FFFFFF", "#E2E8F0", "#CBD5E1", "#94A3B8", "#64748B", "#334155"]
CONTAINERS = {
    "fluid": "100% container width with a 420px target height",
    "square": "1 / 1",
    "portrait": "3 / 4",
    "standard": "3 / 2",
    "wide": "16 / 9",
    "ultrawide": "2 / 1",
}


def compact(value: float) -> str:
    value = float(value)
    absolute = abs(value)
    if absolute >= 1_000_000_000:
        return f"{value / 1_000_000_000:.1f}".rstrip("0").rstrip(".") + "B"
    if absolute >= 1_000_000:
        return f"{value / 1_000_000:.1f}".rstrip("0").rstrip(".") + "M"
    if absolute >= 1_000:
        return f"{value / 1_000:.1f}".rstrip("0").rstrip(".") + "K"
    return str(int(value) if value.is_integer() else round(value, 1))


def text_result(value: Any, is_error: bool = False) -> dict[str, Any]:
    text = value if isinstance(value, str) else json.dumps(value, indent=2)
    return {"content": [{"type": "text", "text": text}], "isError": is_error}


def resolve_component(name: str) -> dict[str, str] | None:
    query = (name or "").strip().lower()
    if query in COMPONENTS:
        return COMPONENTS[query]
    for item in COMPONENTS.values():
        if query in {item["label"].lower(), item["component"].lower()}:
            return item
    return None


def list_components(arguments: dict[str, Any]) -> dict[str, Any]:
    category = (arguments.get("category") or "").strip().lower()
    groups = COMPONENT_GROUPS
    if category:
        groups = {key: value for key, value in groups.items() if key == category}
    return text_result({
        "count": sum(len(items) for items in groups.values()),
        "categories": {
            key: [{"key": item[0], "label": item[1], "component": item[2]} for item in items]
            for key, items in groups.items()
        },
    })


def get_component(arguments: dict[str, Any]) -> dict[str, Any]:
    item = resolve_component(str(arguments.get("name", "")))
    if not item:
        return text_result("Unknown component. Call dashkit_list_components first.", True)
    axis = item["category"] in {"change-over-time", "ranking-distribution"}
    return text_result({
        **item,
        "import": f'import {{ {item["component"]} }} from "dashkit";',
        "commonProps": ["title", "subtitle", "theme", "size", "width", "expandable"],
        "layoutContract": {
            "header": "Title and subtitle stay top-left; primary value stays top-right.",
            "plot": "Only the internal visualization changes between components.",
            "axis": "Use compact K/M/B ticks, readable 12px minimum labels, and reserved gutters." if axis else "Not axis-based.",
            "responsive": "Fill the supplied container and preserve the selected aspect ratio.",
        },
    })


def jsx_array(values: list[Any]) -> str:
    return json.dumps(values, separators=(",", ", "))


def generate_component(arguments: dict[str, Any]) -> dict[str, Any]:
    item = resolve_component(str(arguments.get("component", "trend")))
    if not item:
        return text_result("Unknown component. Call dashkit_list_components first.", True)
    title = str(arguments.get("title") or "Product momentum")
    subtitle = str(arguments.get("subtitle") or "Current period vs previous period")
    surface = str(arguments.get("surface") or "neutral").lower()
    accent = str(arguments.get("accent") or "#3B82F6").upper()
    palette = arguments.get("colors") or (DEFAULT_BRAND if surface == "brand" else DEFAULT_NEUTRAL)
    palette = [str(color).upper() for color in palette][:6]
    palette += (DEFAULT_BRAND if surface == "brand" else DEFAULT_NEUTRAL)[len(palette):]
    radius = int(arguments.get("radius", 8))
    border = str(arguments.get("border") or "subtle")
    container = str(arguments.get("container") or "wide")
    values = arguments.get("values") or [8200, 9100, 9800, 11200, 12600, 13900, 15100, 16800, 18100, 19900, 21600, 23800]
    labels = arguments.get("labels") or ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    ratio = CONTAINERS.get(container, CONTAINERS["wide"])
    frame_color = "rgba(255,255,255,.24)" if surface == "brand" else "rgba(15,23,42,.10)"
    if border == "none":
        frame_color = "transparent"
    elif border == "strong":
        frame_color = "rgba(255,255,255,.62)" if surface == "brand" else "rgba(15,23,42,.34)"

    theme = (
        "{\n"
        f'  base: "{"solid" if surface == "brand" else "light"}",\n'
        f'  accent: "{accent}",\n'
        f"  series: {jsx_array(palette)},\n"
        f"  radius: {radius},\n"
        f'  frame: {{ border: "{frame_color}" }},\n'
        f'  solid: {{ surface: "linear-gradient(145deg, {accent} 0%, {accent}CC 100%)" }}\n'
        "}"
    )
    data_lines = (
        f"const labels = {jsx_array(labels)};\n"
        f"const values = {jsx_array(values)};\n"
        "const previous = values.map((value) => Math.round(value * 0.82));"
    )
    component = item["component"]
    props = [
        f"title={{{json.dumps(title)}}}",
        f"subtitle={{{json.dumps(subtitle)}}}",
        "theme={theme}",
        'size="fill"',
    ]
    if item["key"] in {"trend", "area-trend"}:
        props += ["labels={labels}", "values={values}"]
    elif item["key"] == "comparison":
        props += ["data={{ 2025: labels.map((name, i) => ({ name, value: previous[i] })), 2026: labels.map((name, i) => ({ name, value: values[i] })) }}", "selectedYears={[2025, 2026]}"]
    elif item["key"] == "stacked-columns":
        props += ["series={[{ key: 'previous', label: 'Previous', color: theme.series[1] }, { key: 'current', label: 'Current', color: theme.series[0] }]}", "data={labels.map((label, i) => ({ label, values: { previous: previous[i], current: values[i] } }))}", "grouped"]
    elif item["key"] == "donut":
        props += ["segments={labels.slice(0, 5).map((label, i) => ({ label, value: values[i], color: theme.series[i] }))}"]
    elif item["key"] in {"bar-ranking", "ranked-list"}:
        props += ["items={labels.slice(0, 5).map((label, i) => ({ label, value: values[i], color: theme.series[i] }))}"]
    elif item["key"] == "funnel":
        props += ["stages={labels.slice(0, 4).map((label, i) => ({ label, value: values[i], color: theme.series[i] }))}"]
    elif item["key"] == "composition-bar":
        props += ["items={labels.slice(0, 5).map((name, i) => ({ name, value: values[i], color: theme.series[i] }))}"]
    elif item["key"] in {"progress-gauge", "gauge-card", "speedometer", "health-score"}:
        props += ["value={84}"]

    prop_block = "\n        ".join(props)
    jsx = (
        f'import {{ {component} }} from "dashkit";\n\n'
        f"{data_lines}\n\n"
        f"const theme = {theme};\n\n"
        "export function AnalyticsCard() {\n"
        f'  return <div style={{{{ width: "100%", aspectRatio: "{ratio}" }}}}>\n'
        f"    <{component}\n        {prop_block}\n    />\n"
        "  </div>;\n"
        "}\n"
    )
    return text_result({
        "component": item,
        "compactPreview": [compact(value) for value in values[:5]],
        "config": {"surface": surface, "accent": accent, "colors": palette, "radius": radius, "border": border, "container": container},
        "jsx": jsx,
    })


def design_rules(arguments: dict[str, Any]) -> dict[str, Any]:
    surface = str(arguments.get("surface") or "all").lower()
    return text_result({
        "surface": surface,
        "header": "Title/subtitle top-left and primary value top-right are locked across standard charts.",
        "numbers": "Never show long raw values in visual labels. Use K, M, or B; retain full values only in accessible descriptions/tooltips.",
        "axes": "Reserve gutters, use consistent dashed grid lines, keep axis text at least 12 CSS px, and prevent clipping/overlap.",
        "responsive": "Charts fill their container. Preserve 1:1, 3:4, 3:2, 16:9, or 2:1 variants without stretching text.",
        "brandSurface": {
            "background": "Selected accent gradient.",
            "dataPalette": DEFAULT_BRAND,
            "rule": "Data marks use white-to-slate contrast, not a rainbow palette.",
        },
        "neutralSurface": {"dataPalette": DEFAULT_NEUTRAL},
        "chrome": "Secondary actions may hide until hover on compact cards; essential values remain visible.",
    })


def validate_config(arguments: dict[str, Any]) -> dict[str, Any]:
    config = arguments.get("config") or arguments
    issues: list[dict[str, str]] = []
    surface = str(config.get("surface") or "neutral").lower()
    colors = config.get("colors") or []
    if len(colors) < 2:
        issues.append({"severity": "error", "field": "colors", "message": "Provide at least two series colors."})
    if surface == "brand" and colors:
        colorful = [color for color in colors if str(color).upper() not in DEFAULT_BRAND]
        if colorful:
            issues.append({"severity": "warning", "field": "colors", "message": "Brand surfaces default to white-to-slate data ink. Custom colors may reduce contrast."})
    radius = config.get("radius", 8)
    if not isinstance(radius, (int, float)) or not 0 <= radius <= 32:
        issues.append({"severity": "error", "field": "radius", "message": "Radius must be between 0 and 32."})
    container = str(config.get("container") or "wide")
    if container not in CONTAINERS and container != "custom":
        issues.append({"severity": "error", "field": "container", "message": f"Use one of: {', '.join(CONTAINERS)} or custom."})
    values = config.get("values") or []
    if any(isinstance(value, (int, float)) and abs(value) >= 1000 for value in values):
        issues.append({"severity": "info", "field": "format", "message": "Large values will be displayed with compact K/M/B formatting."})
    return text_result({"valid": not any(issue["severity"] == "error" for issue in issues), "issues": issues})


TOOLS = [
    {
        "name": "dashkit_list_components",
        "description": "List all Dashkit components, grouped by visualization purpose.",
        "inputSchema": {"type": "object", "properties": {"category": {"type": "string", "description": "Optional category key."}}},
    },
    {
        "name": "dashkit_get_component",
        "description": "Get the import name and stable layout contract for a Dashkit component.",
        "inputSchema": {"type": "object", "required": ["name"], "properties": {"name": {"type": "string"}}},
    },
    {
        "name": "dashkit_generate_component",
        "description": "Generate a responsive React/Dashkit component with editable palette, surface, radius, border, data, and container props.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "component": {"type": "string"}, "title": {"type": "string"}, "subtitle": {"type": "string"},
                "surface": {"type": "string", "enum": ["neutral", "brand"]}, "accent": {"type": "string"},
                "colors": {"type": "array", "items": {"type": "string"}, "maxItems": 6},
                "radius": {"type": "integer", "minimum": 0, "maximum": 32},
                "border": {"type": "string", "enum": ["none", "subtle", "strong"]},
                "container": {"type": "string", "enum": ["fluid", "square", "portrait", "standard", "wide", "ultrawide"]},
                "labels": {"type": "array", "items": {"type": "string"}},
                "values": {"type": "array", "items": {"type": "number"}},
            },
        },
    },
    {
        "name": "dashkit_get_design_rules",
        "description": "Return Dashkit's cross-chart visual, responsive, axis, formatting, and brand-surface rules.",
        "inputSchema": {"type": "object", "properties": {"surface": {"type": "string", "enum": ["all", "neutral", "brand"]}}},
    },
    {
        "name": "dashkit_validate_config",
        "description": "Validate a proposed Dashkit config before generating or rendering it.",
        "inputSchema": {"type": "object", "properties": {"config": {"type": "object"}}},
    },
]


CALLS = {
    "dashkit_list_components": list_components,
    "dashkit_get_component": get_component,
    "dashkit_generate_component": generate_component,
    "dashkit_get_design_rules": design_rules,
    "dashkit_validate_config": validate_config,
}


def respond(request: dict[str, Any]) -> dict[str, Any] | None:
    method = request.get("method")
    request_id = request.get("id")
    if method == "initialize":
        requested_version = (request.get("params") or {}).get("protocolVersion") or "2025-06-18"
        return {"jsonrpc": "2.0", "id": request_id, "result": {"protocolVersion": requested_version, "capabilities": {"tools": {"listChanged": False}}, "serverInfo": {"name": "dashkit", "version": "0.1.0"}}}
    if method == "ping":
        return {"jsonrpc": "2.0", "id": request_id, "result": {}}
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": TOOLS}}
    if method == "tools/call":
        params = request.get("params") or {}
        name = params.get("name")
        handler = CALLS.get(name)
        if not handler:
            return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": f"Unknown tool: {name}"}}
        try:
            result = handler(params.get("arguments") or {})
            return {"jsonrpc": "2.0", "id": request_id, "result": result}
        except Exception as exc:  # keep the server alive for malformed agent input
            return {"jsonrpc": "2.0", "id": request_id, "result": text_result(f"Dashkit tool error: {exc}", True)}
    if method and request_id is not None:
        return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": f"Method not found: {method}"}}
    return None


def main() -> None:
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            request = json.loads(line)
            response = respond(request)
            if response is not None:
                sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
                sys.stdout.flush()
        except Exception as exc:
            sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": str(exc)}}) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
