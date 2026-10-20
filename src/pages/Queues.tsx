import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, CrowdBadge, CrowdDot, ErrorBox, InfoNote, PageHeader, QueueSourceLine, Spinner } from '../components/ui'
import { useApp } from '../context/AppContext'
import type { CrowdLevel, UnitType } from '../lib/types'
import { CROWD, SOURCE_LABEL, UNIT_TYPE_LABEL, distanceKm, effectiveLevel, formatKm, formatRelative, formatWait, isStale } from '../lib/utils'
import { api } from '../services'

const SITUATION = { aberta: 'Aberta', fechada: 'Fechada', atendimento_restrito: 'Atendimento restrito' } as const

export function QueuesPage() {
  const { units, queues, location, catalogReady, catalogError, reloadQueues } = useApp()
  const [type, setType] = useState<UnitType | ''>('')
  const [compare, setCompare] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const rows = useMemo(
    () =>
      units
        .filter((u) => !type || u.type === type)
        .map((u) => ({ u, q: queues.find((x) => x.unitId === u.id), d: distanceKm(location, u) }))
        .sort((a, b) => a.d - b.d),
    [units, queues, location, type],
  )

  const toggle = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]))

  async function refresh() {
    setRefreshing(true)
    try {
      await reloadQueues()
    } finally {
      setRefreshing(false)
    }
  }

  const compared = rows.filter((r) => compare.includes(r.u.id))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Como estão as filas?"
        subtitle="Veja o movimento das unidades e compare antes de sair de casa."
        action={
          <Button variant="secondary" onClick={refresh} loading={refreshing} aria-label="Atualizar">
            {!refreshing && <RefreshCw className="size-5" aria-hidden />}
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        }
      />

      <ul className="flex flex-wrap gap-x-5 gap-y-2 rounded-3xl bg-white p-4 ring-1 ring-linha" aria-label="Legenda">
        {(['baixo', 'moderado', 'alto', 'indisponivel'] as CrowdLevel[]).map((l) => (
          <li key={l} className="inline-flex items-center gap-2">
            <CrowdDot level={l} /> {CROWD[l].label}
          </li>
        ))}
      </ul>

      {api.mode === 'demo' && (
        <InfoNote>
          Os números desta tela são de demonstração. Em produção, só aparecem dados informados pela própria unidade ou por integração oficial, sempre com a hora da atualização. Dados com mais de 1 hora ficam cinza.
        </InfoNote>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por tipo">
        {(['', 'UBS', 'UPA', 'HOSPITAL', 'CLINICA', 'LABORATORIO'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            aria-pressed={type === t}
            className={`min-h-11 shrink-0 rounded-full px-4 font-bold ${type === t ? 'bg-azul-700 text-white' : 'bg-white text-azul-700 ring-1 ring-linha'}`}
          >
            {t ? UNIT_TYPE_LABEL[t] : 'Todas'}
          </button>
        ))}
      </div>

      {compared.length > 0 && (
        <Card as="section" className="ring-2 ring-azul-500">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Comparando {compared.length} {compared.length === 1 ? 'unidade' : 'unidades'}</h2>
            <button onClick={() => setCompare([])} className="font-bold text-azul-700 underline">
              Limpar
            </button>
          </div>
          {compared.length === 1 && <p className="mb-3 text-tinta-suave">Escolha mais uma unidade para comparar (até 3).</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left">
              <thead>
                <tr className="text-sm text-tinta-suave">
                  <th className="py-2 pr-3 font-normal">Unidade</th>
                  <th className="py-2 pr-3 font-normal">Movimento</th>
                  <th className="py-2 pr-3 font-normal">Aguardando</th>
                  <th className="py-2 pr-3 font-normal">Espera</th>
                  <th className="py-2 pr-3 font-normal">Distância</th>
                  <th className="py-2 font-normal">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {compared.map(({ u, q, d }) => {
                  const ok = effectiveLevel(q) !== 'indisponivel'
                  return (
                    <tr key={u.id} className="border-t border-linha">
                      <td className="py-3 pr-3 font-semibold">{u.name}</td>
                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center gap-2">
                          <CrowdDot level={effectiveLevel(q)} /> {CROWD[effectiveLevel(q)].short}
                        </span>
                      </td>
                      <td className="py-3 pr-3">{ok ? q?.peopleWaiting ?? '—' : '—'}</td>
                      <td className="py-3 pr-3">{ok ? formatWait(q?.waitMinutes ?? null) : '—'}</td>
                      <td className="py-3 pr-3">{formatKm(d)}</td>
                      <td className="py-3 text-sm">{formatRelative(q?.updatedAt ?? null)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!catalogReady ? (
        <Spinner />
      ) : catalogError ? (
        <ErrorBox message={catalogError} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map(({ u, q, d }) => {
            const level = effectiveLevel(q)
            const stale = isStale(q)
            const selected = compare.includes(u.id)
            return (
              <li key={u.id}>
                <Card as="article" className="relative flex h-full flex-col gap-3 overflow-hidden pl-7">
                  <span className="absolute inset-y-0 left-0 w-2.5" style={{ background: CROWD[level].color }} aria-hidden />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-tinta-suave">
                        {UNIT_TYPE_LABEL[u.type]} · {formatKm(d)}
                      </p>
                      <h3 className="text-lg font-semibold">{u.name}</h3>
                    </div>
                    <CrowdBadge queue={q} />
                  </div>

                  {level !== 'indisponivel' ? (
                    <dl className="grid grid-cols-2 gap-2">
                      <div>
                        <dt className="text-sm text-tinta-suave">Aguardando (aprox.)</dt>
                        <dd className="font-display text-2xl font-bold">{q?.peopleWaiting ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-tinta-suave">Espera estimada</dt>
                        <dd className="font-display text-2xl font-bold">{formatWait(q?.waitMinutes ?? null)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="font-semibold text-tinta-suave">
                      {stale ? 'A última informação tem mais de 1 hora e pode não refletir a situação atual.' : 'Sem informação de fila no momento.'}
                    </p>
                  )}

                  <div className="text-sm">
                    {q && (
                      <p>
                        {q.serviceType} · {SITUATION[q.unitSituation]}
                      </p>
                    )}
                    <QueueSourceLine queue={q} />
                    {q && q.source !== 'indisponivel' && <p className="sr-only">Fonte: {SOURCE_LABEL[q.source]}</p>}
                  </div>

                  <div className="mt-auto flex gap-2">
                    <label className={`inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 font-bold ${selected ? 'border-azul-500 bg-azul-50 text-azul-900' : 'border-azul-100 text-azul-700'}`}>
                      <input type="checkbox" className="size-5 accent-azul-700" checked={selected} onChange={() => toggle(u.id)} disabled={!selected && compare.length >= 3} />
                      Comparar
                    </label>
                    <Link to={`/unidades/${u.id}`} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-azul-700 font-bold text-white hover:bg-azul-900">
                      Ver detalhes
                    </Link>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {compare.length > 0 && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-20 right-4 z-[600] inline-flex items-center gap-2 rounded-full bg-azul-900 px-5 py-3 font-bold text-white shadow-lg md:bottom-6">
          Ver comparação ({compare.length})
        </button>
      )}
    </div>
  )
}
