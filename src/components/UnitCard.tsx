import { Clock, MapPin, Navigation } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { HealthUnit, QueueStatus } from '../lib/types'
import { UNIT_TYPE_COLOR, UNIT_TYPE_LABEL, effectiveLevel, formatKm, formatWait, isOpenNow, routeUrl } from '../lib/utils'
import { Card, CrowdBadge, DemoTag } from './ui'

export function UnitCard({ unit, queue, distance }: { unit: HealthUnit; queue: QueueStatus | undefined; distance: number | null }) {
  const open = isOpenNow(unit.hours)
  const level = effectiveLevel(queue)
  return (
    <Card as="article" className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-block h-10 w-1.5 shrink-0 rounded-full" style={{ background: UNIT_TYPE_COLOR[unit.type] }} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: UNIT_TYPE_COLOR[unit.type] }}>
            {UNIT_TYPE_LABEL[unit.type]}
          </p>
          <h3 className="text-lg font-semibold">{unit.name}</h3>
          <p className="flex items-center gap-1.5 text-tinta-suave">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate">
              {unit.address} · {unit.neighborhood}
            </span>
          </p>
        </div>
        {distance !== null && <span className="shrink-0 font-display font-semibold text-azul-700">{formatKm(distance)}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CrowdBadge queue={queue} />
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${open ? 'bg-azul-100 text-azul-900' : 'bg-slate-200 text-slate-700'}`}>
          <Clock className="size-4" aria-hidden />
          {open ? 'Aberta agora' : 'Fechada agora'}
        </span>
        {level !== 'indisponivel' && queue?.waitMinutes != null && <span className="text-sm text-tinta-suave">Espera aprox. {formatWait(queue.waitMinutes)}</span>}
        {unit.isDemo && <DemoTag />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={routeUrl(unit.lat, unit.lng)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-azul-100 font-bold text-azul-700 hover:border-azul-500"
        >
          <Navigation className="size-5" aria-hidden /> Ver rota
        </a>
        <Link to={`/unidades/${unit.id}`} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-azul-700 font-bold text-white hover:bg-azul-900">
          Ver detalhes
        </Link>
      </div>
    </Card>
  )
}
