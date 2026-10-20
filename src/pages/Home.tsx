import { AlertCircle, CalendarPlus, FlaskConical, MapPinned, Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BigAction, Card, CrowdDot, EmergencyBanner, ErrorBox, Spinner, StatusBadge } from '../components/ui'
import { MapLegend, UnitMap } from '../components/UnitMap'
import { UnitCard } from '../components/UnitCard'
import { useApp } from '../context/AppContext'
import type { Appointment, Notice } from '../lib/types'
import { ACTIVE_STATUSES, CROWD, distanceKm, effectiveLevel, firstName, formatDateLong, formatKm, formatTime, greeting } from '../lib/utils'
import { api } from '../services'

export function HomePage() {
  const { user, units, queues, specialties, exams, location, catalogReady, catalogError, reloadCatalog } = useApp()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [appts, setAppts] = useState<Appointment[] | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])

  useEffect(() => {
    api.listMyAppointments().then(setAppts).catch(() => setAppts([]))
    api.listNotices().then(setNotices)
  }, [])

  const nearby = useMemo(
    () =>
      units
        .map((u) => ({ u, d: distanceKm(location, u) }))
        .sort((a, b) => a.d - b.d),
    [units, location],
  )

  const upcoming = (appts ?? []).filter((a) => ACTIVE_STATUSES.includes(a.status)).slice(0, 3)

  function search(e: FormEvent) {
    e.preventDefault()
    nav(`/unidades${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
  }

  const itemName = (a: Appointment) =>
    a.kind === 'consulta' ? specialties.find((s) => s.id === a.refId)?.name : exams.find((e) => e.id === a.refId)?.name

  return (
    <div className="flex flex-col gap-7">
      <section>
        <p className="text-tinta-suave">{greeting()},</p>
        <h1 className="text-3xl font-bold md:text-4xl">{user ? firstName(user.fullName) : 'bem-vindo'}</h1>
        <form onSubmit={search} role="search" className="mt-4 flex items-center gap-2 rounded-3xl bg-white p-2 pl-4 ring-2 ring-azul-100 focus-within:ring-azul-500">
          <Search className="size-6 shrink-0 text-azul-500" aria-hidden />
          <label htmlFor="busca" className="sr-only">
            Encontre uma unidade de saúde
          </label>
          <input
            id="busca"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Encontre uma unidade de saúde"
            className="min-h-12 min-w-0 flex-1 bg-transparent text-lg placeholder:text-tinta-suave/80 focus:outline-none"
          />
          <button type="submit" className="min-h-12 rounded-2xl bg-azul-700 px-5 font-bold text-white hover:bg-azul-900">
            Buscar
          </button>
        </form>
      </section>

      <section aria-label="Ações principais" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigAction to="/consultas/agendar" icon={<CalendarPlus className="size-6" />} title="Agendar consulta" tone="azul" />
        <BigAction to="/exames" icon={<FlaskConical className="size-6" />} title="Agendar exame" tone="verde" />
        <BigAction to="/unidades" icon={<MapPinned className="size-6" />} title="Unidades próximas" tone="branco" />
        <BigAction to="/filas" icon={<Users className="size-6" />} title="Consultar filas" tone="branco" />
      </section>

      {/* Pulso do bairro: lotação das unidades mais próximas num relance */}
      <section aria-labelledby="pulso-titulo">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="pulso-titulo" className="text-xl font-bold">
            Movimento perto de você
          </h2>
          <Link to="/filas" className="font-bold text-azul-700 underline">
            Ver todas
          </Link>
        </div>
        {!catalogReady ? (
          <Spinner />
        ) : catalogError ? (
          <ErrorBox message={catalogError} onRetry={reloadCatalog} />
        ) : (
          <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:px-0">
            {nearby.slice(0, 4).map(({ u, d }) => {
              const qs = queues.find((x) => x.unitId === u.id)
              const lvl = effectiveLevel(qs)
              const fill = { baixo: 1, moderado: 2, alto: 3, indisponivel: 0 }[lvl]
              return (
                <li key={u.id} className="w-56 shrink-0 snap-start md:w-auto">
                  <Link to={`/unidades/${u.id}`} className="block h-full rounded-3xl bg-white p-4 ring-1 ring-linha hover:ring-azul-500">
                    <div className="flex items-end gap-1" aria-hidden>
                      {[1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`w-4 rounded-md ${lvl === 'indisponivel' ? 'pulso' : ''}`}
                          style={{ height: 10 + i * 9, background: i <= fill ? CROWD[lvl].color : '#E3EAF2' }}
                        />
                      ))}
                      <span className="ml-auto text-sm font-bold text-tinta-suave">{formatKm(d)}</span>
                    </div>
                    <p className="mt-3 font-display font-semibold leading-tight">{u.name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-bold" style={{ color: CROWD[lvl].color }}>
                      <CrowdDot level={lvl} size={9} /> {CROWD[lvl].label}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-7 lg:grid-cols-[1.1fr_1fr] [&>*]:min-w-0">
        <section aria-labelledby="prox-titulo">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="prox-titulo" className="text-xl font-bold">
              Próximos agendamentos
            </h2>
            <Link to="/agendamentos" className="font-bold text-azul-700 underline">
              Ver todos
            </Link>
          </div>
          {appts === null ? (
            <Spinner />
          ) : upcoming.length === 0 ? (
            <Card className="text-center">
              <p className="font-semibold">Nenhum agendamento ativo.</p>
              <Link to="/consultas/agendar" className="mt-2 inline-block font-bold text-azul-700 underline">
                Agendar uma consulta
              </Link>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link to={`/agendamentos#${a.id}`} className="flex items-center gap-4 rounded-3xl bg-white p-4 ring-1 ring-linha hover:ring-azul-500">
                    <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-azul-100 text-center font-display text-azul-900">
                      {a.startsAt ? (
                        <span>
                          <span className="block text-xl font-bold leading-none">{new Date(a.startsAt).getDate()}</span>
                          <span className="block text-xs">{new Date(a.startsAt).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                        </span>
                      ) : (
                        <span className="text-xs font-bold">a definir</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{itemName(a)}</p>
                      <p className="truncate text-sm text-tinta-suave">
                        {units.find((u) => u.id === a.unitId)?.name}
                        {a.startsAt && ` · ${formatDateLong(a.startsAt)}, ${formatTime(a.startsAt)}`}
                      </p>
                      <div className="mt-1.5">
                        <StatusBadge status={a.status} />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="avisos-titulo">
          <h2 id="avisos-titulo" className="mb-3 text-xl font-bold">
            Avisos
          </h2>
          <ul className="flex flex-col gap-3">
            {notices.map((n) => (
              <li key={n.id} className={`flex gap-3 rounded-3xl p-4 ${n.tone === 'alerta' ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-white ring-1 ring-linha'}`}>
                <AlertCircle className={`mt-0.5 size-5 shrink-0 ${n.tone === 'alerta' ? 'text-amber-700' : 'text-azul-500'}`} aria-hidden />
                <div>
                  <p className="font-bold">{n.title}</p>
                  <p className="text-tinta-suave">{n.body}</p>
                </div>
              </li>
            ))}
            <li>
              <EmergencyBanner />
            </li>
          </ul>
        </section>
      </div>

      <section aria-labelledby="mapa-titulo">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="mapa-titulo" className="text-xl font-bold">
            Unidades próximas de você
          </h2>
          <Link to="/mapa" className="font-bold text-azul-700 underline">
            Abrir mapa
          </Link>
        </div>
        <p className="mb-3 text-sm text-tinta-suave">Referência: {location.label}</p>
        {catalogReady && <UnitMap units={units} queues={queues} center={location} height={300} />}
        <div className="mt-3">
          <MapLegend />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {nearby.slice(0, 2).map(({ u, d }) => (
            <UnitCard key={u.id} unit={u} queue={queues.find((x) => x.unitId === u.id)} distance={d} />
          ))}
        </div>
      </section>
    </div>
  )
}
