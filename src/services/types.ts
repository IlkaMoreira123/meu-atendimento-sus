import type {
  AppNotification,
  Appointment,
  AppointmentStatus,
  CrowdLevel,
  Exam,
  HealthUnit,
  Notice,
  QueueStatus,
  QueueUpdateLog,
  Role,
  Slot,
  Specialty,
  UserProfile,
} from '../lib/types'

export interface SignUpInput {
  fullName: string
  email: string
  password: string
  birthDate: string | null
}

export interface BookInput {
  kind: 'consulta' | 'exame'
  refId: string
  unitId: string
  /** null quando o item exige autorização: vira uma solicitação sem horário. */
  slotId: string | null
  note: string | null
  /** Ao remarcar: agendamento antigo que será cancelado na mesma operação. */
  replacesId?: string
}

export interface QueueUpdateInput {
  unitId: string
  level: CrowdLevel
  peopleWaiting: number | null
  waitMinutes: number | null
  serviceType: string
  unitSituation: QueueStatus['unitSituation']
}

export interface SlotQuery {
  unitId?: string
  kind: 'consulta' | 'exame'
  refId: string
}

/** Erro de regra de negócio, com mensagem pronta para o usuário. */
export class BusinessError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/**
 * Contrato único de acesso a dados. Há duas implementações:
 *  - DemoService: dados fictícios salvos no navegador (padrão).
 *  - SupabaseService: banco real com autenticação e RLS.
 * Integrações futuras (e-SUS, regulação, sistemas de fila) entram
 * como novas implementações ou como fontes do SupabaseService.
 */
export interface DataService {
  readonly mode: 'demo' | 'supabase'

  // Autenticação e perfil
  getCurrentUser(): Promise<UserProfile | null>
  signIn(email: string, password: string): Promise<UserProfile>
  signUp(input: SignUpInput): Promise<UserProfile>
  signOut(): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  updateProfile(patch: Partial<Omit<UserProfile, 'id' | 'email' | 'role' | 'managedUnitIds' | 'createdAt'>>): Promise<UserProfile>

  // Catálogo
  listUnits(): Promise<HealthUnit[]>
  listSpecialties(): Promise<Specialty[]>
  listExams(): Promise<Exam[]>
  listQueues(): Promise<QueueStatus[]>
  listSlots(q: SlotQuery): Promise<Slot[]>
  listNotices(): Promise<Notice[]>

  // Agendamentos do usuário
  listMyAppointments(): Promise<Appointment[]>
  book(input: BookInput): Promise<Appointment>
  cancelAppointment(id: string): Promise<Appointment>
  requestChange(id: string, note: string): Promise<Appointment>

  // Notificações
  listNotifications(): Promise<AppNotification[]>
  markNotificationRead(id: string | 'all'): Promise<void>

  // Painel administrativo
  saveUnit(unit: HealthUnit): Promise<HealthUnit>
  updateQueue(input: QueueUpdateInput): Promise<QueueStatus>
  listQueueLogs(unitId?: string): Promise<QueueUpdateLog[]>
  listUnitAppointments(): Promise<Appointment[]>
  setAppointmentStatus(id: string, status: AppointmentStatus, slotId?: string | null): Promise<Appointment>
  createSlots(slots: Omit<Slot, 'id' | 'booked'>[]): Promise<number>
  deleteSlot(id: string): Promise<void>
  listUsers(): Promise<UserProfile[]>
  setUserRole(userId: string, role: Role, managedUnitIds: string[]): Promise<void>
}
