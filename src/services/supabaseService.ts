/**
 * Implementação do DataService sobre Supabase (Auth + Postgres + RLS).
 * Ativada quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidas.
 * As regras de agendamento rodam no banco (funções RPC em supabase/migrations).
 */
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AppNotification,
  Appointment,
  Exam,
  HealthUnit,
  Notice,
  QueueStatus,
  QueueUpdateLog,
  Slot,
  Specialty,
  UserProfile,
} from '../lib/types'
import { BusinessError } from './types'
import type { DataService } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

const toUnit = (r: Row): HealthUnit => ({
  id: r.id,
  name: r.name,
  type: r.type,
  address: r.address,
  neighborhood: r.neighborhood,
  city: r.city,
  cep: r.cep,
  lat: r.lat,
  lng: r.lng,
  phone: r.phone,
  hours: r.hours,
  services: r.services ?? [],
  specialtyIds: r.specialty_ids ?? [],
  examIds: r.exam_ids ?? [],
  accessibility: r.accessibility ?? [],
  isDemo: r.is_demo,
})

const fromUnit = (u: HealthUnit): Row => ({
  id: u.id,
  name: u.name,
  type: u.type,
  address: u.address,
  neighborhood: u.neighborhood,
  city: u.city,
  cep: u.cep,
  lat: u.lat,
  lng: u.lng,
  phone: u.phone,
  hours: u.hours,
  services: u.services,
  specialty_ids: u.specialtyIds,
  exam_ids: u.examIds,
  accessibility: u.accessibility,
  is_demo: u.isDemo,
  updated_at: new Date().toISOString(),
})

const toQueue = (r: Row): QueueStatus => ({
  unitId: r.unit_id,
  level: r.level,
  peopleWaiting: r.people_waiting,
  waitMinutes: r.wait_minutes,
  serviceType: r.service_type,
  unitSituation: r.unit_situation,
  source: r.source,
  updatedAt: r.updated_at,
  updatedBy: r.updated_by,
})

const toAppt = (r: Row): Appointment => ({
  id: r.id,
  protocol: r.protocol,
  userId: r.user_id,
  unitId: r.unit_id,
  kind: r.kind,
  refId: r.ref_id,
  slotId: r.slot_id,
  startsAt: r.starts_at,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  note: r.note,
  changeRequested: r.change_requested,
})

const toSlot = (r: Row): Slot => ({
  id: r.id,
  unitId: r.unit_id,
  kind: r.kind,
  refId: r.ref_id,
  startsAt: r.starts_at,
  durationMin: r.duration_min,
  professional: r.professional,
  booked: r.booked,
})

function fail(error: { message: string } | null): never | void {
  if (error) throw new BusinessError('supabase', error.message)
}

