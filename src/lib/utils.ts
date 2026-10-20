import type { AppointmentStatus, CrowdLevel, QueueStatus, UnitType } from './types'

/** Dados de fila mais antigos que isso são tratados como desatualizados (cinza). */
export const QUEUE_STALE_MINUTES = 60

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatKm(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`
}

export function minutesSince(iso: string | null, now = Date.now()) {
  if (!iso) return null
  return Math.round((now - new Date(iso).getTime()) / 60_000)
}

/** Nível efetivo: dado sem origem confiável ou antigo vira "indisponivel". */
export function effectiveLevel(q: QueueStatus | undefined): CrowdLevel {
  if (!q || q.source === 'indisponivel' || !q.updatedAt) return 'indisponivel'
  const age = minutesSince(q.updatedAt)
  if (age === null || age > QUEUE_STALE_MINUTES) return 'indisponivel'
  return q.level
}

export function isStale(q: QueueStatus | undefined) {
  if (!q?.updatedAt) return false
  return (minutesSince(q.updatedAt) ?? 0) > QUEUE_STALE_MINUTES
}

export const CROWD: Record<CrowdLevel, { label: string; short: string; color: string; bg: string; text: string }> = {
  baixo: { label: 'Movimento baixo', short: 'Baixo', color: 'var(--color-lot-baixo)', bg: 'bg-verde-100', text: 'text-verde-700' },
  moderado: { label: 'Movimento moderado', short: 'Moderado', color: 'var(--color-lot-moderado)', bg: 'bg-amber-100', text: 'text-amber-800' },
  alto: { label: 'Movimento alto', short: 'Alto', color: 'var(--color-lot-alto)', bg: 'bg-red-100', text: 'text-red-800' },
  indisponivel: { label: 'Sem informação atual', short: 'Sem dados', color: 'var(--color-lot-indisponivel)', bg: 'bg-slate-200', text: 'text-slate-700' },
}

export const SOURCE_LABEL = {
  demonstracao: 'Dado de demonstração (fictício)',
  unidade: 'Informado pela própria unidade',
  integracao: 'Integração oficial',
  indisponivel: 'Sem fonte de dados',
} as const

export const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  UBS: 'UBS',
  UPA: 'UPA',
  HOSPITAL: 'Hospital',
  CLINICA: 'Clínica / Ambulatório',
  LABORATORIO: 'Laboratório',
}

export const UNIT_TYPE_COLOR: Record<UnitType, string> = {
  UBS: '#1F9D6B',
  UPA: '#CC3B3B',
  HOSPITAL: '#0B4F8A',
  CLINICA: '#7A4FC4',
  LABORATORIO: '#C98A00',
}

export const STATUS_INFO: Record<AppointmentStatus, { label: string; className: string; help: string }> = {
  solicitada: {
    label: 'Solicitada',
    className: 'bg-azul-100 text-azul-900',
    help: 'Pedido registrado. A unidade ainda vai analisar.',
  },
  aguardando_autorizacao: {
    label: 'Aguardando autorização',
    className: 'bg-amber-100 text-amber-900',
    help: 'Depende de encaminhamento ou regulação. Ainda não é um agendamento confirmado.',
  },
  confirmada: {
    label: 'Confirmada',
    className: 'bg-verde-100 text-verde-700',
    help: 'Data e horário garantidos.',
  },
  cancelada: { label: 'Cancelada', className: 'bg-slate-200 text-slate-700', help: 'Este agendamento foi cancelado.' },
  realizada: { label: 'Realizada', className: 'bg-slate-100 text-slate-700', help: 'Atendimento concluído.' },
}

export const ACTIVE_STATUSES: AppointmentStatus[] = ['solicitada', 'aguardando_autorizacao', 'confirmada']

export function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
export function formatRelative(iso: string | null) {
  const m = minutesSince(iso)
  if (m === null) return 'nunca atualizado'
  if (m < 1) return 'agora mesmo'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h`
  return `em ${formatDate(iso!)}`
}

export function formatWait(min: number | null) {
  if (min === null) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const r = min % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

export function newId() {
  return crypto.randomUUID()
}

export function newProtocol(date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '')
  const rnd = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')
  return `MAS-${ymd}-${rnd}`
}

export function onlyDigits(s: string) {
  return s.replace(/\D/g, '')
}

export function isValidCPF(value: string) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10])
}

/** Validação estrutural do Cartão Nacional de Saúde (15 dígitos). */
export function isValidCNS(value: string) {
  const cns = onlyDigits(value)
  if (cns.length !== 15) return false
  let sum = 0
  for (let i = 0; i < 15; i++) sum += Number(cns[i]) * (15 - i)
  return sum % 11 === 0
}

export function maskCPF(value: string | null) {
  if (!value) return '—'
  const d = onlyDigits(value)
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
}

export function formatCPFInput(value: string) {
  const d = onlyDigits(value).slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function firstName(full: string) {
  return full.trim().split(/\s+/)[0] ?? ''
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function routeUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`
}

export function isOpenNow(hours: { open24h: boolean; weekdays: { open: string; close: string } | null; saturday: { open: string; close: string } | null }, now = new Date()) {
  if (hours.open24h) return true
  const dow = now.getDay()
  const range = dow === 0 ? null : dow === 6 ? hours.saturday : hours.weekdays
  if (!range) return false
  const cur = now.getHours() * 60 + now.getMinutes()
  const [oh, om] = range.open.split(':').map(Number)
  const [ch, cm] = range.close.split(':').map(Number)
  return cur >= oh * 60 + om && cur < ch * 60 + cm
}
