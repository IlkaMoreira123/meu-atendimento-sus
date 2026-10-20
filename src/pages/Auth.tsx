import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button, EmergencyBanner, ErrorBox, Field, Logo, SuccessBox, inputClass } from '../components/ui'
import { useApp } from '../context/AppContext'
import { DEMO_ACCOUNTS } from '../services/demoService'
import { api } from '../services'

export function SplashPage() {
  const { authReady, user } = useApp()
  const nav = useNavigate()
  useEffect(() => {
    if (!authReady) return
    const t = setTimeout(() => nav(user ? '/inicio' : '/entrar', { replace: true }), 1300)
    return () => clearTimeout(t)
  }, [authReady, user, nav])
  return (
    <div className="grid min-h-dvh place-items-center bg-azul-700 text-white">
      <div className="entrada flex flex-col items-center gap-6 text-2xl">
        <Logo size={96} light />
        <p className="max-w-xs text-center text-base opacity-90">Unidades, consultas, exames e filas em um só lugar.</p>
      </div>
    </div>
  )
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-azul-50 md:grid md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-azul-700 p-10 text-white md:flex">
        <Logo size={56} light />
        <div>
          <p className="font-display text-4xl font-bold leading-tight">Cuidar da saúde começa por saber onde ir.</p>
          <p className="mt-4 max-w-md text-lg opacity-90">Encontre a unidade mais próxima, veja como está o movimento e agende sem sair de casa.</p>
        </div>
        <p className="text-sm opacity-75">Seus dados são protegidos conforme a LGPD.</p>
      </div>
      <div className="flex flex-col justify-center px-5 py-10 md:px-14">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 text-xl md:hidden">
            <Logo size={48} />
          </div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-tinta-suave">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          <div className="mt-8">
            <EmergencyBanner compact />
          </div>
        </div>
      </div>
    </div>
  )
}

const loginSchema = z.object({
  email: z.string().trim().email('Digite um e-mail válido, por exemplo nome@email.com.'),
  password: z.string().min(1, 'Digite sua senha.'),
})

export function LoginPage() {
  const { user, setUser } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/inicio" replace />

  async function submit(e: FormEvent, override?: { email: string; password: string }) {
    e.preventDefault()
    const values = override ?? { email, password }
    const parsed = loginSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])))
      return
    }
    setErrors({})
    setError(null)
    setLoading(true)
    try {
      const u = await api.signIn(parsed.data.email, parsed.data.password)
      setUser(u)
      const from = (loc.state as { from?: string } | null)?.from
      nav(from && from !== '/entrar' ? from : '/inicio', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Entrar" subtitle="Use o e-mail e a senha da sua conta.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <ErrorBox message={error} />}
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password}>
          <input id="password" type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
        </Field>
        <Button type="submit" loading={loading} className="mt-2 w-full text-lg">
          Entrar
        </Button>
        <div className="flex flex-wrap justify-between gap-2">
          <Link to="/recuperar-senha" className="font-bold text-azul-700 underline">
            Esqueci minha senha
          </Link>
          <Link to="/cadastro" className="font-bold text-azul-700 underline">
            Criar conta
          </Link>
        </div>
      </form>

      {api.mode === 'demo' && (
        <div className="mt-8 rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="font-bold text-amber-900">Contas de demonstração</p>
          <p className="text-sm text-amber-900/80">Toque para entrar. Senha de todas: demo1234</p>
          <div className="mt-3 flex flex-col gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={(e) => submit(e as unknown as FormEvent, a)}
                className="flex min-h-12 items-center justify-between rounded-2xl bg-white px-4 text-left ring-1 ring-amber-200 hover:ring-amber-500"
              >
                <span className="font-bold">{a.label}</span>
                <span className="text-sm text-tinta-suave">{a.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  )
}

const signUpSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Digite seu nome completo.').refine((v) => v.includes(' '), 'Digite nome e sobrenome.'),
    email: z.string().trim().email('Digite um e-mail válido.'),
    birthDate: z
      .string()
      .optional()
      .refine((v) => !v || (new Date(v) < new Date() && new Date(v).getFullYear() > 1900), 'Data de nascimento inválida.'),
    password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').regex(/\d/, 'Inclua pelo menos um número.'),
    confirm: z.string(),
    consent: z.literal(true, { error: 'Para criar a conta, aceite o uso dos dados.' }),
  })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'As senhas não são iguais.' })

