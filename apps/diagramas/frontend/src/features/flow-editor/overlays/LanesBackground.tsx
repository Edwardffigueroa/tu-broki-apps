import { ViewportPortal } from '@xyflow/react'
import { COL_W, LANE_PAD, SLOT_H, contentWidth, laneGeometry, phaseGeometry } from '@flow'
import { useFlowCtx } from '../FlowCtx'

export function LanesBackground() {
  const { model, dropLaneId } = useFlowCtx()
  const lg = laneGeometry(model)
  const cw = contentWidth(model)
  const phases = model.phases || []

  return (
    <ViewportPortal>
      <div className="fs-lanes-bg" style={{ pointerEvents: 'none' }}>
        {model.lanes.map((lane, i) => (
          <div
            key={lane.id}
            className={`fs-lane-band${dropLaneId === lane.id ? ' drop-target' : ''}`}
            style={{
              position: 'absolute',
              left: 0,
              top: lg.tops[i],
              width: cw,
              height: lg.heights[i],
              // Pastel suave sobre paper: deja ver flechas y guías en modo claro
              background: `color-mix(in srgb, ${lane.color || `var(--lt${i % 6})`} 42%, var(--paper))`,
            }}
          >
            {Array.from({ length: Math.floor((lg.heights[i] - 2 * LANE_PAD) / SLOT_H) }).map(
              (_, si) => (
                <div
                  key={si}
                  className="fs-slot-guide"
                  style={{ top: LANE_PAD + si * SLOT_H }}
                />
              ),
            )}
          </div>
        ))}
        {phases.map((phase, j) => {
          const pg = phaseGeometry(model)
          const left = pg.lefts[j]
          const w = pg.widths[j]
          return (
            <div
              key={phase.id}
              className={`fs-phase-band${j % 2 === 0 ? ' alt' : ''}`}
              style={{
                position: 'absolute',
                left,
                top: 0,
                width: w,
                height: lg.total,
              }}
            />
          )
        })}
        {!phases.length &&
          Array.from({ length: Math.ceil(cw / COL_W) }).map((_, ci) => (
            <div
              key={ci}
              className="fs-col-guide"
              style={{ left: ci * COL_W + COL_W / 2, height: lg.total }}
            />
          ))}
      </div>
    </ViewportPortal>
  )
}