export function createSupabaseService(url: string, anonKey: string): DataService {
  const sb: SupabaseClient = createClient(url, anonKey)

  async function profile(): Promise<UserProfile | null> {
    const { data: auth } = await sb.auth.getUser()
    if (!auth.user) return null
    const { data, error } = await sb.from('profiles').select('*').eq('id', auth.user.id).single()
    fail(error)
    const { data: managed } = await sb.from('unit_managers').select('unit_id').eq('user_id', auth.user.id)
    return {
      id: data!.id,
      email: data!.email,
      fullName: data!.full_name,
      birthDate: data!.birth_date,
      cpf: data!.cpf,
      cns: data!.cns,
      phone: data!.phone,
      address: data!.address,
      neighborhood: data!.neighborhood,
      role: data!.role,
      managedUnitIds: (managed ?? []).map((m: Row) => m.unit_id),
      prefs: data!.prefs,
      createdAt: data!.created_at,
    }
  }

  async function uid() {
    const { data } = await sb.auth.getUser()
    if (!data.user) throw new BusinessError('auth', 'Sua sessão terminou. Entre novamente.')
    return data.user.id
  }

  return {
    mode: 'supabase',

    getCurrentUser: profile,

    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new BusinessError('credenciais', 'E-mail ou senha incorretos. Confira e tente de novo.')
      return (await profile())!
    },

    async signUp({ fullName, email, password, birthDate }) {
      const { error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, birth_date: birthDate ?? '' } },
      })
      fail(error)
      const p = await profile()
      if (!p) throw new BusinessError('confirmar_email', 'Conta criada. Confirme seu e-mail para entrar.')
      return p
    },

    async signOut() {
      await sb.auth.signOut()
    },

    async requestPasswordReset(email) {
      await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/recuperar-senha` })
    },

    async updateProfile(patch) {
      const id = await uid()
      const row: Row = {}
      if (patch.fullName !== undefined) row.full_name = patch.fullName
      if (patch.birthDate !== undefined) row.birth_date = patch.birthDate
      if (patch.cpf !== undefined) row.cpf = patch.cpf
      if (patch.cns !== undefined) row.cns = patch.cns
      if (patch.phone !== undefined) row.phone = patch.phone
      if (patch.address !== undefined) row.address = patch.address
      if (patch.neighborhood !== undefined) row.neighborhood = patch.neighborhood
      if (patch.prefs !== undefined) row.prefs = patch.prefs
      fail((await sb.from('profiles').update(row).eq('id', id)).error)
      return (await profile())!
    },

    async listUnits() {
      const { data, error } = await sb.from('units').select('*').order('name')
      fail(error)
      return (data ?? []).map(toUnit)
    },

    async listSpecialties() {
      const { data, error } = await sb.from('specialties').select('*').order('name')
      fail(error)
      return (data ?? []).map((r: Row): Specialty => ({ id: r.id, name: r.name, requiresReferral: r.requires_referral }))
    },

    async listExams() {
      const { data, error } = await sb.from('exams').select('*').order('name')
      fail(error)
      return (data ?? []).map(
        (r: Row): Exam => ({
          id: r.id,
          name: r.name,
          category: r.category,
          requiresReferral: r.requires_referral,
          preparation: r.preparation,
          preparationSource: r.preparation_source,
        }),
      )
    },

    async listQueues() {
      const { data, error } = await sb.from('queue_status').select('*')
      fail(error)
      return (data ?? []).map(toQueue)
    },

    async listNotices() {
      const { data } = await sb.from('notices').select('*')
      return (data ?? []) as Notice[]
    },

    async listSlots({ unitId, kind, refId }) {
      let q = sb.from('slots').select('*').eq('kind', kind).eq('ref_id', refId).gt('starts_at', new Date().toISOString()).order('starts_at')
      if (unitId) q = q.eq('unit_id', unitId)
      const { data, error } = await q
      fail(error)
      return (data ?? []).map(toSlot)
    },

    async listMyAppointments() {
      const id = await uid()
      const { data, error } = await sb.from('appointments').select('*').eq('user_id', id).order('created_at', { ascending: false })
      fail(error)
      return (data ?? []).map(toAppt)
    },

    async book(input) {
      const { data, error } = await sb.rpc('book_appointment', {
        p_kind: input.kind,
        p_ref_id: input.refId,
        p_unit_id: input.unitId,
        p_slot_id: input.slotId,
        p_note: input.note,
        p_replaces_id: input.replacesId ?? null,
      })
      fail(error)
      return toAppt(data)
    },

    async cancelAppointment(id) {
      const { data, error } = await sb.rpc('cancel_appointment', { p_id: id })
      fail(error)
      return toAppt(data)
    },

    async requestChange(id, note) {
      const { data, error } = await sb.rpc('request_appointment_change', { p_id: id, p_note: note })
      fail(error)
      return toAppt(data)
    },

    async listNotifications() {
      const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false })
      fail(error)
      return (data ?? []).map(
        (r: Row): AppNotification => ({
          id: r.id,
          userId: r.user_id,
          title: r.title,
          body: r.body,
          lockScreenText: r.lock_screen_text,
          createdAt: r.created_at,
          read: r.read,
          link: r.link,
          category: r.category,
        }),
      )
    },

    async markNotificationRead(id) {
      const q = sb.from('notifications').update({ read: true })
      fail((id === 'all' ? await q.eq('read', false) : await q.eq('id', id)).error)
    },

    async saveUnit(unit) {
      const { error } = await sb.from('units').upsert(fromUnit(unit))
      fail(error)
      return unit
    },

    async updateQueue(i) {
      const { data, error } = await sb.rpc('update_queue', {
        p_unit_id: i.unitId,
        p_level: i.level,
        p_people: i.peopleWaiting,
        p_wait: i.waitMinutes,
        p_service_type: i.serviceType,
        p_situation: i.unitSituation,
      })
      fail(error)
      return toQueue(data)
    },

    async listQueueLogs(unitId) {
      let q = sb.from('queue_updates').select('*').order('updated_at', { ascending: false }).limit(200)
      if (unitId) q = q.eq('unit_id', unitId)
      const { data, error } = await q
      fail(error)
      return (data ?? []).map(
        (r: Row): QueueUpdateLog => ({
          id: r.id,
          unitId: r.unit_id,
          level: r.level,
          peopleWaiting: r.people_waiting,
          waitMinutes: r.wait_minutes,
          source: r.source,
          updatedBy: r.updated_by,
          updatedAt: r.updated_at,
        }),
      )
    },

    async listUnitAppointments() {
      // A RLS já restringe às unidades que o gestor administra.
      const me = await uid()
      const { data, error } = await sb.from('appointments').select('*').neq('user_id', me).order('created_at', { ascending: false })
      fail(error)
      return (data ?? []).map(toAppt)
    },

    async setAppointmentStatus(id, status, slotId) {
      const { data, error } = await sb.rpc('staff_set_appointment_status', { p_id: id, p_status: status, p_slot_id: slotId ?? null })
      fail(error)
      return toAppt(data)
    },

    async createSlots(slots) {
      const rows = slots.map((s) => ({
        unit_id: s.unitId,
        kind: s.kind,
        ref_id: s.refId,
        starts_at: s.startsAt,
        duration_min: s.durationMin,
        professional: s.professional,
      }))
      const { data, error } = await sb.from('slots').upsert(rows, { onConflict: 'unit_id,kind,ref_id,starts_at', ignoreDuplicates: true }).select('id')
      fail(error)
      return data?.length ?? 0
    },

    async deleteSlot(id) {
      fail((await sb.from('slots').delete().eq('id', id)).error)
    },

    async listUsers() {
      const { data, error } = await sb.from('profiles').select('*').order('full_name')
      fail(error)
      const { data: managers } = await sb.from('unit_managers').select('*')
      return (data ?? []).map(
        (r: Row): UserProfile => ({
          id: r.id,
          email: r.email,
          fullName: r.full_name,
          birthDate: null,
          cpf: null,
          cns: null,
          phone: null,
          address: null,
          neighborhood: null,
          role: r.role,
          managedUnitIds: (managers ?? []).filter((m: Row) => m.user_id === r.id).map((m: Row) => m.unit_id),
          prefs: r.prefs,
          createdAt: r.created_at,
        }),
      )
    },

    async setUserRole(userId, role, managedUnitIds) {
      fail((await sb.rpc('admin_set_role', { p_user: userId, p_role: role, p_units: managedUnitIds })).error)
    },
  }
}
