/**
 * Implementação de DEMONSTRAÇÃO do DataService.
 * Os dados ficam no localStorage do navegador e são fictícios.
 * A senha é guardada com hash SHA-256 + salt apenas para não ficar em
 * texto puro; isso NÃO é autenticação de produção. Em produção use o
 * SupabaseService (Supabase Auth).
 */
import { EXAMS, NOTICES, SPECIALTIES, UNITS, generateDemoQueues, generateDemoSlots } from '../data/demo'
import type {
  AppNotification,
  Appointment,
  AppointmentStatus,
  HealthUnit,
  NotificationPrefs,
  QueueStatus,
  QueueUpdateLog,
  Role,
  Slot,
  UserProfile,
} from '../lib/types'
import { ACTIVE_STATUSES, formatDateLong, formatTime, newId, newProtocol } from '../lib/utils'
import { BusinessError } from './types'
import type { BookInput, DataService, QueueUpdateInput, SignUpInput, SlotQuery } from './types'

const KEY = 'mas-demo-db-v1'

interface DB {
  version: 1
  users: UserProfile[]
  passwords: Record<string, { salt: string; hash: string }>
  sessionUserId: string | null
  units: HealthUnit[]
  slots: Slot[]
  queues: QueueStatus[]
  queueLogs: QueueUpdateLog[]
  appointments: Appointment[]
  notifications: AppNotification[]
}

const DEFAULT_PREFS: NotificationPrefs = {
  lembretes: true,
  alteracoes: true,
  avisosUnidade: true,
  preparoExame: true,
  navegador: false,
}

async function hash(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))

export const DEMO_ACCOUNTS = [
  { email: 'maria@demo.sus', password: 'demo1234', label: 'Cidadã' },
  { email: 'gestor@demo.sus', password: 'demo1234', label: 'Gestor de unidade' },
  { email: 'admin@demo.sus', password: 'demo1234', label: 'Administrador' },
]

async function seed(): Promise<DB> {
  const now = new Date().toISOString()
  const mk = (id: string, email: string, fullName: string, role: Role, managed: string[] = []): UserProfile => ({
    id,
    email,
    fullName,
    birthDate: role === 'cidadao' ? '1958-04-12' : null,
    cpf: null,
    cns: null,
    phone: null,
    address: null,
    neighborhood: role === 'cidadao' ? 'Parque das Acácias' : null,
    role,
    managedUnitIds: managed,
    prefs: { ...DEFAULT_PREFS },
    createdAt: now,
  })
  const users = [
    mk('u-maria', 'maria@demo.sus', 'Maria da Silva (demo)', 'cidadao'),
    mk('u-gestor', 'gestor@demo.sus', 'Paulo Souza (demo)', 'gestor_unidade', ['ubs-acacias', 'upa-horizonte']),
    mk('u-admin', 'admin@demo.sus', 'Administração (demo)', 'admin'),
  ]
  const passwords: DB['passwords'] = {}
  for (const u of users) {
    const salt = newId()
    passwords[u.id] = { salt, hash: await hash('demo1234', salt) }
  }
  const slots = generateDemoSlots()
  const db: DB = {
    version: 1,
    users,
    passwords,
    sessionUserId: null,
    units: structuredClone(UNITS),
    slots,
    queues: generateDemoQueues(),
    queueLogs: [],
    appointments: [],
    notifications: [],
  }
  // Um agendamento confirmado e um pedido aguardando autorização, para a conta da Maria.
  const first = slots.find((s) => s.unitId === 'ubs-acacias' && s.refId === 'clinica-geral' && !s.booked)
  if (first) {
    first.booked = true
    db.appointments.push({
      id: newId(),
      protocol: newProtocol(),
      userId: 'u-maria',
      unitId: first.unitId,
      kind: 'consulta',
      refId: 'clinica-geral',
      slotId: first.id,
      startsAt: first.startsAt,
      status: 'confirmada',
      createdAt: now,
      updatedAt: now,
      note: null,
      changeRequested: false,
    })
  }
  db.appointments.push({
    id: newId(),
    protocol: newProtocol(),
    userId: 'u-maria',
    unitId: 'hospital-boa-vista',
    kind: 'exame',
    refId: 'ultrassom-abdome',
    slotId: null,
    startsAt: null,
    status: 'aguardando_autorizacao',
    createdAt: now,
    updatedAt: now,
    note: 'Pedido de exemplo',
    changeRequested: false,
  })
  return db
}

