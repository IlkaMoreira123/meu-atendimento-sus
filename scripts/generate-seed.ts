/**
 * Gera supabase/seed.sql a partir dos dados de demonstração (src/data/demo.ts).
 * Uso: npx tsx scripts/generate-seed.ts
 */
import { writeFileSync } from 'node:fs'
import { EXAMS, NOTICES, SPECIALTIES, UNITS, generateDemoQueues } from '../src/data/demo'

const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return `array[${v.map(q).join(', ')}]::text[]`
  if (typeof v === 'object') return `${q(JSON.stringify(v))}::jsonb`
  return `'${String(v).replace(/'/g, "''")}'`
}

const lines: string[] = [
  '-- DADOS DE DEMONSTRAÇÃO (fictícios). Gerado por scripts/generate-seed.ts.',
  '-- Não representam unidades reais. Remova antes de entrar em produção.',
  '',
]
for (const s of SPECIALTIES) lines.push(`insert into specialties (id, name, requires_referral) values (${q(s.id)}, ${q(s.name)}, ${q(s.requiresReferral)}) on conflict (id) do nothing;`)
for (const e of EXAMS)
  lines.push(
    `insert into exams (id, name, category, requires_referral, preparation, preparation_source) values (${[e.id, e.name, e.category, e.requiresReferral, e.preparation, e.preparationSource].map(q).join(', ')}) on conflict (id) do nothing;`,
  )
for (const u of UNITS)
  lines.push(
    `insert into units (id, name, type, address, neighborhood, city, cep, lat, lng, phone, hours, services, specialty_ids, exam_ids, accessibility, is_demo) values (${[u.id, u.name, u.type, u.address, u.neighborhood, u.city, u.cep, u.lat, u.lng, u.phone, u.hours, u.services, u.specialtyIds, u.examIds, u.accessibility, true].map(q).join(', ')}) on conflict (id) do nothing;`,
  )
for (const s of generateDemoQueues(new Date('2026-01-01T12:00:00Z')))
  lines.push(
    `insert into queue_status (unit_id, level, people_waiting, wait_minutes, service_type, unit_situation, source, updated_at, updated_by) values (${[s.unitId, s.level, s.peopleWaiting, s.waitMinutes, s.serviceType, s.unitSituation, s.source].map(q).join(', ')}, ${s.updatedAt ? 'now()' : 'null'}, ${q(s.updatedBy)}) on conflict (unit_id) do nothing;`,
  )
for (const n of NOTICES) lines.push(`insert into notices (id, title, body, tone) values (${[n.id, n.title, n.body, n.tone].map(q).join(', ')}) on conflict (id) do nothing;`)

lines.push(
  '',
  '-- Vagas de demonstração: próximos 20 dias úteis, manhã e tarde.',
  `insert into slots (unit_id, kind, ref_id, starts_at, duration_min)
select u.id, x.kind, x.ref_id,
       (d::date + t)::timestamp at time zone 'America/Sao_Paulo', 30
from units u
cross join lateral (
  select 'consulta' as kind, unnest(u.specialty_ids) as ref_id
  union all select 'exame', unnest(u.exam_ids)
) x
cross join generate_series(current_date + 1, current_date + 28, interval '1 day') d
cross join unnest(array['08:00','09:00','10:00','14:00','15:00']::time[]) t
where extract(isodow from d) < 6 and u.is_demo
on conflict do nothing;`,
)
writeFileSync('supabase/seed.sql', lines.join('\n') + '\n')
console.log('supabase/seed.sql gerado')
