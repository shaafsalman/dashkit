import { useEffect, useRef, useState } from "react";

/**
 * useMeasuredBox — the one place chart components should get their real
 * pixel size from. Returns a ref to attach to the chart's outer container
 * and the container's live {width, height} via ResizeObserver.
 *
 * Why this exists: several charts (AreaTrendChart et al) used a FIXED SVG
 * viewBox (e.g. 600x244) sized for one specific card. Stretched into a
 * bento "fill" slot with a different aspect ratio, the browser's default
 * `preserveAspectRatio="xMidYMid meet"` centers that fixed-ratio content
 * inside the real box instead of filling it — the box grows, the content
 * doesn't, and the gap reads as "wasted space" or a chart that ignores its
 * own container. Any chart using this hook sets its viewBox to the
 * MEASURED box every render, so there is never a mismatched ratio to
 * letterbox in the first place — no hardcoded width/height constants,
 * no preserveAspectRatio tricks, it just always matches its parent.
 *
 * `minSize` guards initial render (before the first ResizeObserver
 * callback fires, when width/height are still 0) so charts have a sane
 * fallback instead of collapsing to a 0x0 box on first paint.
 */
export function useMeasuredBox(minSize = { width: 320, height: 180 }) {
  const ref = useRef(null);
  const [box, setBox] = useState(minSize);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      // Ignore transient 0-size frames (e.g. a parent mid-collapse) so the
      // chart doesn't flash empty — hold the last good measurement instead.
      if (width > 0 && height > 0) setBox({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, box];
}

export default useMeasuredBox;
