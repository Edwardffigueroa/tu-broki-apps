/**
 * Geometría del modelo swimlane-flow (puro).
 */

import {
  COL_W,
  GRID,
  LANE_DEFAULT_H,
  LANE_MIN_H,
  LANE_PAD,
  PHASE_DEFAULT_W,
  SLOT_H,
  clamp,
  laneHeightOf,
  nodeSize,
  slotsOfLane,
} from './schema.mjs';

export function laneGeometry(m) {
  const tops = [];
  const heights = [];
  const byId = {};
  let total = 0;
  for (let i = 0; i < m.lanes.length; i++) {
    const h = laneHeightOf(m.lanes[i]);
    tops.push(total);
    heights.push(h);
    byId[m.lanes[i].id] = { i, top: total, h };
    total += h;
  }
  return { tops, heights, total, byId };
}

export function phaseGeometry(m) {
  const phases = m.phases || [];
  const lefts = [];
  const widths = [];
  let total = 0;
  for (let i = 0; i < phases.length; i++) {
    const w = phases[i].width != null && Number.isFinite(+phases[i].width)
      ? +phases[i].width
      : PHASE_DEFAULT_W;
    lefts.push(total);
    widths.push(w);
    total += w;
  }
  return { lefts, widths, total };
}

export function contentWidth(m) {
  const pg = phaseGeometry(m);
  let maxX = 0;
  for (const n of m.nodes) {
    const { w } = nodeSize(n);
    maxX = Math.max(maxX, (n.x || 0) + w);
  }
  return Math.max(pg.total, maxX + 2 * COL_W, 6 * COL_W);
}

export function absolutePosition(m, n) {
  const g = laneGeometry(m);
  const top = g.byId[n.lane]?.top ?? 0;
  return { x: n.x || 0, y: top + (n.dy || 0) };
}

export function placeFromAbsolute(m, abs, size) {
  const g = laneGeometry(m);
  const cy = abs.y + size.h / 2;
  let laneIndex = 0;
  if (cy < 0) laneIndex = 0;
  else if (cy >= g.total) laneIndex = Math.max(0, m.lanes.length - 1);
  else {
    for (let i = 0; i < m.lanes.length; i++) {
      if (cy >= g.tops[i] && cy < g.tops[i] + g.heights[i]) {
        laneIndex = i;
        break;
      }
    }
  }
  const lane = m.lanes[laneIndex];
  const top = g.tops[laneIndex];
  const h = g.heights[laneIndex];
  const dy = clamp(Math.round((abs.y - top) / GRID) * GRID, 0, Math.max(0, h - size.h));
  const x = Math.max(0, Math.round(abs.x / GRID) * GRID);
  return { lane: lane.id, x, dy };
}

/** Intervalo de fase: [left, left+width). En el borde exacto → fase de la derecha. */
export function phaseAt(m, xCenter) {
  const g = phaseGeometry(m);
  const phases = m.phases || [];
  if (!phases.length) return null;
  for (let i = 0; i < phases.length; i++) {
    const left = g.lefts[i];
    const right = left + g.widths[i];
    if (xCenter >= left && xCenter < right) return phases[i].id;
  }
  if (xCenter >= g.total) return phases[phases.length - 1].id;
  return null;
}

export function colOf(xCenter) {
  return Math.floor(xCenter / COL_W) + 1;
}

export function slotOf(laneHeight, dyCenter) {
  const slots = slotsOfLane(laneHeight);
  const s = Math.floor((dyCenter - LANE_PAD) / SLOT_H) + 1;
  return clamp(s, 1, slots);
}

export function minLaneHeight(m, laneId) {
  let max = LANE_MIN_H;
  for (const n of m.nodes) {
    if (n.lane !== laneId) continue;
    const { h } = nodeSize(n);
    max = Math.max(max, (n.dy || 0) + h + LANE_PAD);
  }
  return max;
}

export { LANE_DEFAULT_H };
