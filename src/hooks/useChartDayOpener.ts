import { useRef, useState } from "react";

/**
 * Opening one day from a distress trajectory chart.
 *
 * Shared by the participant's own chart and the counsellor's view of it, so
 * the recharts quirks below are fixed in one place rather than twice. Both
 * charts plot the same check-ins in the same order, so an index means the same
 * thing on either.
 *
 * THE TWO QUIRKS, BOTH FOUND BY TESTING
 *
 * `activeTooltipIndex` is `number | string | null` in recharts 3 — TooltipIndex
 * is a string — so it is coerced rather than type-checked. A
 * `typeof === "number"` guard looked obviously correct and silently dropped
 * every click.
 *
 * And on touch, recharts hands external handlers a null index even while its
 * own tooltip is on screen showing the point. A tap therefore fell through
 * entirely and the feature worked on a mouse only. Where the index is missing
 * it is recovered from the rendered dots, which are in data order and are the
 * things a finger is actually aiming at.
 */

/**
 * Marks the dots belonging to the distress series.
 *
 * The counsellor's chart draws a second area for their own marks, and its dots
 * carry `recharts-area-dot` too. Measuring against both would interleave two
 * series and open the wrong day, so the series that can be opened says so.
 */
export const SCORE_DOT_CLASS = "aura-score-dot";

export function useChartDayOpener(count: number) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);

  /** The distress dot nearest this x position, or null if none can be measured. */
  const nearestPointTo = (clientX: number): number | null => {
    const root = chartRef.current;
    if (!root) return null;
    // Falls back to every area dot only when the marked class is absent, which
    // means a single-series chart where there is nothing to confuse it with.
    const scoped = root.querySelectorAll(`.${SCORE_DOT_CLASS}`);
    const dots = scoped.length > 0 ? scoped : root.querySelectorAll(".recharts-area-dot");
    if (dots.length === 0) return null;

    let best = -1;
    let bestGap = Infinity;
    dots.forEach((dot, idx) => {
      const r = dot.getBoundingClientRect();
      const gap = Math.abs(r.left + r.width / 2 - clientX);
      if (gap < bestGap) {
        bestGap = gap;
        best = idx;
      }
    });
    return best >= 0 && best < count ? best : null;
  };

  const openDayFromChart = (state: any, event?: any) => {
    // Touch is handled entirely by coordinate, because the index recharts
    // reports for a tap cannot be trusted: on one chart it arrives null, and
    // on another it arrives stale — the same "5" whether the finger lands on
    // the first point or the third. Both were measured. Where the finger
    // actually went is the only signal a tap reliably carries.
    const touchX = event?.changedTouches?.[0]?.clientX;
    if (typeof touchX === "number") {
      const tapped = nearestPointTo(touchX);
      if (tapped !== null) setOpenDay(tapped);
      return;
    }

    const raw = state?.activeTooltipIndex ?? state?.activeIndex;
    const i = Number(raw);
    if (raw !== null && raw !== undefined && Number.isInteger(i) && i >= 0 && i < count) {
      setOpenDay(i);
      return;
    }

    // A mouse click that arrived without an index still knows where it was.
    const clientX = event?.clientX;
    if (typeof clientX !== "number") return;
    const nearest = nearestPointTo(clientX);
    if (nearest !== null) setOpenDay(nearest);
  };

  return { chartRef, openDay, setOpenDay, openDayFromChart };
}