let cache: DB | null = null

async function load(): Promise<DB> {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      cache = JSON.parse(raw) as DB
      return cache
    }
  } catch {
    /* armazenamento indisponível: segue em memória */
  }
  cache = await seed()
  save()
  return cache
}

function save() {
  try {
    if (cache) localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* ignora: modo privado etc. */
  }
}

export function resetDemoData() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  cache = null
}

function requireUser(db: DB): UserProfile {
  const u = db.users.find((x) => x.id === db.sessionUserId)
  if (!u) throw new BusinessError('auth', 'Sua sessão terminou. Entre novamente.')
  return u
}

function requireStaff(db: DB, unitId?: string): UserProfile {
  const u = requireUser(db)
  if (u.role === 'admin') return u
  if (u.role === 'gestor_unidade' && (!unitId || u.managedUnitIds.includes(unitId))) return u
  throw new BusinessError('forbidden', 'Você não tem permissão para esta ação.')
}

function itemName(kind: 'consulta' | 'exame', refId: string) {
  return kind === 'consulta'
    ? SPECIALTIES.find((s) => s.id === refId)?.name ?? refId
    : EXAMS.find((e) => e.id === refId)?.name ?? refId
}

function notify(db: DB, userId: string, n: Omit<AppNotification, 'id' | 'userId' | 'createdAt' | 'read' | 'lockScreenText'>) {
  const user = db.users.find((u) => u.id === userId)
  if (!user) return
  const pref = { lembrete: user.prefs.lembretes, alteracao: user.prefs.alteracoes, unidade: user.prefs.avisosUnidade, preparo: user.prefs.preparoExame }[n.category]
  if (!pref) return
  const notification: AppNotification = {
    ...n,
    id: newId(),
    userId,
    createdAt: new Date().toISOString(),
    read: false,
    lockScreenText: 'Você tem uma nova mensagem no Meu Atendimento SUS.',
  }
  db.notifications.unshift(notification)
  if (user.prefs.navegador && db.sessionUserId === userId && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    // Sem detalhes médicos na notificação do sistema.
    try {
      new Notification('Meu Atendimento SUS', { body: notification.lockScreenText, tag: notification.id })
    } catch {
      /* alguns navegadores só permitem via service worker */
    }
  }
}

/** Gera lembretes de consultas/exames nas próximas 48 h (uma vez por agendamento). */
function ensureReminders(db: DB, user: UserProfile) {
  const now = Date.now()
  for (const a of db.appointments) {
    if (a.userId !== user.id || a.status !== 'confirmada' || !a.startsAt) continue
    const diff = new Date(a.startsAt).getTime() - now
    if (diff <= 0 || diff > 48 * 3600_000) continue
    if (db.notifications.some((n) => n.category === 'lembrete' && n.link === `/agendamentos#${a.id}`)) continue
    notify(db, user.id, {
      title: `Lembrete: ${a.kind === 'consulta' ? 'consulta' : 'exame'} em breve`,
      body: `${itemName(a.kind, a.refId)} em ${formatDateLong(a.startsAt)}, às ${formatTime(a.startsAt)}.`,
      link: `/agendamentos#${a.id}`,
      category: 'lembrete',
    })
    if (a.kind === 'exame') {
      notify(db, user.id, {
        title: 'Confira o preparo do seu exame',
        body: `Veja as orientações de ${itemName(a.kind, a.refId)} antes do dia.`,
        link: `/exames/${a.refId}`,
        category: 'preparo',
      })
    }
  }
}

function overlaps(aStart: string, bStart: string, minutes = 30) {
  return Math.abs(new Date(aStart).getTime() - new Date(bStart).getTime()) < minutes * 60_000
}