export function SignUpPage() {
  const { user, setUser } = useApp()
  const nav = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', birthDate: '', password: '', confirm: '', consent: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  if (user) return <Navigate to="/inicio" replace />

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = signUpSchema.safeParse(form)
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])))
      return
    }
    setErrors({})
    setError(null)
    setLoading(true)
    try {
      const u = await api.signUp({ fullName: parsed.data.fullName, email: parsed.data.email, password: parsed.data.password, birthDate: parsed.data.birthDate || null })
      setUser(u)
      nav('/inicio', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a conta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Criar conta" subtitle="Pedimos só o necessário. CPF e Cartão SUS podem ser informados depois, se precisar.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <ErrorBox message={error} />}
        <Field label="Nome completo" htmlFor="fullName" error={errors.fullName}>
          <input id="fullName" autoComplete="name" className={inputClass} value={form.fullName} onChange={set('fullName')} aria-invalid={!!errors.fullName} />
        </Field>
        <Field label="E-mail" htmlFor="su-email" error={errors.email}>
          <input id="su-email" type="email" autoComplete="email" className={inputClass} value={form.email} onChange={set('email')} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Data de nascimento (opcional)" htmlFor="birth" error={errors.birthDate}>
          <input id="birth" type="date" className={inputClass} value={form.birthDate} onChange={set('birthDate')} aria-invalid={!!errors.birthDate} />
        </Field>
        <Field label="Senha" htmlFor="su-pass" hint="Mínimo de 8 caracteres, com pelo menos um número." error={errors.password}>
          <input id="su-pass" type="password" autoComplete="new-password" className={inputClass} value={form.password} onChange={set('password')} aria-invalid={!!errors.password} />
        </Field>
        <Field label="Repita a senha" htmlFor="su-confirm" error={errors.confirm}>
          <input id="su-confirm" type="password" autoComplete="new-password" className={inputClass} value={form.confirm} onChange={set('confirm')} aria-invalid={!!errors.confirm} />
        </Field>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 size-5 accent-azul-700" checked={form.consent} onChange={set('consent')} />
          <span>
            Concordo com o uso dos meus dados para agendamentos e avisos, conforme a LGPD. Posso pedir a exclusão a qualquer momento.
          </span>
        </label>
        {errors.consent && <p className="text-sm font-bold text-red-700">{errors.consent}</p>}
        <Button type="submit" loading={loading} className="w-full text-lg">
          Criar conta
        </Button>
        <p>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-bold text-azul-700 underline">
            Entrar
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!z.string().email().safeParse(email.trim()).success) {
      setErr('Digite um e-mail válido.')
      return
    }
    setErr(null)
    setLoading(true)
    try {
      await api.requestPasswordReset(email.trim())
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      {sent ? (
        <div className="flex flex-col gap-4">
          <SuccessBox>
            Se houver uma conta com este e-mail, você receberá o link em alguns minutos. Confira também a caixa de spam.
            {api.mode === 'demo' && ' (Na demonstração nenhum e-mail é enviado.)'}
          </SuccessBox>
          <Link to="/entrar" className="font-bold text-azul-700 underline">
            Voltar para entrar
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="E-mail da conta" htmlFor="rp-email" error={err}>
            <input id="rp-email" type="email" autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!err} />
          </Field>
          <Button type="submit" loading={loading} className="w-full text-lg">
            Enviar link
          </Button>
          <Link to="/entrar" className="font-bold text-azul-700 underline">
            Voltar para entrar
          </Link>
        </form>
      )}
    </AuthShell>
  )
}
