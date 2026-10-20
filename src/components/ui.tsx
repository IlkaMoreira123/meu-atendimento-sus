import { AlertTriangle, ChevronLeft, Info, Loader2, Phone } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AppointmentStatus, CrowdLevel, QueueStatus } from '../lib/types'
import { CROWD, SOURCE_LABEL, STATUS_INFO, effectiveLevel, formatRelative, isStale } from '../lib/utils'

export function Logo({ size = 40, withName = true, light = false }: { size?: number; withName?: boolean; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 4C19.3 4 9 14.1 9 26.6 9 43.4 32 60 32 60s23-16.6 23-33.4C55 14.1 44.7 4 32 4Z" fill={light ? '#fff' : '#0B4F8A'} />
        <circle cx="32" cy="26" r="15" fill={light ? '#0B4F8A' : '#fff'} />
        <path d="M28 15h8v7h7v8h-7v7h-8v-7h-7v-8h7z" fill="#1F9D6B" />
      </svg>
      {withName && (
        <span className={`font-display leading-none ${light ? 'text-white' : 'text-azul-900'}`}>
          <span className="block text-[0.8em] font-medium opacity-80">Meu Atendimento</span>
          <span className="block text-[1.15em] font-bold tracking-tight">SUS</span>
        </span>
      )}
    </span>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'green'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-azul-700 text-white hover:bg-azul-900 shadow-sm',
  green: 'bg-verde-500 text-white hover:bg-verde-700 shadow-sm',
  secondary: 'bg-white text-azul-700 border-2 border-azul-100 hover:border-azul-500',
  ghost: 'text-azul-700 hover:bg-azul-100',
  danger: 'bg-white text-red-700 border-2 border-red-200 hover:border-red-500',
}

export function Button({
  variant = 'primary',
  loading,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function Card({ children, className = '', as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'li' }) {
  return <As className={`min-w-0 rounded-3xl bg-white p-5 shadow-[0_2px_10px_-4px_rgba(11,79,138,0.18)] ring-1 ring-linha/70 ${className}`}>{children}</As>
}

export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: ReactNode; back?: boolean | string; action?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="mb-5 flex items-start gap-3">
      {back && (
        <button
          onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}
          className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-full bg-white text-azul-700 ring-1 ring-linha hover:bg-azul-100"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-tinta-suave">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-tinta-suave">
      <Loader2 className="size-6 animate-spin text-azul-500" aria-hidden />
      {label}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-red-900 ring-1 ring-red-200">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 font-bold underline">
            Tentar de novo
          </button>
        )}
      </div>
    </div>
  )
}

export function SuccessBox({ children }: { children: ReactNode }) {
  return <div role="status" className="rounded-2xl bg-verde-100 p-4 text-verde-700 ring-1 ring-verde-500/30">{children}</div>
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-linha bg-white/60 p-8 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-tinta-suave">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function CrowdDot({ level, size = 12 }: { level: CrowdLevel; size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: CROWD[level].color }} />
}

export function CrowdBadge({ queue }: { queue: QueueStatus | undefined }) {
  const level = effectiveLevel(queue)
  const c = CROWD[level]
  const stale = isStale(queue)
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${c.bg} ${c.text}`}>
      <CrowdDot level={level} size={10} />
      {stale ? 'Informação desatualizada' : c.label}
    </span>
  )
}

/** Linha de transparência: de onde vem o dado e quando foi atualizado. */
export function QueueSourceLine({ queue }: { queue: QueueStatus | undefined }) {
  if (!queue || queue.source === 'indisponivel') {
    return <p className="text-sm text-tinta-suave">Esta unidade ainda não envia dados de fila.</p>
  }
  return (
    <p className="text-sm text-tinta-suave">
      {SOURCE_LABEL[queue.source]}, atualizado {formatRelative(queue.updatedAt)}
      {queue.updatedBy && queue.source === 'unidade' ? ` por ${queue.updatedBy}` : ''}.
    </p>
  )
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const s = STATUS_INFO[status]
  return <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${s.className}`}>{s.label}</span>
}

export function DemoTag() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900" title="Dado fictício para demonstração">
      Demonstração
    </span>
  )
}

export function EmergencyBanner({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`flex items-start gap-3 rounded-2xl bg-red-50 text-red-900 ring-1 ring-red-200 ${compact ? 'p-3 text-sm' : 'p-4'}`}>
      <Phone className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p>
        Este aplicativo não substitui atendimento de emergência. Em caso de dor no peito, falta de ar, desmaio ou outros sinais
        graves, procure atendimento imediato ou ligue{' '}
        <a href="tel:192" className="font-bold underline">
          SAMU 192
        </a>
        .
      </p>
    </aside>
  )
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-azul-100/60 p-3 text-sm text-azul-900">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
  htmlFor: string
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block font-bold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-sm text-tinta-suave">{hint}</p>}
      {error && (
        <p className="mt-1 text-sm font-bold text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export const inputClass =
  'w-full min-h-12 rounded-2xl border-2 border-linha bg-white px-4 py-2.5 text-tinta placeholder:text-tinta-suave/70 focus:border-azul-500 focus:outline-none aria-[invalid=true]:border-red-500'

export function BigAction({ to, icon, title, desc, tone = 'azul' }: { to: string; icon: ReactNode; title: string; desc?: string; tone?: 'azul' | 'verde' | 'branco' }) {
  const tones = {
    azul: 'bg-azul-700 text-white hover:bg-azul-900',
    verde: 'bg-verde-500 text-white hover:bg-verde-700',
    branco: 'bg-white text-azul-900 ring-1 ring-linha hover:ring-azul-500',
  }
  return (
    <Link to={to} className={`flex min-h-24 flex-col justify-between gap-3 rounded-3xl p-4 transition-colors ${tones[tone]}`}>
      <span className={`grid size-11 place-items-center rounded-2xl ${tone === 'branco' ? 'bg-azul-100 text-azul-700' : 'bg-white/15'}`}>{icon}</span>
      <span>
        <span className="block font-display text-lg font-semibold leading-tight">{title}</span>
        {desc && <span className="mt-0.5 block text-sm opacity-85">{desc}</span>}
      </span>
    </Link>
  )
}
