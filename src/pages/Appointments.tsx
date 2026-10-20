import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorBox, PageHeader, Spinner, StatusBadge, SuccessBox, inputClass } from '../components/ui'
import { useApp } from '../context/AppContext'
import type { Appointment, AppointmentStatus } from '../lib/types'
import { ACTIVE_STATUSES, STATUS_INFO, formatDate, formatDateLong, formatTime } from '../lib/utils'
import { api } from '../services'

function useAppointments() {
  const [list, setList] = useState<Appointment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setError(null)
    api
      .listMyAppointments()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
  }, [])
  useEffect(load, [load])
  return { list, error, load, setList }
}

function AppointmentCard({ a, onChanged }: { a: Appointment; onChanged: () => void }) {
  const { units, specialties, exams, refreshUnread } = useApp()
  const [busy, setBusy] = useState<'cancel' | 'change' | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [changing, setChanging] = useState(false)
  const [changeNote, setChangeNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const unit = units.find((u) => u.id === a.unitId)
  const name = a.kind === 'consulta' ? specialties.find((s) => s.id === a.refId)?.name : exams.find((e) => e.id === a.refId)?.name
  const active = ACTIVE_STATUSES.includes(a.status)
  const past = a.startsAt ? new Date(a.startsAt).getTime() < Date.now() : false

  async function cancel() {
    setBusy('cancel')
    setErr(null)
    try {
      await api.cancelAppointment(a.id)
      refreshUnread()
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível cancelar.')
    } finally {
      setBusy(null)
      setConfirming(false)
    }
  }

  async function requestChange() {
    if (changeNote.trim().length < 5) {
      setErr('Conte em poucas palavras o que precisa mudar.')
      return
    }
    setBusy('change')
    setErr(null)
    try {
      await api.requestChange(a.id, changeNote.trim())
      setOk('Pedido de alteração enviado à unidade.')
      setChanging(false)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível enviar.')
    } finally {
      setBusy(null)
    }
  }

  const rescheduleUrl =
    a.kind === 'consulta' ? `/consultas/agendar?esp=${a.refId}&unidade=${a.unitId}&remarcar=${a.id}` : `/exames/${a.refId}/agendar?unidade=${a.unitId}&remarcar=${a.id}`

  return (
    <Card as="article" className="flex flex-col gap-3">
      <span id={a.id} className="-mt-24 block pt-24" aria-hidden />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm text-tinta-suave">{a.kind === 'consulta' ? 'Consulta' : 'Exame'}</p>
          <h3 className="text-lg font-semibold">{name}</h3>
        </div>
        <StatusBadge status={a.status} />
      </div>
      <p className="text-tinta-suave">{STATUS_INFO[a.status].help}</p>
      <dl className="grid gap-2 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-tinta-suave">Quando</dt>
          <dd className="font-semibold">{a.startsAt ? `${formatDateLong(a.startsAt)}, ${formatTime(a.startsAt)}` : 'A definir'}</dd>
        </div>
        <div>
          <dt className="text-sm text-tinta-suave">Onde</dt>
          <dd className="font-semibold">
            <Link to={`/unidades/${a.unitId}`} className="underline">
              {unit?.name}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-tinta-suave">Protocolo</dt>
          <dd className="font-semibold">{a.protocol}</dd>
        </div>
      </dl>
      {a.changeRequested && <p className="rounded-2xl bg-azul-50 p-3 text-sm">Alteração solicitada: “{a.note}”. Aguardando resposta da unidade.</p>}
      {err && <ErrorBox message={err} />}
      {ok && <SuccessBox>{ok}</SuccessBox>}

      {active && !past && (
        <>
          {confirming ? (
            <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
              <p className="font-bold text-red-900">Cancelar este agendamento?</p>
              <p className="text-sm text-red-900/80">A vaga será liberada para outra pessoa.</p>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  Manter
                </Button>
                <Button variant="danger" loading={busy === 'cancel'} onClick={cancel}>
                  Sim, cancelar
                </Button>
              </div>
            </div>
          ) : changing ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={`chg-${a.id}`} className="font-bold">
                O que precisa mudar?
              </label>
              <textarea id={`chg-${a.id}`} rows={2} maxLength={300} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} className={inputClass} placeholder="Ex.: preciso de um horário pela manhã" />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setChanging(false)}>
                  Voltar
                </Button>
                <Button loading={busy === 'change'} onClick={requestChange}>
                  Enviar pedido de alteração
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {a.status === 'confirmada' && (
                <Link to={rescheduleUrl} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-azul-700 px-5 font-bold text-white hover:bg-azul-900">
                  Remarcar
                </Link>
              )}
              {a.status !== 'confirmada' && !a.changeRequested && (
                <Button variant="secondary" onClick={() => setChanging(true)}>
                  Solicitar alteração
                </Button>
              )}
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Cancelar
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export function MyAppointmentsPage() {
  const { list, error, load } = useAppointments()
  const loc = useLocation()
  const [filter, setFilter] = useState<'ativos' | AppointmentStatus>('ativos')

  useEffect(() => {
    if (loc.hash && list) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [loc.hash, list])

  const shown = (list ?? []).filter((a) => (filter === 'ativos' ? ACTIVE_STATUSES.includes(a.status) : a.status === filter))
  const FILTERS: { id: typeof filter; label: string }[] = [
    { id: 'ativos', label: 'Ativos' },
    { id: 'confirmada', label: 'Confirmados' },
    { id: 'aguardando_autorizacao', label: 'Aguardando autorização' },
    { id: 'solicitada', label: 'Solicitados' },
    { id: 'cancelada', label: 'Cancelados' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Meus agendamentos"
        subtitle={
          <Link to="/historico" className="font-bold text-azul-700 underline">
            Ver histórico completo
          </Link>
        }
      />
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={`min-h-11 shrink-0 rounded-full px-4 font-bold ${filter === f.id ? 'bg-azul-700 text-white' : 'bg-white text-azul-700 ring-1 ring-linha'}`}>
            {f.label}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : list === null ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState
          title="Nada por aqui"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/consultas/agendar" className="inline-flex min-h-12 items-center rounded-2xl bg-azul-700 px-5 font-bold text-white">
                Agendar consulta
              </Link>
              <Link to="/exames" className="inline-flex min-h-12 items-center rounded-2xl bg-verde-500 px-5 font-bold text-white">
                Agendar exame
              </Link>
            </div>
          }
        >
          Nenhum agendamento com este filtro.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((a) => (
            <AppointmentCard key={a.id} a={a} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  )
}

export function HistoryPage() {
  const { list, error, load } = useAppointments()
  const { units, specialties, exams } = useApp()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader back="/agendamentos" title="Histórico" subtitle="Todos os atendimentos e solicitações, do mais recente ao mais antigo." />
      {error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : list === null ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState title="Você ainda não tem histórico" />
      ) : (
        <ol className="relative flex flex-col gap-4 border-l-2 border-azul-100 pl-6">
          {list.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[33px] top-2 size-4 rounded-full bg-white ring-4 ring-azul-500" aria-hidden />
              <p className="text-sm text-tinta-suave">Pedido em {formatDate(a.createdAt)}</p>
              <p className="font-semibold">
                {a.kind === 'consulta' ? 'Consulta' : 'Exame'}: {a.kind === 'consulta' ? specialties.find((s) => s.id === a.refId)?.name : exams.find((e) => e.id === a.refId)?.name}
              </p>
              <p className="text-tinta-suave">
                {units.find((u) => u.id === a.unitId)?.name}
                {a.startsAt && ` · ${formatDate(a.startsAt)} ${formatTime(a.startsAt)}`} · {a.protocol}
              </p>
              <div className="mt-1">
                <StatusBadge status={a.status} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
