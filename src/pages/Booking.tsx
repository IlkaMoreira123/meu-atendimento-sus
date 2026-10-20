import { Check, ChevronRight, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, CrowdBadge, EmergencyBanner, EmptyState, ErrorBox, InfoNote, PageHeader, Spinner, StatusBadge, inputClass } from '../components/ui'
import { useApp } from '../context/AppContext'
import type { Appointment, Exam, Slot, Specialty } from '../lib/types'
import { STATUS_INFO, UNIT_TYPE_LABEL, distanceKm, formatDateLong, formatKm, formatTime } from '../lib/utils'
import { api } from '../services'

type Kind = 'consulta' | 'exame'

function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-6 flex items-center gap-1.5" aria-label="Etapas do agendamento">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col gap-1.5" aria-current={i === current ? 'step' : undefined}>
          <span className={`h-2 rounded-full ${i <= current ? 'bg-azul-700' : 'bg-azul-100'}`} />
          <span className={`hidden text-sm sm:block ${i === current ? 'font-bold text-azul-900' : 'text-tinta-suave'}`}>
            {i + 1}. {s}
          </span>
        </li>
      ))}
      <li className="sr-only">
        Etapa {current + 1} de {steps.length}: {steps[current]}
      </li>
    </ol>
  )
}

function OptionButton({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-16 w-full items-center gap-3 rounded-3xl bg-white p-4 text-left ring-2 transition-colors ${selected ? 'ring-azul-500' : 'ring-linha hover:ring-azul-100'}`}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {selected ? <Check className="size-6 shrink-0 text-azul-700" aria-hidden /> : <ChevronRight className="size-6 shrink-0 text-tinta-suave" aria-hidden />}
    </button>
  )
}

/** Fluxo de agendamento compartilhado por consultas e exames. */
export function BookingWizard({ kind }: { kind: Kind }) {
  const { specialties, exams, units, queues, location, catalogReady, refreshUnread } = useApp()
  const params = useSearchParams()[0]
  const routeParams = useParams()
  const nav = useNavigate()

  const presetRef = kind === 'exame' ? routeParams.id ?? '' : params.get('esp') ?? ''
  const replacesId = params.get('remarcar') ?? undefined

  const [refId, setRefId] = useState(presetRef)
  const [unitId, setUnitId] = useState(params.get('unidade') ?? '')
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [slotErr, setSlotErr] = useState<string | null>(null)
  const [day, setDay] = useState('')
  const [slotId, setSlotId] = useState('')
  const [note, setNote] = useState('')
  const [step, setStep] = useState(presetRef ? (params.get('unidade') ? 2 : 1) : 0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const item: Specialty | Exam | undefined = kind === 'consulta' ? specialties.find((s) => s.id === refId) : exams.find((e) => e.id === refId)
  const needsAuth = !!item?.requiresReferral
  const unit = units.find((u) => u.id === unitId)

  const steps = needsAuth ? [kind === 'consulta' ? 'Especialidade' : 'Exame', 'Unidade', 'Confirmar'] : [kind === 'consulta' ? 'Especialidade' : 'Exame', 'Unidade', 'Data e horário', 'Confirmar']
  const confirmStep = steps.length - 1

  const unitOptions = useMemo(
    () =>
      units
        .filter((u) => (kind === 'consulta' ? u.specialtyIds : u.examIds).includes(refId))
        .map((u) => ({ u, d: distanceKm(location, u) }))
        .sort((a, b) => a.d - b.d),
    [units, kind, refId, location],
  )

  useEffect(() => {
    if (!refId || !unitId || needsAuth) return
    let alive = true
    setSlots(null)
    setSlotErr(null)
    api
      .listSlots({ kind, refId, unitId })
      .then((s) => alive && setSlots(s))
      .catch((e) => alive && setSlotErr(e instanceof Error ? e.message : 'Erro ao carregar horários.'))
    return () => {
      alive = false
    }
  }, [kind, refId, unitId, needsAuth])

  const days = useMemo(() => {
    const map = new Map<string, Slot[]>()
    for (const s of slots ?? []) {
      if (s.booked) continue
      const key = s.startsAt.slice(0, 10)
      map.set(key, [...(map.get(key) ?? []), s])
    }
    return [...map.entries()]
  }, [slots])

  useEffect(() => {
    if (days.length && !days.some(([d]) => d === day)) setDay(days[0][0])
  }, [days, day])

  const slot = slots?.find((s) => s.id === slotId)

  async function confirm() {
    setSubmitting(true)
    setError(null)
    try {
      const appt = await api.book({ kind, refId, unitId, slotId: needsAuth ? null : slotId, note: note.trim() || null, replacesId })
      refreshUnread()
      nav(`/confirmacao/${appt.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir. Tente de novo.')
      // Se o horário foi ocupado por outra pessoa, recarrega a agenda.
      if (!needsAuth) api.listSlots({ kind, refId, unitId }).then(setSlots)
    } finally {
      setSubmitting(false)
    }
  }

  if (!catalogReady) return <Spinner />

  const title = replacesId ? 'Remarcar' : kind === 'consulta' ? 'Agendar consulta' : 'Agendar exame'

  return (
    <div>
      <PageHeader back title={title} subtitle={item ? item.name : undefined} />
      <Steps steps={steps} current={step} />

      {step === 0 && kind === 'consulta' && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Qual especialidade?</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {specialties.map((s) => (
              <OptionButton
                key={s.id}
                selected={refId === s.id}
                onClick={() => {
                  setRefId(s.id)
                  setUnitId('')
                  setSlotId('')
                  setStep(1)
                }}
              >
                <span className="block font-display text-lg font-semibold">{s.name}</span>
                <span className="text-sm text-tinta-suave">{s.requiresReferral ? 'Precisa de encaminhamento da UBS' : 'Agendamento direto'}</span>
              </OptionButton>
            ))}
          </div>
        </section>
      )}

      {step === 0 && kind === 'exame' && (
        <EmptyState title="Escolha o exame primeiro" action={<Link to="/exames" className="font-bold text-azul-700 underline">Ver exames</Link>} />
      )}

      {step === 1 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Em qual unidade?</h2>
          {needsAuth && (
            <div className="mb-3">
              <InfoNote>
                {item?.name} depende de encaminhamento e autorização da regulação. Você vai registrar um pedido; a data será definida pela rede e
                avisaremos quando for confirmada.
              </InfoNote>
            </div>
          )}
          {unitOptions.length === 0 ? (
            <EmptyState title="Nenhuma unidade oferece este atendimento">Tente outra especialidade.</EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {unitOptions.map(({ u, d }) => (
                <OptionButton
                  key={u.id}
                  selected={unitId === u.id}
                  onClick={() => {
                    setUnitId(u.id)
                    setSlotId('')
                    setStep(2)
                  }}
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-display text-lg font-semibold">{u.name}</span>
                    <span className="font-semibold text-azul-700">{formatKm(d)}</span>
                  </span>
                  <span className="block text-sm text-tinta-suave">
                    {UNIT_TYPE_LABEL[u.type]} · {u.address} · {u.hours.label}
                  </span>
                  <span className="mt-2 block">
                    <CrowdBadge queue={queues.find((q) => q.unitId === u.id)} />
                  </span>
                </OptionButton>
              ))}
            </div>
          )}
          {kind === 'consulta' && (
            <Button variant="ghost" className="mt-4" onClick={() => setStep(0)}>
              Trocar especialidade
            </Button>
          )}
        </section>
      )}

      {step === 2 && !needsAuth && (
        <section>
          <h2 className="mb-1 text-xl font-bold">Escolha o dia e o horário</h2>
          <p className="mb-4 text-tinta-suave">{unit?.name}</p>
          {slotErr ? (
            <ErrorBox message={slotErr} />
          ) : slots === null ? (
            <Spinner label="Buscando horários…" />
          ) : days.length === 0 ? (
            <EmptyState title="Sem horários livres nesta unidade" action={<Button variant="secondary" onClick={() => setStep(1)}>Escolher outra unidade</Button>}>
              As vagas são abertas pela unidade. Tente outra unidade próxima.
            </EmptyState>
          ) : (
            <>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" role="group" aria-label="Dias disponíveis">
                {days.map(([d, list]) => {
                  const date = new Date(`${d}T12:00:00`)
                  const active = d === day
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        setDay(d)
                        setSlotId('')
                      }}
                      aria-pressed={active}
                      className={`flex w-20 shrink-0 flex-col items-center rounded-2xl py-3 ${active ? 'bg-azul-700 text-white' : 'bg-white ring-1 ring-linha'}`}
                    >
                      <span className="text-sm capitalize">{date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                      <span className="font-display text-2xl font-bold">{date.getDate()}</span>
                      <span className="text-xs">{list.length} vagas</span>
                    </button>
                  )
                })}
              </div>
              <h3 className="mb-2 mt-4 font-bold">{day && formatDateLong(`${day}T12:00:00`)}</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="Horários">
                {days
                  .find(([d]) => d === day)?.[1]
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSlotId(s.id)}
                      aria-pressed={slotId === s.id}
                      className={`min-h-12 rounded-2xl font-display text-lg font-semibold ${slotId === s.id ? 'bg-verde-500 text-white' : 'bg-white text-azul-900 ring-1 ring-linha hover:ring-azul-500'}`}
                    >
                      {formatTime(s.startsAt)}
                    </button>
                  ))}
              </div>
              <div className="mt-6 flex gap-2">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                <Button className="flex-1" disabled={!slotId} onClick={() => setStep(3)}>
                  Continuar
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {step === confirmStep && step >= 2 && unit && item && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Confira os dados</h2>
          <Card>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-tinta-suave">{kind === 'consulta' ? 'Especialidade' : 'Exame'}</dt>
                <dd className="font-display text-lg font-semibold">{item.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-tinta-suave">Unidade</dt>
                <dd className="font-semibold">{unit.name}</dd>
                <dd className="text-sm text-tinta-suave">{unit.address}</dd>
              </div>
              <div>
                <dt className="text-sm text-tinta-suave">Data e horário</dt>
                <dd className="font-semibold">{slot ? `${formatDateLong(slot.startsAt)}, às ${formatTime(slot.startsAt)}` : 'Será definida pela regulação'}</dd>
              </div>
              {slot?.professional && (
                <div>
                  <dt className="text-sm text-tinta-suave">Profissional</dt>
                  <dd className="font-semibold">{slot.professional}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-tinta-suave">Situação após confirmar</dt>
                <dd className="mt-1">
                  <StatusBadge status={needsAuth ? 'aguardando_autorizacao' : 'confirmada'} />
                </dd>
                <dd className="mt-1 text-sm text-tinta-suave">{STATUS_INFO[needsAuth ? 'aguardando_autorizacao' : 'confirmada'].help}</dd>
              </div>
            </dl>
          </Card>
          <div>
            <label htmlFor="obs" className="mb-1.5 block font-bold">
              Observação para a unidade (opcional)
            </label>
            <textarea id="obs" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Ex.: preciso de atendimento com acessibilidade" />
            <p className="mt-1 text-sm text-tinta-suave">Não escreva sintomas detalhados ou diagnósticos aqui.</p>
          </div>
          {replacesId && <InfoNote>Ao confirmar, o agendamento anterior será cancelado automaticamente.</InfoNote>}
          {error && <ErrorBox message={error} />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(needsAuth ? 1 : 2)}>
              Voltar
            </Button>
            <Button variant="green" className="flex-1 text-lg" loading={submitting} onClick={confirm}>
              {needsAuth ? 'Enviar pedido' : 'Confirmar agendamento'}
            </Button>
          </div>
          <EmergencyBanner compact />
        </section>
      )}
    </div>
  )
}

