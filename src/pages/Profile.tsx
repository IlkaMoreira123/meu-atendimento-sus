import { Bell, BellOff, CheckCheck, LogOut, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorBox, Field, InfoNote, PageHeader, Spinner, SuccessBox, inputClass } from '../components/ui'
import { useApp } from '../context/AppContext'
import type { AppNotification, NotificationPrefs } from '../lib/types'
import { formatCPFInput, formatRelative, isValidCNS, isValidCPF, maskCPF, onlyDigits } from '../lib/utils'
import { api } from '../services'
import { resetDemoData } from '../services/demoService'

const ROLE_LABEL = { cidadao: 'Cidadão', gestor_unidade: 'Gestor de unidade', admin: 'Administrador' } as const

export function ProfilePage() {
  const { user, setUser } = useApp()
  const nav = useNavigate()
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    birthDate: user?.birthDate ?? '',
    cpf: '',
    cns: user?.cns ?? '',
    phone: user?.phone ?? '',
    address: user?.address ?? '',
    neighborhood: user?.neighborhood ?? '',
  })
  const [prefs, setPrefs] = useState<NotificationPrefs>(user!.prefs)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!user) return null

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'cpf' ? formatCPFInput(e.target.value) : e.target.value }))

  async function save(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (form.fullName.trim().length < 3 || !form.fullName.trim().includes(' ')) errs.fullName = 'Digite nome e sobrenome.'
    if (form.cpf && !isValidCPF(form.cpf)) errs.cpf = 'CPF inválido. Confira os números.'
    if (form.cns && !isValidCNS(form.cns)) errs.cns = 'Número do Cartão SUS inválido (15 dígitos).'
    if (form.phone && onlyDigits(form.phone).length < 10) errs.phone = 'Telefone com DDD, ex.: (11) 91234-5678.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    setMsg(null)
    setError(null)
    try {
      const u = await api.updateProfile({
        fullName: form.fullName.trim(),
        birthDate: form.birthDate || null,
        ...(form.cpf ? { cpf: onlyDigits(form.cpf) } : {}),
        cns: form.cns ? onlyDigits(form.cns) : null,
        phone: form.phone || null,
        address: form.address || null,
        neighborhood: form.neighborhood || null,
      })
      setUser(u)
      setForm((f) => ({ ...f, cpf: '' }))
      setMsg('Dados atualizados.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function savePrefs(next: NotificationPrefs) {
    if (next.navegador && !prefs.navegador && typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') next = { ...next, navegador: false }
    }
    setPrefs(next)
    const u = await api.updateProfile({ prefs: next })
    setUser(u)
  }

  async function logout() {
    await api.signOut()
    setUser(null)
    nav('/entrar', { replace: true })
  }

  const PREFS: { k: keyof NotificationPrefs; label: string; help: string }[] = [
    { k: 'lembretes', label: 'Lembretes de consultas e exames', help: 'Aviso até 2 dias antes.' },
    { k: 'alteracoes', label: 'Alterações e cancelamentos', help: 'Quando a situação de um agendamento mudar.' },
    { k: 'avisosUnidade', label: 'Avisos das unidades', help: 'Mudanças relevantes no atendimento.' },
    { k: 'preparoExame', label: 'Preparo de exames', help: 'Lembrete para conferir as orientações.' },
    { k: 'navegador', label: 'Notificações no aparelho', help: 'Mostram só um aviso genérico, sem dados de saúde, na tela bloqueada.' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Meu perfil" subtitle={`${user.email} · ${ROLE_LABEL[user.role]}`} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/agendamentos" className="flex min-h-16 items-center rounded-3xl bg-white px-5 font-bold text-azul-700 ring-1 ring-linha hover:ring-azul-500">
          Meus agendamentos
        </Link>
        <Link to="/historico" className="flex min-h-16 items-center rounded-3xl bg-white px-5 font-bold text-azul-700 ring-1 ring-linha hover:ring-azul-500">
          Histórico de atendimentos e solicitações
        </Link>
      </div>

      <Card as="section">
        <h2 className="mb-4 text-xl font-bold">Dados pessoais</h2>
        <form onSubmit={save} className="grid gap-4 md:grid-cols-2" noValidate>
          <div className="md:col-span-2">
            <Field label="Nome completo" htmlFor="p-name" error={errors.fullName}>
              <input id="p-name" className={inputClass} value={form.fullName} onChange={set('fullName')} aria-invalid={!!errors.fullName} />
            </Field>
          </div>
          <Field label="Data de nascimento" htmlFor="p-birth">
            <input id="p-birth" type="date" className={inputClass} value={form.birthDate} onChange={set('birthDate')} />
          </Field>
          <Field label="Telefone" htmlFor="p-phone" error={errors.phone}>
            <input id="p-phone" type="tel" autoComplete="tel" className={inputClass} value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} />
          </Field>
          <Field label="CPF (opcional)" htmlFor="p-cpf" hint={user.cpf ? `Cadastrado: ${maskCPF(user.cpf)}. Digite para substituir.` : 'Só informe se a unidade pedir.'} error={errors.cpf}>
            <input id="p-cpf" inputMode="numeric" autoComplete="off" className={inputClass} value={form.cpf} onChange={set('cpf')} aria-invalid={!!errors.cpf} placeholder="000.000.000-00" />
          </Field>
          <Field label="Cartão Nacional de Saúde (CNS)" htmlFor="p-cns" hint="15 dígitos, está no seu Cartão SUS." error={errors.cns}>
            <input id="p-cns" inputMode="numeric" className={inputClass} value={form.cns} onChange={set('cns')} aria-invalid={!!errors.cns} />
          </Field>
          <Field label="Endereço" htmlFor="p-addr">
            <input id="p-addr" autoComplete="street-address" className={inputClass} value={form.address} onChange={set('address')} />
          </Field>
          <Field label="Bairro" htmlFor="p-bairro">
            <input id="p-bairro" className={inputClass} value={form.neighborhood} onChange={set('neighborhood')} />
          </Field>
          <div className="flex flex-col gap-3 md:col-span-2">
            {error && <ErrorBox message={error} />}
            {msg && <SuccessBox>{msg}</SuccessBox>}
            <Button type="submit" loading={saving} className="md:w-fit">
              Salvar dados
            </Button>
          </div>
        </form>
      </Card>

      <Card as="section">
        <h2 className="mb-1 text-xl font-bold">Notificações</h2>
        <p className="mb-4 text-tinta-suave">Escolha o que quer receber.</p>
        <ul className="flex flex-col divide-y divide-linha">
          {PREFS.map(({ k, label, help }) => (
            <li key={k}>
              <label className="flex min-h-16 cursor-pointer items-center gap-4 py-3">
                <span className="flex-1">
                  <span className="block font-bold">{label}</span>
                  <span className="text-sm text-tinta-suave">{help}</span>
                </span>
                <input type="checkbox" role="switch" className="peer sr-only" checked={prefs[k]} onChange={(e) => savePrefs({ ...prefs, [k]: e.target.checked })} />
                <span className="relative h-8 w-14 shrink-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-verde-500 peer-focus-visible:outline-3 peer-focus-visible:outline-azul-500 after:absolute after:left-1 after:top-1 after:size-6 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-6" aria-hidden />
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <Card as="section">
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <ShieldCheck className="size-6 text-verde-500" aria-hidden /> Privacidade
        </h2>
        <p className="text-tinta-suave">
          Coletamos apenas o necessário para agendar e avisar você. CPF aparece mascarado e não é exibido para outras pessoas. Você pode pedir a correção ou a exclusão dos seus dados, como garante a LGPD.
        </p>
        {api.mode === 'demo' && (
          <div className="mt-3">
            <InfoNote>Na demonstração, os dados ficam só neste navegador.</InfoNote>
            <Button
              variant="ghost"
              className="mt-2"
              onClick={() => {
                resetDemoData()
                location.href = '/'
              }}
            >
              Apagar dados de demonstração
            </Button>
          </div>
        )}
      </Card>

      <Button variant="danger" onClick={logout} className="md:w-fit">
        <LogOut className="size-5" aria-hidden /> Sair da conta
      </Button>
    </div>
  )
}

export function NotificationsPage() {
  const { refreshUnread } = useApp()
  const [list, setList] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  const load = () =>
    api
      .listNotifications()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
  useEffect(() => {
    load()
  }, [])

  async function open(n: AppNotification) {
    if (!n.read) {
      await api.markNotificationRead(n.id)
      refreshUnread()
    }
    if (n.link) nav(n.link)
    else load()
  }

  async function readAll() {
    await api.markNotificationRead('all')
    refreshUnread()
    load()
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Notificações"
        action={
          list?.some((n) => !n.read) ? (
            <Button variant="ghost" onClick={readAll}>
              <CheckCheck className="size-5" aria-hidden /> <span className="hidden sm:inline">Marcar todas como lidas</span>
            </Button>
          ) : undefined
        }
      />
      {error ? (
        <ErrorBox message={error} />
      ) : list === null ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState title="Nenhuma notificação">
          <span className="inline-flex items-center gap-2">
            <BellOff className="size-5" aria-hidden /> Lembretes e avisos vão aparecer aqui.
          </span>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((n) => (
            <li key={n.id}>
              <button onClick={() => open(n)} className={`flex w-full items-start gap-3 rounded-3xl p-4 text-left ring-1 ${n.read ? 'bg-white/70 ring-linha' : 'bg-white ring-azul-500'}`}>
                <span className={`mt-1 grid size-10 shrink-0 place-items-center rounded-2xl ${n.read ? 'bg-slate-100 text-slate-500' : 'bg-azul-100 text-azul-700'}`}>
                  <Bell className="size-5" aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={n.read ? 'font-semibold' : 'font-bold'}>{n.title}</span>
                    <span className="shrink-0 text-sm text-tinta-suave">{formatRelative(n.createdAt)}</span>
                  </span>
                  <span className="mt-0.5 block text-tinta-suave">{n.body}</span>
                  {!n.read && <span className="sr-only">Não lida</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
