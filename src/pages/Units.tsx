import { Accessibility, Building2, CalendarPlus, Clock, FlaskConical, List, Map as MapIcon, Navigation, Phone, Stethoscope } from 'lucide-react'
import { useMemo } from 'react'
import { Link, NavLink, useParams, useSearchParams } from 'react-router-dom'
import { Card, CrowdBadge, DemoTag, EmptyState, ErrorBox, InfoNote, PageHeader, QueueSourceLine, Spinner, inputClass } from '../components/ui'
import { LocationPicker } from '../components/LocationPicker'
import { UnitCard } from '../components/UnitCard'
import { MapLegend, UnitMap } from '../components/UnitMap'
import { useApp } from '../context/AppContext'
import type { HealthUnit, UnitType } from '../lib/types'
import { UNIT_TYPE_LABEL, distanceKm, effectiveLevel, formatKm, formatWait, isOpenNow, routeUrl } from '../lib/utils'

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function useFilteredUnits() {
  const { units, queues, specialties, location } = useApp()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const type = (params.get('tipo') ?? '') as UnitType | ''
  const spec = params.get('esp') ?? ''
  const maxKm = Number(params.get('km') ?? 0)
  const openOnly = params.get('aberta') === '1'

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const list = useMemo(() => {
    const nq = normalize(q)
    return units
      .map((u) => ({ u, d: distanceKm(location, u) }))
      .filter(({ u, d }) => {
        if (nq && !normalize(`${u.name} ${u.neighborhood} ${u.address} ${u.services.join(' ')}`).includes(nq)) return false
        if (type && u.type !== type) return false
        if (spec && !u.specialtyIds.includes(spec)) return false
        if (maxKm && d > maxKm) return false
        if (openOnly && !isOpenNow(u.hours)) return false
        return true
      })
      .sort((a, b) => a.d - b.d)
  }, [units, location, q, type, spec, maxKm, openOnly])

  const filters = (
    <div className="flex flex-col gap-3">
      <label htmlFor="f-q" className="sr-only">
        Buscar por nome, bairro ou serviço
      </label>
      <input id="f-q" value={q} onChange={(e) => set('q', e.target.value)} placeholder="Nome, bairro ou serviço" className={inputClass} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <select aria-label="Tipo de unidade" value={type} onChange={(e) => set('tipo', e.target.value)} className={inputClass}>
          <option value="">Todos os tipos</option>
          {(Object.keys(UNIT_TYPE_LABEL) as UnitType[]).map((t) => (
            <option key={t} value={t}>
              {UNIT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select aria-label="Especialidade" value={spec} onChange={(e) => set('esp', e.target.value)} className={inputClass}>
          <option value="">Qualquer especialidade</option>
          {specialties.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select aria-label="Distância máxima" value={maxKm || ''} onChange={(e) => set('km', e.target.value)} className={inputClass}>
          <option value="">Qualquer distância</option>
          <option value="1">Até 1 km</option>
          <option value="3">Até 3 km</option>
          <option value="5">Até 5 km</option>
        </select>
        <label className="flex min-h-12 items-center gap-2 rounded-2xl border-2 border-linha bg-white px-4">
          <input type="checkbox" className="size-5 accent-azul-700" checked={openOnly} onChange={(e) => set('aberta', e.target.checked ? '1' : '')} />
          Aberta agora
        </label>
      </div>
    </div>
  )
  return { list, filters, queues }
}

function ViewSwitch() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-bold ${isActive ? 'bg-azul-700 text-white' : 'text-azul-700'}`
  return (
    <div className="inline-flex rounded-2xl bg-white p-1 ring-1 ring-linha" role="tablist">
      <NavLink to="/unidades" className={cls} end>
        <List className="size-5" aria-hidden /> Lista
      </NavLink>
      <NavLink to="/mapa" className={cls}>
        <MapIcon className="size-5" aria-hidden /> Mapa
      </NavLink>
    </div>
  )
}

export function UnitsListPage() {
  const { catalogReady, catalogError, reloadCatalog } = useApp()
  const { list, filters, queues } = useFilteredUnits()
  return (
    <div>
      <PageHeader title="Unidades de saúde" subtitle="Ordenadas da mais próxima para a mais distante." action={<ViewSwitch />} />
      <div className="flex flex-col gap-4">
        <LocationPicker />
        {filters}
        {!catalogReady ? (
          <Spinner />
        ) : catalogError ? (
          <ErrorBox message={catalogError} onRetry={reloadCatalog} />
        ) : list.length === 0 ? (
          <EmptyState title="Nenhuma unidade com esses filtros">Remova algum filtro ou aumente a distância.</EmptyState>
        ) : (
          <>
            <p className="text-tinta-suave" aria-live="polite">
              {list.length} {list.length === 1 ? 'unidade encontrada' : 'unidades encontradas'}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map(({ u, d }) => (
                <UnitCard key={u.id} unit={u} queue={queues.find((x) => x.unitId === u.id)} distance={d} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function UnitsMapPage() {
  const { location, catalogReady } = useApp()
  const { list, filters, queues } = useFilteredUnits()
  return (
    <div>
      <PageHeader title="Mapa de unidades" subtitle="O ponto azul é a sua referência. A bolinha no marcador indica o movimento." action={<ViewSwitch />} />
      <div className="flex flex-col gap-4">
        <LocationPicker />
        {filters}
        {catalogReady ? <UnitMap units={list.map((x) => x.u)} queues={queues} center={location} height={460} /> : <Spinner />}
        <MapLegend />
        <ul className="flex flex-col divide-y divide-linha rounded-3xl bg-white ring-1 ring-linha">
          {list.map(({ u, d }) => (
            <li key={u.id}>
              <Link to={`/unidades/${u.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-azul-50">
                <span>
                  <span className="block font-semibold">{u.name}</span>
                  <span className="text-sm text-tinta-suave">{UNIT_TYPE_LABEL[u.type]}</span>
                </span>
                <span className="font-display font-semibold text-azul-700">{formatKm(d)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card as="section">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <span className="text-azul-500">{icon}</span> {title}
      </h2>
      {children}
    </Card>
  )
}

function Chips({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-tinta-suave">Não informado.</p>
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((i) => (
        <li key={i} className="rounded-full bg-azul-50 px-3 py-1 ring-1 ring-azul-100">
          {i}
        </li>
      ))}
    </ul>
  )
}

export function UnitDetailPage() {
  const { id } = useParams()
  const { units, queues, specialties, exams, location, catalogReady } = useApp()
  const unit: HealthUnit | undefined = units.find((u) => u.id === id)
  if (!catalogReady) return <Spinner />
  if (!unit) return <EmptyState title="Unidade não encontrada" action={<Link to="/unidades" className="font-bold text-azul-700 underline">Ver unidades</Link>} />
  const q = queues.find((x) => x.unitId === unit.id)
  const level = effectiveLevel(q)
  const open = isOpenNow(unit.hours)
  const unitSpecs = specialties.filter((s) => unit.specialtyIds.includes(s.id))
  const unitExams = exams.filter((e) => unit.examIds.includes(e.id))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back
        title={unit.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {UNIT_TYPE_LABEL[unit.type]} · {formatKm(distanceKm(location, unit))} de {location.label.toLowerCase().startsWith('sua') ? 'você' : location.label}
            {unit.isDemo && <DemoTag />}
          </span>
        }
      />

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CrowdBadge queue={q} />
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${open ? 'bg-azul-100 text-azul-900' : 'bg-slate-200 text-slate-700'}`}>{open ? 'Aberta agora' : 'Fechada agora'}</span>
          {q?.unitSituation === 'atendimento_restrito' && <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">Atendimento restrito</span>}
        </div>
        {level !== 'indisponivel' && (
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-azul-50 p-3">
              <dt className="text-sm text-tinta-suave">Pessoas aguardando</dt>
              <dd className="font-display text-2xl font-bold">{q?.peopleWaiting ?? '—'}</dd>
            </div>
            <div className="rounded-2xl bg-azul-50 p-3">
              <dt className="text-sm text-tinta-suave">Espera estimada</dt>
              <dd className="font-display text-2xl font-bold">{formatWait(q?.waitMinutes ?? null)}</dd>
            </div>
          </dl>
        )}
        <QueueSourceLine queue={q} />
        <div className="grid gap-2 sm:grid-cols-3">
          <a href={routeUrl(unit.lat, unit.lng)} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-azul-700 font-bold text-white hover:bg-azul-900">
            <Navigation className="size-5" aria-hidden /> Ver rota
          </a>
          {unitSpecs.length > 0 && (
            <Link to={`/consultas/agendar?unidade=${unit.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-verde-500 font-bold text-white hover:bg-verde-700">
              <CalendarPlus className="size-5" aria-hidden /> Agendar consulta
            </Link>
          )}
          {unit.phone && (
            <a href={`tel:${unit.phone.replace(/\D/g, '')}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-azul-100 font-bold text-azul-700 hover:border-azul-500">
              <Phone className="size-5" aria-hidden /> Ligar
            </a>
          )}
        </div>
      </Card>

      {unit.type === 'UPA' && <InfoNote>Em UPAs e prontos-socorros o atendimento segue a classificação de risco: casos mais graves são atendidos primeiro, independentemente da ordem de chegada.</InfoNote>}

      <div className="grid gap-4 md:grid-cols-2">
        <Section icon={<Building2 className="size-5" />} title="Endereço e contato">
          <p>{unit.address}</p>
          <p>
            {unit.neighborhood}, {unit.city} · CEP {unit.cep}
          </p>
          <p className="mt-2">Telefone: {unit.phone ?? 'não informado'}</p>
        </Section>
        <Section icon={<Clock className="size-5" />} title="Horário de funcionamento">
          <p className="text-lg font-semibold">{unit.hours.label}</p>
        </Section>
        <Section icon={<Stethoscope className="size-5" />} title="Serviços oferecidos">
          <Chips items={unit.services} />
        </Section>
        <Section icon={<Stethoscope className="size-5" />} title="Especialidades">
          <Chips items={unitSpecs.map((s) => s.name)} />
        </Section>
        <Section icon={<FlaskConical className="size-5" />} title="Exames">
          {unitExams.length ? (
            <ul className="flex flex-col gap-1">
              {unitExams.map((e) => (
                <li key={e.id}>
                  <Link to={`/exames/${e.id}?unidade=${unit.id}`} className="font-bold text-azul-700 underline">
                    {e.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-tinta-suave">Esta unidade não realiza exames agendados.</p>
          )}
        </Section>
        <Section icon={<Accessibility className="size-5" />} title="Acessibilidade">
          <Chips items={unit.accessibility} />
        </Section>
      </div>
    </div>
  )
}
