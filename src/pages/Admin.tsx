import { AlertTriangle, BarChart3, Building2, CalendarClock, ClipboardList, Trash2, Users, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Card, CrowdDot, EmptyState, ErrorBox, Field, InfoNote, PageHeader, QueueSourceLine, Spinner, StatusBadge, SuccessBox, inputClass } from '../components/ui'
import { useApp } from '../context/AppContext'
import type { Appointment, AppointmentStatus, CrowdLevel, HealthUnit, QueueStatus, QueueUpdateLog, Role, Slot, UnitType, UserProfile } from '../lib/types'
import { CROWD, SOURCE_LABEL, STATUS_INFO, UNIT_TYPE_LABEL, formatDate, formatDateLong, formatRelative, formatTime, isStale } from '../lib/utils'
import { api } from '../services'

type Tab = 'resumo' | 'filas' | 'agendamentos' | 'horarios' | 'unidades' | 'usuarios'

export function AdminPage() {
  const { user, units } = useApp()
  const [tab, setTab] = useState<Tab>('resumo')
  const isAdmin = user?.role === 'admin'
  const myUnits = useMemo(() => (isAdmin ? units : units.filter((u) => user?.managedUnitIds.includes(u.id))), [units, user, isAdmin])

  const TABS: { id: Tab; label: string; icon: typeof BarChart3; adminOnly?: boolean }[] = [
    { id: 'resumo', label: 'Resumo', icon: BarChart3 },
    { id: 'filas', label: 'Filas', icon: UsersRound },
    { id: 'agendamentos', label: 'Agendamentos', icon: ClipboardList },
    { id: 'horarios', label: 'Horários', icon: CalendarClock },
    { id: 'unidades', label: 'Unidades', icon: Building2 },
    { id: 'usuarios', label: 'Usuários', icon: Users, adminOnly: true },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Painel da unidade"
        subtitle={isAdmin ? 'Acesso de administrador: todas as unidades.' : `Você gerencia: ${myUnits.map((u) => u.name).join(', ') || 'nenhuma unidade'}.`}
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Seções do painel">
        {TABS.filter((t) => !t.adminOnly || isAdmin).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl px-4 font-bold ${tab === id ? 'bg-verde-500 text-white' : 'bg-white text-verde-700 ring-1 ring-linha'}`}
          >
            <Icon className="size-5" aria-hidden /> {label}
          </button>
        ))}
      </div>
      {myUnits.length === 0 && !isAdmin ? (
        <EmptyState title="Nenhuma unidade vinculada">Peça a um administrador para vincular você a uma unidade.</EmptyState>
      ) : (
        <>
          {tab === 'resumo' && <Summary units={myUnits} />}
          {tab === 'filas' && <QueueAdmin units={myUnits} />}
          {tab === 'agendamentos' && <AppointmentsAdmin units={myUnits} />}
          {tab === 'horarios' && <SlotsAdmin units={myUnits} />}
          {tab === 'unidades' && <UnitsAdmin units={myUnits} canCreate={isAdmin} />}
          {tab === 'usuarios' && isAdmin && <UsersAdmin />}
        </>
      )}
    </div>
  )
}

function UnitSelect({ units, value, onChange, id = 'unit-sel' }: { units: HealthUnit[]; value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {units.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  )
}

// ---------------- Resumo / relatórios ----------------
function Summary({ units }: { units: HealthUnit[] }) {
  const { queues } = useApp()
  const [appts, setAppts] = useState<Appointment[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    api.listUnitAppointments().then(setAppts).catch((e) => setErr(e.message))
  }, [])
  if (err) return <ErrorBox message={err} />
  if (!appts) return <Spinner />

  const byStatus = (s: AppointmentStatus) => appts.filter((a) => a.status === s).length
  const outdated = units.filter((u) => {
    const q = queues.find((x) => x.unitId === u.id)
    return !q || q.source === 'indisponivel' || isStale(q)
  })
  const changeReqs = appts.filter((a) => a.changeRequested).length

  const stats = [
    { label: 'Confirmados', value: byStatus('confirmada'), cls: 'text-verde-700' },
    { label: 'Aguardando autorização', value: byStatus('aguardando_autorizacao'), cls: 'text-amber-800' },
    { label: 'Solicitados', value: byStatus('solicitada'), cls: 'text-azul-700' },
    { label: 'Cancelados', value: byStatus('cancelada'), cls: 'text-slate-600' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className={`font-display text-4xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-tinta-suave">{s.label}</p>
          </Card>
        ))}
      </div>
      {changeReqs > 0 && <InfoNote>{changeReqs} pedido(s) de alteração aguardando resposta na aba Agendamentos.</InfoNote>}
      <Card as="section">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <AlertTriangle className="size-5 text-amber-600" aria-hidden /> Informações desatualizadas
        </h2>
        {outdated.length === 0 ? (
          <p className="text-verde-700">Todas as filas foram atualizadas na última hora.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {outdated.map((u) => {
              const q = queues.find((x) => x.unitId === u.id)
              return (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-50 p-3">
                  <span className="font-semibold">{u.name}</span>
                  <span className="text-sm">Fila {q?.updatedAt ? `atualizada ${formatRelative(q.updatedAt)}` : 'nunca informada'}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <Card as="section">
        <h2 className="mb-3 text-lg font-bold">Atendimentos por unidade</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left">
            <thead className="text-sm text-tinta-suave">
              <tr>
                <th className="py-2 font-normal">Unidade</th>
                <th className="py-2 font-normal">Ativos</th>
                <th className="py-2 font-normal">Cancelados</th>
                <th className="py-2 font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const list = appts.filter((a) => a.unitId === u.id)
                return (
                  <tr key={u.id} className="border-t border-linha">
                    <td className="py-2.5 font-semibold">{u.name}</td>
                    <td>{list.filter((a) => ['confirmada', 'solicitada', 'aguardando_autorizacao'].includes(a.status)).length}</td>
                    <td>{list.filter((a) => a.status === 'cancelada').length}</td>
                    <td>{list.length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ---------------- Filas ----------------
function QueueAdmin({ units }: { units: HealthUnit[] }) {
  const { queues, reloadQueues } = useApp()
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const current = queues.find((q) => q.unitId === unitId)
  const [form, setForm] = useState<{ level: CrowdLevel; people: string; wait: string; serviceType: string; situation: QueueStatus['unitSituation'] }>({
    level: 'baixo',
    people: '',
    wait: '',
    serviceType: 'Acolhimento e consultas',
    situation: 'aberta',
  })
  const [logs, setLogs] = useState<QueueUpdateLog[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (current)
      setForm({
        level: current.level,
        people: current.peopleWaiting?.toString() ?? '',
        wait: current.waitMinutes?.toString() ?? '',
        serviceType: current.serviceType,
        situation: current.unitSituation,
      })
    setMsg(null)
    api.listQueueLogs(unitId).then(setLogs).catch(() => setLogs([]))
  }, [unitId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: FormEvent) {
    e.preventDefault()
    const people = form.people === '' ? null : Number(form.people)
    const wait = form.wait === '' ? null : Number(form.wait)
    if ((people !== null && (people < 0 || people > 2000)) || (wait !== null && (wait < 0 || wait > 1440))) {
      setErr('Confira os números: pessoas entre 0 e 2000, espera entre 0 e 1440 minutos.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      await api.updateQueue({ unitId, level: form.level, peopleWaiting: form.level === 'indisponivel' ? null : people, waitMinutes: form.level === 'indisponivel' ? null : wait, serviceType: form.serviceType, unitSituation: form.situation })
      await reloadQueues()
      setLogs(await api.listQueueLogs(unitId))
      setMsg('Fila atualizada. A data, a hora e seu nome foram registrados.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card as="section">
        <h2 className="mb-4 text-lg font-bold">Atualizar lotação</h2>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Unidade" htmlFor="q-unit">
            <UnitSelect id="q-unit" units={units} value={unitId} onChange={setUnitId} />
          </Field>
          <fieldset>
            <legend className="mb-2 font-bold">Nível de movimento</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['baixo', 'moderado', 'alto', 'indisponivel'] as CrowdLevel[]).map((l) => (
                <label key={l} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl px-3 ring-2 ${form.level === l ? 'ring-azul-500 bg-azul-50' : 'ring-linha'}`}>
                  <input type="radio" name="level" className="sr-only" checked={form.level === l} onChange={() => setForm({ ...form, level: l })} />
                  <CrowdDot level={l} /> {CROWD[l].short}
                </label>
              ))}
            </div>
          </fieldset>
          {form.level !== 'indisponivel' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pessoas aguardando" htmlFor="q-people" hint="Deixe vazio se não souber.">
                <input id="q-people" type="number" min={0} inputMode="numeric" className={inputClass} value={form.people} onChange={(e) => setForm({ ...form, people: e.target.value })} />
              </Field>
              <Field label="Espera estimada (min)" htmlFor="q-wait" hint="Estimativa da unidade.">
                <input id="q-wait" type="number" min={0} inputMode="numeric" className={inputClass} value={form.wait} onChange={(e) => setForm({ ...form, wait: e.target.value })} />
              </Field>
            </div>
          )}
          <Field label="Tipo de atendimento" htmlFor="q-type">
            <input id="q-type" className={inputClass} value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} />
          </Field>
          <Field label="Situação da unidade" htmlFor="q-sit">
            <select id="q-sit" className={inputClass} value={form.situation} onChange={(e) => setForm({ ...form, situation: e.target.value as QueueStatus['unitSituation'] })}>
              <option value="aberta">Aberta</option>
              <option value="atendimento_restrito">Atendimento restrito</option>
              <option value="fechada">Fechada</option>
            </select>
          </Field>
          {err && <ErrorBox message={err} />}
          {msg && <SuccessBox>{msg}</SuccessBox>}
          <Button type="submit" variant="green" loading={saving}>
            Publicar atualização
          </Button>
        </form>
      </Card>
      <div className="flex flex-col gap-4">
        <Card as="section">
          <h2 className="mb-2 text-lg font-bold">Situação publicada</h2>
          <p className="flex items-center gap-2 font-semibold">
            <CrowdDot level={current?.level ?? 'indisponivel'} /> {CROWD[current?.level ?? 'indisponivel'].label}
          </p>
          <QueueSourceLine queue={current} />
        </Card>
        <Card as="section">
          <h2 className="mb-2 text-lg font-bold">Histórico de atualizações</h2>
          {logs.length === 0 ? (
            <p className="text-tinta-suave">Nenhuma atualização registrada pelo painel ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-linha">
              {logs.slice(0, 15).map((l) => (
                <li key={l.id} className="py-2 text-sm">
                  <span className="flex items-center gap-2 font-semibold">
                    <CrowdDot level={l.level} size={9} /> {CROWD[l.level].short}
                    {l.peopleWaiting != null && ` · ${l.peopleWaiting} pessoas`}
                    {l.waitMinutes != null && ` · ${l.waitMinutes} min`}
                  </span>
                  <span className="text-tinta-suave">
                    {formatDate(l.updatedAt)} {formatTime(l.updatedAt)} · {l.updatedBy} · {SOURCE_LABEL[l.source]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

// ---------------- Agendamentos ----------------
function AppointmentsAdmin({ units }: { units: HealthUnit[] }) {
  const { specialties, exams } = useApp()
  const [list, setList] = useState<Appointment[] | null>(null)
  const [filter, setFilter] = useState<AppointmentStatus | 'todos' | 'alteracao'>('aguardando_autorizacao')
  const [unitId, setUnitId] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(() => {
    api.listUnitAppointments().then(setList).catch((e) => setErr(e.message))
  }, [])
  useEffect(load, [load])

  const shown = (list ?? []).filter(
    (a) => (!unitId || a.unitId === unitId) && (filter === 'todos' || (filter === 'alteracao' ? a.changeRequested : a.status === filter)),
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 md:grid-cols-2">
        <select aria-label="Filtrar por situação" className={inputClass} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="aguardando_autorizacao">Aguardando autorização</option>
          <option value="alteracao">Com pedido de alteração</option>
          <option value="confirmada">Confirmados</option>
          <option value="solicitada">Solicitados</option>
          <option value="cancelada">Cancelados</option>
          <option value="todos">Todos</option>
        </select>
        <select aria-label="Filtrar por unidade" className={inputClass} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          <option value="">Todas as minhas unidades</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      {err && <ErrorBox message={err} />}
      {!list ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState title="Nenhum agendamento com este filtro" />
      ) : (
        shown.map((a) => (
          <AdminAppointmentRow
            key={a.id}
            a={a}
            unitName={units.find((u) => u.id === a.unitId)?.name ?? a.unitId}
            itemName={(a.kind === 'consulta' ? specialties.find((s) => s.id === a.refId)?.name : exams.find((e) => e.id === a.refId)?.name) ?? a.refId}
            onChanged={load}
          />
        ))
      )}
    </div>
  )
}

function AdminAppointmentRow({ a, unitName, itemName, onChanged }: { a: Appointment; unitName: string; itemName: string; onChanged: () => void }) {
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [slotId, setSlotId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function setStatus(status: AppointmentStatus) {
    setBusy(true)
    setErr(null)
    try {
      await api.setAppointmentStatus(a.id, status, slotId || null)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setBusy(false)
    }
  }

  async function loadSlots() {
    const s = await api.listSlots({ kind: a.kind, refId: a.refId, unitId: a.unitId })
    setSlots(s.filter((x) => !x.booked))
  }

  const active = ['solicitada', 'aguardando_autorizacao', 'confirmada'].includes(a.status)

  return (
    <Card as="article" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {a.kind === 'consulta' ? 'Consulta' : 'Exame'}: {itemName}
          </p>
          <p className="text-sm text-tinta-suave">
            {unitName} · {a.protocol} · pedido em {formatDate(a.createdAt)}
          </p>
          <p className="text-sm">{a.startsAt ? `${formatDateLong(a.startsAt)}, ${formatTime(a.startsAt)}` : 'Sem horário definido'}</p>
        </div>
        <StatusBadge status={a.status} />
      </div>
      {a.note && <p className="rounded-2xl bg-azul-50 p-3 text-sm">{a.changeRequested ? 'Pedido de alteração: ' : 'Observação: '}“{a.note}”</p>}
      {err && <ErrorBox message={err} />}
      {active && (
        <div className="flex flex-wrap items-end gap-2">
          {a.status !== 'confirmada' && (
            <>
              {slots === null ? (
                <Button variant="secondary" onClick={loadSlots}>
                  Autorizar e definir horário
                </Button>
              ) : slots.length === 0 ? (
                <p className="text-sm font-bold text-red-700">Sem horários livres. Cadastre vagas na aba Horários.</p>
              ) : (
                <>
                  <select aria-label="Horário" className={`${inputClass} md:w-72`} value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                    <option value="">Escolha o horário</option>
                    {slots.slice(0, 40).map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatDate(s.startsAt)} {formatTime(s.startsAt)}
                      </option>
                    ))}
                  </select>
                  <Button variant="green" disabled={!slotId} loading={busy} onClick={() => setStatus('confirmada')}>
                    Confirmar
                  </Button>
                </>
              )}
            </>
          )}
          {a.status === 'confirmada' && a.startsAt && new Date(a.startsAt) < new Date() && (
            <Button variant="secondary" loading={busy} onClick={() => setStatus('realizada')}>
              Marcar como realizada
            </Button>
          )}
          <Button variant="danger" loading={busy} onClick={() => setStatus('cancelada')}>
            Cancelar
          </Button>
        </div>
      )}
      <p className="text-sm text-tinta-suave">{STATUS_INFO[a.status].help}</p>
    </Card>
  )
}

// ---------------- Horários ----------------
function SlotsAdmin({ units }: { units: HealthUnit[] }) {
  const { specialties, exams } = useApp()
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const unit = units.find((u) => u.id === unitId)
  const items = useMemo(
    () => [
      ...specialties.filter((s) => unit?.specialtyIds.includes(s.id)).map((s) => ({ key: `consulta:${s.id}`, label: `Consulta · ${s.name}` })),
      ...exams.filter((e) => unit?.examIds.includes(e.id)).map((e) => ({ key: `exame:${e.id}`, label: `Exame · ${e.name}` })),
    ],
    [unit, specialties, exams],
  )
  const [item, setItem] = useState('')
  const [date, setDate] = useState('')
  const [times, setTimes] = useState('08:00, 08:30, 09:00, 09:30')
  const [professional, setProfessional] = useState('')
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setItem(items[0]?.key ?? '')
  }, [items])

  const load = useCallback(() => {
    if (!item) return setSlots([])
    const [kind, refId] = item.split(':') as ['consulta' | 'exame', string]
    api.listSlots({ kind, refId, unitId }).then(setSlots)
  }, [item, unitId])
  useEffect(load, [load])

  async function create(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    const list = times
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    if (!date || new Date(`${date}T23:59`) < new Date()) return setErr('Escolha uma data de hoje em diante.')
    if (!list.length || list.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) return setErr('Use horários no formato 08:00, separados por vírgula.')
    const [kind, refId] = item.split(':') as ['consulta' | 'exame', string]
    setBusy(true)
    try {
      const n = await api.createSlots(
        list.map((t) => ({ unitId, kind, refId, startsAt: new Date(`${date}T${t}:00`).toISOString(), durationMin: 30, professional: professional.trim() || null })),
      )
      setMsg(n === list.length ? `${n} horário(s) criados.` : `${n} criado(s). ${list.length - n} já existiam e foram ignorados.`)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao criar.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setErr(null)
    try {
      await api.deleteSlot(id)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao remover.')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card as="section">
        <h2 className="mb-4 text-lg font-bold">Abrir horários</h2>
        <form onSubmit={create} className="flex flex-col gap-4">
          <Field label="Unidade" htmlFor="s-unit">
            <UnitSelect id="s-unit" units={units} value={unitId} onChange={setUnitId} />
          </Field>
          {items.length === 0 ? (
            <InfoNote>Esta unidade não tem especialidades ou exames cadastrados. Edite a unidade na aba Unidades.</InfoNote>
          ) : (
            <>
              <Field label="Atendimento" htmlFor="s-item">
                <select id="s-item" className={inputClass} value={item} onChange={(e) => setItem(e.target.value)}>
                  {items.map((i) => (
                    <option key={i.key} value={i.key}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Data" htmlFor="s-date">
                <input id="s-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Horários" htmlFor="s-times" hint="Separados por vírgula. Horários repetidos são ignorados.">
                <input id="s-times" className={inputClass} value={times} onChange={(e) => setTimes(e.target.value)} />
              </Field>
              <Field label="Profissional (opcional)" htmlFor="s-prof">
                <input id="s-prof" className={inputClass} value={professional} onChange={(e) => setProfessional(e.target.value)} />
              </Field>
              {err && <ErrorBox message={err} />}
              {msg && <SuccessBox>{msg}</SuccessBox>}
              <Button type="submit" variant="green" loading={busy}>
                Abrir horários
              </Button>
            </>
          )}
        </form>
      </Card>
      <Card as="section">
        <h2 className="mb-3 text-lg font-bold">Próximos horários</h2>
        {slots === null ? (
          <Spinner />
        ) : slots.length === 0 ? (
          <p className="text-tinta-suave">Nenhum horário futuro.</p>
        ) : (
          <ul className="flex max-h-[28rem] flex-col divide-y divide-linha overflow-y-auto">
            {slots.slice(0, 60).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-semibold">
                    {formatDate(s.startsAt)} {formatTime(s.startsAt)}
                  </span>
                  <span className={`ml-2 text-sm ${s.booked ? 'text-verde-700' : 'text-tinta-suave'}`}>{s.booked ? 'Ocupado' : 'Livre'}</span>
                </span>
                {!s.booked && (
                  <button onClick={() => remove(s.id)} className="grid size-11 place-items-center rounded-full text-red-700 hover:bg-red-50" aria-label={`Remover horário ${formatDate(s.startsAt)} ${formatTime(s.startsAt)}`}>
                    <Trash2 className="size-5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

// ---------------- Unidades ----------------
const EMPTY_UNIT: HealthUnit = {
  id: '',
  name: '',
  type: 'UBS',
  address: '',
  neighborhood: '',
  city: 'São Paulo - SP',
  cep: '',
  lat: -23.55,
  lng: -46.63,
  phone: null,
  hours: { label: 'Seg a sex, 7h às 19h', open24h: false, weekdays: { open: '07:00', close: '19:00' }, saturday: null },
  services: [],
  specialtyIds: [],
  examIds: [],
  accessibility: [],
  isDemo: true,
}

function UnitsAdmin({ units, canCreate }: { units: HealthUnit[]; canCreate: boolean }) {
  const { specialties, exams, reloadCatalog } = useApp()
  const [editing, setEditing] = useState<HealthUnit | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const csv = (a: string[]) => a.join(', ')
  const parse = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    if (editing.name.trim().length < 3 || !editing.address.trim() || !editing.neighborhood.trim()) {
      setErr('Preencha nome, endereço e bairro.')
      return
    }
    if (Number.isNaN(editing.lat) || Number.isNaN(editing.lng) || Math.abs(editing.lat) > 90 || Math.abs(editing.lng) > 180) {
      setErr('Coordenadas inválidas.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const id = editing.id || editing.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      await api.saveUnit({ ...editing, id })
      await reloadCatalog()
      setMsg('Unidade salva.')
      setEditing(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    const toggle = (field: 'specialtyIds' | 'examIds', id: string) =>
      setEditing({ ...editing, [field]: editing[field].includes(id) ? editing[field].filter((x) => x !== id) : [...editing[field], id] })
    return (
      <Card as="section">
        <h2 className="mb-4 text-lg font-bold">{isNew ? 'Nova unidade' : `Editar ${editing.name}`}</h2>
        <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
          <Field label="Nome" htmlFor="u-name">
            <input id="u-name" className={inputClass} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>
          <Field label="Tipo" htmlFor="u-type">
            <select id="u-type" className={inputClass} value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as UnitType })}>
              {(Object.keys(UNIT_TYPE_LABEL) as UnitType[]).map((t) => (
                <option key={t} value={t}>
                  {UNIT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Endereço" htmlFor="u-addr">
            <input id="u-addr" className={inputClass} value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
          </Field>
          <Field label="Bairro" htmlFor="u-bairro">
            <input id="u-bairro" className={inputClass} value={editing.neighborhood} onChange={(e) => setEditing({ ...editing, neighborhood: e.target.value })} />
          </Field>
          <Field label="CEP" htmlFor="u-cep">
            <input id="u-cep" className={inputClass} value={editing.cep} onChange={(e) => setEditing({ ...editing, cep: e.target.value })} />
          </Field>
          <Field label="Telefone" htmlFor="u-phone">
            <input id="u-phone" className={inputClass} value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value || null })} />
          </Field>
          <Field label="Latitude" htmlFor="u-lat">
            <input id="u-lat" type="number" step="any" className={inputClass} value={editing.lat} onChange={(e) => setEditing({ ...editing, lat: Number(e.target.value) })} />
          </Field>
          <Field label="Longitude" htmlFor="u-lng">
            <input id="u-lng" type="number" step="any" className={inputClass} value={editing.lng} onChange={(e) => setEditing({ ...editing, lng: Number(e.target.value) })} />
          </Field>
          <Field label="Horário (texto exibido)" htmlFor="u-hours">
            <input id="u-hours" className={inputClass} value={editing.hours.label} onChange={(e) => setEditing({ ...editing, hours: { ...editing.hours, label: e.target.value } })} />
          </Field>
          <label className="flex min-h-12 items-center gap-2 self-end">
            <input type="checkbox" className="size-5 accent-azul-700" checked={editing.hours.open24h} onChange={(e) => setEditing({ ...editing, hours: { ...editing.hours, open24h: e.target.checked } })} />
            Aberta 24 horas
          </label>
          <div className="md:col-span-2">
            <Field label="Serviços" htmlFor="u-serv" hint="Separados por vírgula.">
              <input id="u-serv" className={inputClass} value={csv(editing.services)} onChange={(e) => setEditing({ ...editing, services: parse(e.target.value) })} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Acessibilidade" htmlFor="u-acc" hint="Separados por vírgula.">
              <input id="u-acc" className={inputClass} value={csv(editing.accessibility)} onChange={(e) => setEditing({ ...editing, accessibility: parse(e.target.value) })} />
            </Field>
          </div>
          <fieldset className="md:col-span-2">
            <legend className="mb-2 font-bold">Especialidades</legend>
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <label key={s.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 ring-2 ${editing.specialtyIds.includes(s.id) ? 'bg-azul-50 ring-azul-500' : 'ring-linha'}`}>
                  <input type="checkbox" className="size-4 accent-azul-700" checked={editing.specialtyIds.includes(s.id)} onChange={() => toggle('specialtyIds', s.id)} />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="md:col-span-2">
            <legend className="mb-2 font-bold">Exames</legend>
            <div className="flex flex-wrap gap-2">
              {exams.map((x) => (
                <label key={x.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 ring-2 ${editing.examIds.includes(x.id) ? 'bg-verde-100 ring-verde-500' : 'ring-linha'}`}>
                  <input type="checkbox" className="size-4 accent-verde-500" checked={editing.examIds.includes(x.id)} onChange={() => toggle('examIds', x.id)} />
                  {x.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-3 md:col-span-2">
            {err && <ErrorBox message={err} />}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="green" loading={busy}>
                Salvar unidade
              </Button>
            </div>
          </div>
        </form>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {msg && <SuccessBox>{msg}</SuccessBox>}
      {canCreate && (
        <Button
          variant="green"
          className="md:w-fit"
          onClick={() => {
            setEditing({ ...EMPTY_UNIT })
            setIsNew(true)
          }}
        >
          Cadastrar unidade
        </Button>
      )}
      {units.map((u) => (
        <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{u.name}</p>
            <p className="text-sm text-tinta-suave">
              {UNIT_TYPE_LABEL[u.type]} · {u.specialtyIds.length} especialidades · {u.examIds.length} exames
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(structuredClone(u))
              setIsNew(false)
              setMsg(null)
            }}
          >
            Editar
          </Button>
        </Card>
      ))}
    </div>
  )
}

// ---------------- Usuários e permissões ----------------
const ROLES: { id: Role; label: string }[] = [
  { id: 'cidadao', label: 'Cidadão' },
  { id: 'gestor_unidade', label: 'Gestor de unidade' },
  { id: 'admin', label: 'Administrador' },
]

function UsersAdmin() {
  const { units, user: me } = useApp()
  const [users, setUsers] = useState<UserProfile[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const load = useCallback(() => {
    api.listUsers().then(setUsers).catch((e) => setErr(e.message))
  }, [])
  useEffect(load, [load])

  async function update(u: UserProfile, role: Role, managed: string[]) {
    setErr(null)
    try {
      await api.setUserRole(u.id, role, managed)
      setSaved(u.id)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro.')
    }
  }

  if (!users) return err ? <ErrorBox message={err} /> : <Spinner />
  return (
    <div className="flex flex-col gap-3">
      <InfoNote>Dê acesso ao painel só a profissionais autorizados. Gestores só veem as unidades marcadas.</InfoNote>
      {err && <ErrorBox message={err} />}
      {users.map((u) => (
        <Card key={u.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">
                {u.fullName} {u.id === me?.id && <span className="text-sm text-tinta-suave">(você)</span>}
              </p>
              <p className="text-sm text-tinta-suave">{u.email}</p>
            </div>
            <select aria-label={`Perfil de ${u.fullName}`} className={`${inputClass} w-auto`} value={u.role} onChange={(e) => update(u, e.target.value as Role, u.managedUnitIds)}>
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {u.role === 'gestor_unidade' && (
            <fieldset>
              <legend className="mb-2 text-sm font-bold">Unidades que gerencia</legend>
              <div className="flex flex-wrap gap-2">
                {units.map((unit) => {
                  const on = u.managedUnitIds.includes(unit.id)
                  return (
                    <label key={unit.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm ring-2 ${on ? 'bg-verde-100 ring-verde-500' : 'ring-linha'}`}>
                      <input type="checkbox" className="size-4 accent-verde-500" checked={on} onChange={() => update(u, u.role, on ? u.managedUnitIds.filter((x) => x !== unit.id) : [...u.managedUnitIds, unit.id])} />
                      {unit.name}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}
          {saved === u.id && <p className="text-sm font-bold text-verde-700">Permissões atualizadas.</p>}
        </Card>
      ))}
    </div>
  )
}
