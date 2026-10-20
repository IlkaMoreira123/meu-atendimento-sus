export type UnitType = 'UBS' | 'UPA' | 'HOSPITAL' | 'CLINICA' | 'LABORATORIO'

export type Role = 'cidadao' | 'gestor_unidade' | 'admin'

/** Origem de um dado de fila. Nunca exibir dado sem origem. */
export type QueueSource =
  | 'demonstracao' // dado fictício, apenas para testes
  | 'unidade' // informado manualmente por profissional autorizado da unidade
  | 'integracao' // recebido de integração oficial (ainda não existe neste MVP)
  | 'indisponivel'

export type CrowdLevel = 'baixo' | 'moderado' | 'alto' | 'indisponivel'

export interface QueueStatus {
  unitId: string
  level: CrowdLevel
  peopleWaiting: number | null
  waitMinutes: number | null
  serviceType: string
  unitSituation: 'aberta' | 'fechada' | 'atendimento_restrito'
  source: QueueSource
  updatedAt: string | null // ISO
  updatedBy: string | null // nome de quem atualizou (painel)
}

export interface OpeningHours {
  label: string // ex.: "Seg a sex, 7h às 19h"
  open24h: boolean
  weekdays: { open: string; close: string } | null
  saturday: { open: string; close: string } | null
}

export interface HealthUnit {
  id: string
  name: string
  type: UnitType
  address: string
  neighborhood: string
  city: string
  cep: string
  lat: number
  lng: number
  phone: string | null
  hours: OpeningHours
  services: string[]
  specialtyIds: string[]
  examIds: string[]
  accessibility: string[]
  isDemo: boolean
}

export interface Specialty {
  id: string
  name: string
  /** Exige encaminhamento/regulação: o pedido nasce como "aguardando autorização". */
  requiresReferral: boolean
}

export interface Exam {
  id: string
  name: string
  category: 'laboratorial' | 'imagem' | 'outros'
  requiresReferral: boolean
  /** Preparo: só exibir texto fornecido oficialmente pela unidade/rede. */
  preparation: string | null
  preparationSource: string | null
}

export interface Slot {
  id: string
  unitId: string
  kind: 'consulta' | 'exame'
  refId: string // specialtyId ou examId
  startsAt: string // ISO
  durationMin: number
  professional: string | null
  booked: boolean
}

export type AppointmentStatus =
  | 'solicitada'
  | 'aguardando_autorizacao'
  | 'confirmada'
  | 'cancelada'
  | 'realizada'

export interface Appointment {
  id: string
  protocol: string
  userId: string
  unitId: string
  kind: 'consulta' | 'exame'
  refId: string
  slotId: string | null // pedidos que dependem de autorização podem não ter horário
  startsAt: string | null
  status: AppointmentStatus
  createdAt: string
  updatedAt: string
  note: string | null
  changeRequested: boolean
}

export interface NotificationPrefs {
  lembretes: boolean
  alteracoes: boolean
  avisosUnidade: boolean
  preparoExame: boolean
  navegador: boolean
}

export interface UserProfile {
  id: string
  email: string
  fullName: string
  birthDate: string | null
  cpf: string | null
  cns: string | null
  phone: string | null
  address: string | null
  neighborhood: string | null
  role: Role
  managedUnitIds: string[]
  prefs: NotificationPrefs
  createdAt: string
}

export interface AppNotification {
  id: string
  userId: string
  title: string
  body: string
  /** Texto genérico para tela bloqueada, sem informação médica. */
  lockScreenText: string
  createdAt: string
  read: boolean
  link: string | null
  category: 'lembrete' | 'alteracao' | 'unidade' | 'preparo'
}

export interface QueueUpdateLog {
  id: string
  unitId: string
  level: CrowdLevel
  peopleWaiting: number | null
  waitMinutes: number | null
  source: QueueSource
  updatedBy: string
  updatedAt: string
}

export interface Notice {
  id: string
  title: string
  body: string
  tone: 'info' | 'alerta'
}
