import {
  monthsInData,
  mLabel,
  periodLabel,
} from '@finanzas'
import type { Movimiento } from '../lib/types'

export function PeriodSelect({
  period,
  movs,
  onChange,
}: {
  period: string
  movs: Movimiento[]
  onChange: (p: string) => void
}) {
  const ms = monthsInData(movs)
  const years = [...new Set(ms.map((k) => k.slice(0, 4)))].sort().reverse()
  const qs = [
    ...new Set(ms.map((k) => `${k.slice(0, 4)}-Q${Math.ceil(+k.slice(5, 7) / 3)}`)),
  ].sort().reverse()

  return (
    <select aria-label="Periodo" value={period} onChange={(e) => onChange(e.target.value)}>
      <option value="all">Todo</option>
      {years.map((y) => (
        <option key={y} value={`y:${y}`}>
          Año {y}
        </option>
      ))}
      {qs.map((q) => (
        <option key={q} value={`q:${q}`}>
          {periodLabel(`q:${q}`)}
        </option>
      ))}
      {[...ms].reverse().map((m) => (
        <option key={m} value={`m:${m}`}>
          {mLabel(m)}
        </option>
      ))}
    </select>
  )
}