export function ConfirmationPage() {
  const { id } = useParams()
  const { units, specialties, exams } = useApp()
  const [appt, setAppt] = useState<Appointment | null | undefined>(undefined)

  useEffect(() => {
    api.listMyAppointments().then((list) => setAppt(list.find((a) => a.id === id) ?? null))
  }, [id])

  if (appt === undefined) return <Spinner />
  if (appt === null) return <EmptyState title="Agendamento não encontrado" />

  const unit = units.find((u) => u.id === appt.unitId)
  const name = appt.kind === 'consulta' ? specialties.find((s) => s.id === appt.refId)?.name : exams.find((e) => e.id === appt.refId)?.name
  const confirmed = appt.status === 'confirmada'
  const exam = appt.kind === 'exame' ? exams.find((e) => e.id === appt.refId) : undefined

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
      <div className={`entrada grid size-24 place-items-center rounded-full ${confirmed ? 'bg-verde-500' : 'bg-amber-500'} text-white`}>
        <Check className="size-12" strokeWidth={3} aria-hidden />
      </div>
      <div>
        <h1 className="text-3xl font-bold">{confirmed ? 'Agendamento confirmado' : 'Pedido registrado'}</h1>
        <p className="mt-2 text-tinta-suave">{confirmed ? 'Guarde o protocolo e chegue com 15 minutos de antecedência.' : 'Ainda não é um agendamento confirmado. Avisaremos quando a rede definir a data.'}</p>
      </div>
      <Card className="w-full text-left">
        <p className="text-sm text-tinta-suave">Protocolo</p>
        <p className="font-display text-2xl font-bold tracking-wide text-azul-900">{appt.protocol}</p>
        <hr className="my-4 border-linha" />
        <dl className="grid gap-3">
          <div>
            <dt className="text-sm text-tinta-suave">{appt.kind === 'consulta' ? 'Consulta' : 'Exame'}</dt>
            <dd className="font-semibold">{name}</dd>
          </div>
          <div>
            <dt className="text-sm text-tinta-suave">Unidade</dt>
            <dd className="font-semibold">{unit?.name}</dd>
            <dd className="text-sm">{unit?.address}</dd>
          </div>
          {appt.startsAt && (
            <div>
              <dt className="text-sm text-tinta-suave">Quando</dt>
              <dd className="font-semibold">
                {formatDateLong(appt.startsAt)}, às {formatTime(appt.startsAt)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-tinta-suave">Situação</dt>
            <dd className="mt-1">
              <StatusBadge status={appt.status} />
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-tinta-suave">Leve documento com foto e o Cartão SUS. {api.mode === 'demo' && 'Este protocolo é de demonstração e não vale para atendimento real.'}</p>
      </Card>
      {exam && (
        <Link to={`/exames/${exam.id}`} className="font-bold text-azul-700 underline">
          Ver orientações de preparo
        </Link>
      )}
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Link to="/agendamentos" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-azul-700 font-bold text-white">
          Meus agendamentos
        </Link>
        <Link to="/inicio" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border-2 border-azul-100 font-bold text-azul-700">
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}

export function ExamsPage() {
  const { exams, units, catalogReady } = useApp()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<'' | Exam['category']>('')
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const list = exams.filter((e) => (!cat || e.category === cat) && norm(e.name).includes(norm(q)))
  const CATS = { laboratorial: 'Laboratoriais', imagem: 'De imagem', outros: 'Outros' } as const

  return (
    <div className="flex flex-col gap-4">
      <PageHeader back="/inicio" title="Exames" subtitle="Pesquise o exame, veja onde é feito e como se preparar." />
      <div className="flex items-center gap-2 rounded-3xl bg-white p-2 pl-4 ring-2 ring-azul-100 focus-within:ring-azul-500">
        <Search className="size-6 text-azul-500" aria-hidden />
        <label htmlFor="ex-q" className="sr-only">
          Pesquisar exame
        </label>
        <input id="ex-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: hemograma, ultrassom" className="min-h-12 min-w-0 flex-1 bg-transparent text-lg focus:outline-none" />
      </div>
      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Tipo de exame">
        {(['', 'laboratorial', 'imagem', 'outros'] as const).map((c) => (
          <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={`min-h-11 shrink-0 rounded-full px-4 font-bold ${cat === c ? 'bg-verde-500 text-white' : 'bg-white text-verde-700 ring-1 ring-linha'}`}>
            {c ? CATS[c] : 'Todos'}
          </button>
        ))}
      </div>
      {!catalogReady ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState title="Nenhum exame encontrado">Confira a grafia ou procure por outro nome.</EmptyState>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {list.map((e) => {
            const n = units.filter((u) => u.examIds.includes(e.id)).length
            return (
              <li key={e.id}>
                <Link to={`/exames/${e.id}`} className="flex min-h-20 items-center gap-3 rounded-3xl bg-white p-4 ring-1 ring-linha hover:ring-verde-500">
                  <span className="flex-1">
                    <span className="block font-display text-lg font-semibold">{e.name}</span>
                    <span className="text-sm text-tinta-suave">
                      {CATS[e.category]} · {n} {n === 1 ? 'unidade' : 'unidades'} · {e.requiresReferral ? 'precisa de encaminhamento' : 'agendamento direto'}
                    </span>
                  </span>
                  <ChevronRight className="size-6 text-tinta-suave" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function ExamDetailPage() {
  const { id } = useParams()
  const { exams, units, location, queues, catalogReady } = useApp()
  const exam = exams.find((e) => e.id === id)
  if (!catalogReady) return <Spinner />
  if (!exam) return <EmptyState title="Exame não encontrado" />
  const offering = units
    .filter((u) => u.examIds.includes(exam.id))
    .map((u) => ({ u, d: distanceKm(location, u) }))
    .sort((a, b) => a.d - b.d)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader back="/exames" title={exam.name} />
      <Card className={exam.requiresReferral ? 'bg-amber-50 ring-amber-200' : 'bg-verde-100/50 ring-verde-500/30'}>
        <p className="font-bold">{exam.requiresReferral ? 'Precisa de encaminhamento e autorização' : 'Pode ser agendado diretamente'}</p>
        <p className="mt-1 text-tinta-suave">
          {exam.requiresReferral
            ? 'Leve o pedido médico à sua UBS. Pelo aplicativo você registra o pedido, que fica "aguardando autorização" até a regulação definir a data.'
            : 'Escolha a unidade e o horário. Leve o pedido médico no dia.'}
        </p>
      </Card>
      <Card as="section">
        <h2 className="mb-2 text-lg font-bold">Orientações de preparo</h2>
        {exam.preparation ? (
          <>
            <p>{exam.preparation}</p>
            {exam.preparationSource && <p className="mt-2 text-sm text-tinta-suave">Fonte: {exam.preparationSource}</p>}
          </>
        ) : (
          <p className="text-tinta-suave">A unidade ainda não cadastrou orientações oficiais. Confirme o preparo com a unidade antes do exame.</p>
        )}
      </Card>
      <section>
        <h2 className="mb-3 text-xl font-bold">Onde fazer</h2>
        <ul className="flex flex-col gap-2">
          {offering.map(({ u, d }) => (
            <li key={u.id}>
              <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-display text-lg font-semibold">{u.name}</p>
                  <p className="text-sm text-tinta-suave">
                    {formatKm(d)} · {u.hours.label}
                  </p>
                  <div className="mt-2">
                    <CrowdBadge queue={queues.find((q) => q.unitId === u.id)} />
                  </div>
                </div>
                <Link to={`/exames/${exam.id}/agendar?unidade=${u.id}`} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-verde-500 px-5 font-bold text-white hover:bg-verde-700">
                  {exam.requiresReferral ? 'Solicitar' : 'Ver horários'}
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
