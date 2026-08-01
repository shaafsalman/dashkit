import { useState, useLayoutEffect, useRef } from "react";

/**
 * Container-query density for the ranked widget.
 *
 * The widget's chrome used to key off viewport breakpoints (`sm:hidden` etc),
 * which is wrong the moment two widgets sit side by side in a grid: the
 * viewport is "large" but each widget is actually half that wide, so it kept
 * rendering full-width controls into a narrow box. This measures the widget's
 * OWN rendered width instead, so a widget in a half-width grid cell gets the
 * same compact chrome a phone would.
 *
 *   sm  < 520px  — icon-only controls, stats closed, tightest padding
 *   md  < 900px  — icon-only controls, stats closed, sort behind ⋯
 *   lg  >= 900px — labels on every control, stats open, sort inline
 *
 * Labels only survive at `lg`. Five view-mode buttons with text plus the two
 * sort buttons need ~560px on their own, so anything narrower was wrapping the
 * footer onto a second line and stealing height from the plot.
 */
const SM_MAX = 520;
const MD_MAX = 900;

export const useContainerDensity = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w =
          entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        // Ignore the 0-width frame React can hand us mid-layout — committing it
        // would flash the widget into `sm` chrome before the real box lands.
        if (w > 0) setWidth(w);
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Until the first measurement, assume `lg` rather than `sm`: an unmeasured
  // widget rendering full chrome for one frame reads as normal, whereas
  // starting compact makes every widget visibly "pop" wider on mount.
  const density = width === null ? "lg" : width < SM_MAX ? "sm" : width < MD_MAX ? "md" : "lg";

  return [ref, density, width];
};

export default useContainerDensity;