export function createDemoService(): DataService {
  return {
    mode: 'demo',

    async getCurrentUser() {
      const db = await load()
      return db.users.find((u) => u.id === db.sessionUserId) ?? null
    },

    async signIn(email, password) {
      await wait()
      const db = await load()
      const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
      const cred = user && db.passwords[user.id]
      if (!user || !cred || (await hash(password, cred.salt)) !== cred.hash) {
        throw new BusinessError('credenciais', 'E-mail ou senha incorretos. Confira e tente de novo.')
      }
      db.sessionUserId = user.id
      save()
      return user
    },

    async signUp(input: SignUpInput) {
      await wait()
      const db = await load()
      const email = input.email.trim().toLowerCase()
      if (db.users.some((u) => u.email === email)) {
        throw new BusinessError('email_em_uso', 'Já existe uma conta com este e-mail. Entre ou recupere a senha.')
      }
      const user: UserProfile = {
        id: newId(),
        email,
        fullName: input.fullName.trim(),
        birthDate: input.birthDate,
        cpf: null,
        cns: null,
        phone: null,
        address: null,
        neighborhood: null,
        role: 'cidadao',
        managedUnitIds: [],
        prefs: { ...DEFAULT_PREFS },
        createdAt: new Date().toISOString(),
      }
      const salt = newId()
      db.users.push(user)
      db.passwords[user.id] = { salt, hash: await hash(input.password, salt) }
      db.sessionUserId = user.id
      save()
      return user
    },

    async signOut() {
      const db = await load()
      db.sessionUserId = null
      save()
    },

    async requestPasswordReset() {
      await wait(400)
      // Demonstração: nenhum e-mail é enviado. Mesma resposta exista ou não a conta.
    },

    async updateProfile(patch) {
      await wait()
      const db = await load()
      const user = requireUser(db)
      Object.assign(user, patch)
      save()
      return { ...user }
    },

    async listUnits() {
      const db = await load()
      return db.units
    },
    async listSpecialties() {
      return SPECIALTIES
    },
    async listExams() {
      return EXAMS
    },
    async listQueues() {
      await wait(150)
      const db = await load()
      return db.queues
    },
    async listNotices() {
      return NOTICES
    },

    async listSlots(q: SlotQuery) {
      await wait(150)
      const db = await load()
      const now = Date.now()
      return db.slots
        .filter(
          (s) =>
            s.kind === q.kind &&
            s.refId === q.refId &&
            (!q.unitId || s.unitId === q.unitId) &&
            new Date(s.startsAt).getTime() > now,
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    },

    async listMyAppointments() {
      const db = await load()
      const user = requireUser(db)
      return db.appointments
        .filter((a) => a.userId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    async book(input: BookInput) {
      await wait(400)
      const db = await load()
      const user = requireUser(db)
      const unit = db.units.find((u) => u.id === input.unitId)
      if (!unit) throw new BusinessError('unidade', 'Unidade não encontrada.')
      const offered = input.kind === 'consulta' ? unit.specialtyIds : unit.examIds
      if (!offered.includes(input.refId)) throw new BusinessError('oferta', 'Esta unidade não oferece este atendimento.')
      const item = input.kind === 'consulta' ? SPECIALTIES.find((s) => s.id === input.refId) : EXAMS.find((e) => e.id === input.refId)
      if (!item) throw new BusinessError('item', 'Atendimento não encontrado.')

      const mine = db.appointments.filter((a) => a.userId === user.id && ACTIVE_STATUSES.includes(a.status) && a.id !== input.replacesId)

      // Regra: no máximo um pedido ativo por especialidade/exame.
      const dup = mine.find((a) => a.kind === input.kind && a.refId === input.refId)
      if (dup) {
        throw new BusinessError(
          'duplicado',
          `Você já tem ${input.kind === 'consulta' ? 'uma consulta' : 'um exame'} de ${item.name} em andamento (protocolo ${dup.protocol}). Cancele ou remarque o atual.`,
        )
      }

      let slot: Slot | undefined
      let status: AppointmentStatus
      if (item.requiresReferral) {
        // Depende de regulação: nunca nasce confirmado, e o horário é definido pela rede.
        status = 'aguardando_autorizacao'
      } else {
        if (!input.slotId) throw new BusinessError('horario', 'Escolha um horário.')
        slot = db.slots.find((s) => s.id === input.slotId)
        if (!slot || slot.unitId !== unit.id || slot.refId !== input.refId) throw new BusinessError('horario', 'Horário inválido.')
        if (new Date(slot.startsAt).getTime() <= Date.now()) throw new BusinessError('horario', 'Este horário já passou. Escolha outro.')
        if (slot.booked) throw new BusinessError('ocupado', 'Este horário acabou de ser preenchido. Escolha outro.')
        // Regra: sem conflito de horário com outros agendamentos do usuário.
        const clash = mine.find((a) => a.startsAt && overlaps(a.startsAt, slot!.startsAt, Math.max(slot!.durationMin, 30)))
        if (clash) {
          throw new BusinessError('conflito', `Você já tem um compromisso às ${formatTime(clash.startsAt!)} neste dia (protocolo ${clash.protocol}).`)
        }
        status = 'confirmada'
      }

      const now = new Date().toISOString()
      if (input.replacesId) {
        const old = db.appointments.find((a) => a.id === input.replacesId && a.userId === user.id)
        if (old && ACTIVE_STATUSES.includes(old.status)) {
          old.status = 'cancelada'
          old.updatedAt = now
          old.note = 'Remarcado pelo usuário'
          const oldSlot = db.slots.find((s) => s.id === old.slotId)
          if (oldSlot) oldSlot.booked = false
        }
      }
      if (slot) slot.booked = true

      const appt: Appointment = {
        id: newId(),
        protocol: newProtocol(),
        userId: user.id,
        unitId: unit.id,
        kind: input.kind,
        refId: input.refId,
        slotId: slot?.id ?? null,
        startsAt: slot?.startsAt ?? null,
        status,
        createdAt: now,
        updatedAt: now,
        note: input.note,
        changeRequested: false,
      }
      db.appointments.push(appt)
      notify(db, user.id, {
        title: status === 'confirmada' ? 'Agendamento confirmado' : 'Pedido registrado',
        body:
          status === 'confirmada'
            ? `${item.name} em ${unit.name}, ${formatDateLong(appt.startsAt!)} às ${formatTime(appt.startsAt!)}. Protocolo ${appt.protocol}.`
            : `${item.name}: aguardando autorização. Avisaremos quando houver data. Protocolo ${appt.protocol}.`,
        link: `/agendamentos#${appt.id}`,
        category: 'alteracao',
      })
      save()
      return appt
    },

    async cancelAppointment(id) {
      await wait()
      const db = await load()
      const user = requireUser(db)
      const a = db.appointments.find((x) => x.id === id && x.userId === user.id)
      if (!a) throw new BusinessError('nao_encontrado', 'Agendamento não encontrado.')
      if (!ACTIVE_STATUSES.includes(a.status)) throw new BusinessError('status', 'Este agendamento não pode mais ser cancelado.')
      if (a.startsAt && new Date(a.startsAt).getTime() < Date.now()) {
        throw new BusinessError('passado', 'Não é possível cancelar um atendimento que já passou.')
      }
      a.status = 'cancelada'
      a.updatedAt = new Date().toISOString()
      const slot = db.slots.find((s) => s.id === a.slotId)
      if (slot) slot.booked = false
      notify(db, user.id, {
        title: 'Agendamento cancelado',
        body: `O protocolo ${a.protocol} foi cancelado.`,
        link: `/agendamentos#${a.id}`,
        category: 'alteracao',
      })
      save()
      return a
    },

    async requestChange(id, note) {
      await wait()
      const db = await load()
      const user = requireUser(db)
      const a = db.appointments.find((x) => x.id === id && x.userId === user.id)
      if (!a || !ACTIVE_STATUSES.includes(a.status)) throw new BusinessError('status', 'Não é possível pedir alteração deste agendamento.')
      a.changeRequested = true
      a.note = note
      a.updatedAt = new Date().toISOString()
      save()
      return a
    },

    async listNotifications() {
      const db = await load()
      const user = requireUser(db)
      ensureReminders(db, user)
      save()
      return db.notifications.filter((n) => n.userId === user.id)
    },

    async markNotificationRead(id) {
      const db = await load()
      const user = requireUser(db)
      for (const n of db.notifications) {
        if (n.userId === user.id && (id === 'all' || n.id === id)) n.read = true
      }
      save()
    },

    // ---------- Painel administrativo ----------

    async saveUnit(unit) {
      await wait()
      const db = await load()
      const existing = db.units.findIndex((u) => u.id === unit.id)
      requireStaff(db, existing >= 0 ? unit.id : undefined)
      if (existing < 0 && requireUser(db).role !== 'admin') {
        throw new BusinessError('forbidden', 'Somente administradores cadastram novas unidades.')
      }
      if (existing >= 0) db.units[existing] = unit
      else {
        db.units.push(unit)
        db.queues.push({ unitId: unit.id, level: 'indisponivel', peopleWaiting: null, waitMinutes: null, serviceType: 'Atendimento', unitSituation: 'aberta', source: 'indisponivel', updatedAt: null, updatedBy: null })
      }
      save()
      return unit
    },

    async updateQueue(input: QueueUpdateInput) {
      await wait()
      const db = await load()
      const staff = requireStaff(db, input.unitId)
      const now = new Date().toISOString()
      const status: QueueStatus = {
        ...input,
        source: input.level === 'indisponivel' ? 'indisponivel' : 'unidade',
        updatedAt: input.level === 'indisponivel' ? null : now,
        updatedBy: staff.fullName,
      }
      const i = db.queues.findIndex((q) => q.unitId === input.unitId)
      if (i >= 0) db.queues[i] = status
      else db.queues.push(status)
      db.queueLogs.unshift({
        id: newId(),
        unitId: input.unitId,
        level: input.level,
        peopleWaiting: input.peopleWaiting,
        waitMinutes: input.waitMinutes,
        source: status.source,
        updatedBy: staff.fullName,
        updatedAt: now,
      })
      save()
      return status
    },

    async listQueueLogs(unitId) {
      const db = await load()
      requireStaff(db, unitId)
      return db.queueLogs.filter((l) => !unitId || l.unitId === unitId)
    },

    async listUnitAppointments() {
      const db = await load()
      const staff = requireStaff(db)
      return db.appointments
        .filter((a) => staff.role === 'admin' || staff.managedUnitIds.includes(a.unitId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    async setAppointmentStatus(id, status, slotId) {
      await wait()
      const db = await load()
      const a = db.appointments.find((x) => x.id === id)
      if (!a) throw new BusinessError('nao_encontrado', 'Agendamento não encontrado.')
      requireStaff(db, a.unitId)
      if (status === 'confirmada' && !a.slotId) {
        if (!slotId) throw new BusinessError('horario', 'Para confirmar, escolha um horário disponível.')
        const slot = db.slots.find((s) => s.id === slotId)
        if (!slot || slot.booked) throw new BusinessError('ocupado', 'Horário indisponível.')
        slot.booked = true
        a.slotId = slot.id
        a.startsAt = slot.startsAt
      }
      if (status === 'cancelada') {
        const slot = db.slots.find((s) => s.id === a.slotId)
        if (slot) slot.booked = false
      }
      a.status = status
      a.changeRequested = false
      a.updatedAt = new Date().toISOString()
      notify(db, a.userId, {
        title: 'Seu agendamento foi atualizado',
        body: `Protocolo ${a.protocol}: novo status "${status.replace('_', ' ')}".`,
        link: `/agendamentos#${a.id}`,
        category: 'alteracao',
      })
      save()
      return a
    },

    async createSlots(slots) {
      await wait()
      const db = await load()
      let created = 0
      for (const s of slots) {
        requireStaff(db, s.unitId)
        const id = `${s.unitId}:${s.refId}:${s.startsAt}`
        if (db.slots.some((x) => x.id === id)) continue // evita horário duplicado
        db.slots.push({ ...s, id, booked: false })
        created++
      }
      save()
      return created
    },

    async deleteSlot(id) {
      const db = await load()
      const slot = db.slots.find((s) => s.id === id)
      if (!slot) return
      requireStaff(db, slot.unitId)
      if (slot.booked) throw new BusinessError('ocupado', 'Este horário tem paciente agendado. Cancele o agendamento antes.')
      db.slots = db.slots.filter((s) => s.id !== id)
      save()
    },

    async listUsers() {
      const db = await load()
      const u = requireUser(db)
      if (u.role !== 'admin') throw new BusinessError('forbidden', 'Somente administradores gerenciam usuários.')
      return db.users
    },

    async setUserRole(userId, role, managedUnitIds) {
      await wait()
      const db = await load()
      const me = requireUser(db)
      if (me.role !== 'admin') throw new BusinessError('forbidden', 'Somente administradores gerenciam permissões.')
      if (me.id === userId && role !== 'admin') throw new BusinessError('self', 'Você não pode remover o próprio acesso de administrador.')
      const u = db.users.find((x) => x.id === userId)
      if (!u) throw new BusinessError('nao_encontrado', 'Usuário não encontrado.')
      u.role = role
      u.managedUnitIds = role === 'gestor_unidade' ? managedUnitIds : []
      save()
    },
  }
}
