/**
 * DADOS DE DEMONSTRAÇÃO
 * ---------------------------------------------------------------
 * Tudo neste arquivo é fictício: nomes de unidades, endereços,
 * telefones, horários, vagas e filas. Serve apenas para testar o
 * aplicativo enquanto não há integração com os sistemas oficiais.
 * Nenhum desses dados representa uma unidade de saúde real.
 */
import type { Exam, HealthUnit, Notice, QueueStatus, Slot, Specialty } from '../lib/types'

export const SPECIALTIES: Specialty[] = [
  { id: 'clinica-geral', name: 'Clínica geral', requiresReferral: false },
  { id: 'pediatria', name: 'Pediatria', requiresReferral: false },
  { id: 'ginecologia', name: 'Ginecologia', requiresReferral: false },
  { id: 'odontologia', name: 'Odontologia', requiresReferral: false },
  { id: 'cardiologia', name: 'Cardiologia', requiresReferral: true },
  { id: 'dermatologia', name: 'Dermatologia', requiresReferral: true },
  { id: 'ortopedia', name: 'Ortopedia', requiresReferral: true },
  { id: 'oftalmologia', name: 'Oftalmologia', requiresReferral: true },
]

const PREPARO_DEMO = 'Texto de demonstração. Substitua pela orientação oficial fornecida pela unidade.'

export const EXAMS: Exam[] = [
  {
    id: 'hemograma',
    name: 'Hemograma completo',
    category: 'laboratorial',
    requiresReferral: false,
    preparation: 'Exemplo de preparo: jejum conforme orientação do pedido médico. Leve documento com foto e o pedido.',
    preparationSource: PREPARO_DEMO,
  },
  {
    id: 'glicemia',
    name: 'Glicemia em jejum',
    category: 'laboratorial',
    requiresReferral: false,
    preparation: 'Exemplo de preparo: jejum indicado no pedido. Não interrompa medicamentos sem orientação.',
    preparationSource: PREPARO_DEMO,
  },
  {
    id: 'urina',
    name: 'Exame de urina (EAS)',
    category: 'laboratorial',
    requiresReferral: false,
    preparation: 'Exemplo de preparo: siga as instruções de coleta entregues pela unidade.',
    preparationSource: PREPARO_DEMO,
  },
  {
    id: 'raio-x-torax',
    name: 'Raio-X de tórax',
    category: 'imagem',
    requiresReferral: true,
    preparation: null,
    preparationSource: null,
  },
  {
    id: 'ultrassom-abdome',
    name: 'Ultrassonografia de abdome',
    category: 'imagem',
    requiresReferral: true,
    preparation: 'Exemplo de preparo: a unidade informará jejum e ingestão de água ao confirmar o exame.',
    preparationSource: PREPARO_DEMO,
  },
  {
    id: 'mamografia',
    name: 'Mamografia',
    category: 'imagem',
    requiresReferral: true,
    preparation: null,
    preparationSource: null,
  },
  {
    id: 'eletrocardiograma',
    name: 'Eletrocardiograma',
    category: 'outros',
    requiresReferral: true,
    preparation: null,
    preparationSource: null,
  },
]

const hUBS = {
  label: 'Seg a sex, 7h às 19h',
  open24h: false,
  weekdays: { open: '07:00', close: '19:00' },
  saturday: null,
}
const hAMA = {
  label: 'Seg a sex, 7h às 19h · Sáb, 7h às 13h',
  open24h: false,
  weekdays: { open: '07:00', close: '19:00' },
  saturday: { open: '07:00', close: '13:00' },
}
const h24 = { label: 'Aberta 24 horas', open24h: true, weekdays: null, saturday: null }

export const UNITS: HealthUnit[] = [
  {
    id: 'ubs-acacias',
    name: 'UBS Parque das Acácias',
    type: 'UBS',
    address: 'Rua das Acácias, 120',
    neighborhood: 'Parque das Acácias',
    city: 'São Paulo - SP',
    cep: '00000-001',
    lat: -23.5489,
    lng: -46.6388,
    phone: '(11) 0000-0101',
    hours: hUBS,
    services: ['Consultas', 'Vacinação', 'Curativos', 'Farmácia básica', 'Coleta de exames'],
    specialtyIds: ['clinica-geral', 'pediatria', 'ginecologia', 'odontologia'],
    examIds: ['hemograma', 'glicemia', 'urina'],
    accessibility: ['Rampa de acesso', 'Banheiro adaptado', 'Atendimento prioritário'],
    isDemo: true,
  },
  {
    id: 'ubs-jardim-aurora',
    name: 'UBS Jardim Aurora',
    type: 'UBS',
    address: 'Avenida Aurora, 845',
    neighborhood: 'Jardim Aurora',
    city: 'São Paulo - SP',
    cep: '00000-002',
    lat: -23.5622,
    lng: -46.6551,
    phone: '(11) 0000-0102',
    hours: hUBS,
    services: ['Consultas', 'Vacinação', 'Saúde da mulher', 'Coleta de exames'],
    specialtyIds: ['clinica-geral', 'pediatria', 'ginecologia'],
    examIds: ['hemograma', 'urina'],
    accessibility: ['Rampa de acesso', 'Piso tátil'],
    isDemo: true,
  },
  {
    id: 'upa-horizonte',
    name: 'UPA Horizonte',
    type: 'UPA',
    address: 'Rua Horizonte Azul, 50',
    neighborhood: 'Vila Horizonte',
    city: 'São Paulo - SP',
    cep: '00000-003',
    lat: -23.5398,
    lng: -46.6215,
    phone: '(11) 0000-0103',
    hours: h24,
    services: ['Urgência e emergência', 'Pronto atendimento adulto', 'Pronto atendimento infantil', 'Raio-X'],
    specialtyIds: [],
    examIds: [],
    accessibility: ['Rampa de acesso', 'Banheiro adaptado', 'Cadeira de rodas disponível'],
    isDemo: true,
  },
  {
    id: 'hospital-boa-vista',
    name: 'Hospital Municipal Boa Vista',
    type: 'HOSPITAL',
    address: 'Avenida Boa Vista, 2000',
    neighborhood: 'Boa Vista',
    city: 'São Paulo - SP',
    cep: '00000-004',
    lat: -23.5735,
    lng: -46.6302,
    phone: '(11) 0000-0104',
    hours: h24,
    services: ['Pronto-socorro', 'Internação', 'Cirurgias', 'Exames de imagem', 'Ambulatório de especialidades'],
    specialtyIds: ['cardiologia', 'ortopedia', 'oftalmologia'],
    examIds: ['raio-x-torax', 'ultrassom-abdome', 'mamografia', 'eletrocardiograma'],
    accessibility: ['Rampa de acesso', 'Elevador', 'Banheiro adaptado', 'Intérprete de Libras sob agendamento'],
    isDemo: true,
  },
  {
    id: 'ame-ipes',
    name: 'Ambulatório de Especialidades Ipês',
    type: 'CLINICA',
    address: 'Rua dos Ipês, 333',
    neighborhood: 'Jardim dos Ipês',
    city: 'São Paulo - SP',
    cep: '00000-005',
    lat: -23.5551,
    lng: -46.6149,
    phone: '(11) 0000-0105',
    hours: hAMA,
    services: ['Consultas com especialistas', 'Pequenos procedimentos', 'Eletrocardiograma'],
    specialtyIds: ['cardiologia', 'dermatologia', 'ortopedia', 'oftalmologia'],
    examIds: ['eletrocardiograma', 'ultrassom-abdome'],
    accessibility: ['Rampa de acesso', 'Elevador', 'Atendimento prioritário'],
    isDemo: true,
  },
  {
    id: 'lab-central',
    name: 'Laboratório Municipal Central',
    type: 'LABORATORIO',
    address: 'Praça Central, 15',
    neighborhood: 'Centro Novo',
    city: 'São Paulo - SP',
    cep: '00000-006',
    lat: -23.5452,
    lng: -46.6471,
    phone: null,
    hours: { label: 'Seg a sáb, 6h às 12h', open24h: false, weekdays: { open: '06:00', close: '12:00' }, saturday: { open: '06:00', close: '12:00' } },
    services: ['Coleta de sangue', 'Coleta de urina', 'Entrega de resultados'],
    specialtyIds: [],
    examIds: ['hemograma', 'glicemia', 'urina'],
    accessibility: ['Rampa de acesso', 'Atendimento prioritário'],
    isDemo: true,
  },
  {
    id: 'ubs-rio-claro',
    name: 'UBS Vila Rio Claro',
    type: 'UBS',
    address: 'Rua Rio Claro, 77',
    neighborhood: 'Vila Rio Claro',
    city: 'São Paulo - SP',
    cep: '00000-007',
    lat: -23.5302,
    lng: -46.6452,
    phone: '(11) 0000-0107',
    hours: hUBS,
    services: ['Consultas', 'Vacinação', 'Saúde bucal'],
    specialtyIds: ['clinica-geral', 'odontologia', 'pediatria'],
    examIds: [],
    accessibility: ['Atendimento prioritário'],
    isDemo: true,
  },
  {
    id: 'upa-serra',
    name: 'UPA Serra Verde',
    type: 'UPA',
    address: 'Estrada da Serra, 1500',
    neighborhood: 'Serra Verde',
    city: 'São Paulo - SP',
    cep: '00000-008',
    lat: -23.5815,
    lng: -46.6612,
    phone: '(11) 0000-0108',
    hours: h24,
    services: ['Urgência e emergência', 'Pronto atendimento adulto', 'Medicação'],
    specialtyIds: [],
    examIds: [],
    accessibility: ['Rampa de acesso', 'Banheiro adaptado'],
    isDemo: true,
  },
]

/** Bairros de demonstração para busca manual por endereço/bairro. */
export const NEIGHBORHOODS: { name: string; lat: number; lng: number }[] = [
  ...UNITS.map((u) => ({ name: u.neighborhood, lat: u.lat + 0.004, lng: u.lng - 0.003 })),
  { name: 'Centro', lat: -23.5505, lng: -46.6333 },
]

export const DEFAULT_CENTER = { lat: -23.5505, lng: -46.6333, label: 'Centro (posição padrão)' }

export const NOTICES: Notice[] = [
  {
    id: 'aviso-demo',
    title: 'Você está usando a versão de demonstração',
    body: 'Unidades, vagas e filas são fictícias. Nenhum agendamento feito aqui vale para atendimento real.',
    tone: 'alerta',
  },
  {
    id: 'aviso-vacina',
    title: 'Campanha de vacinação (exemplo)',
    body: 'Exemplo de aviso de unidade: confira o calendário de vacinação na sua UBS.',
    tone: 'info',
  },
]

/** Gera vagas fictícias para os próximos 14 dias úteis. */
export function generateDemoSlots(now = new Date()): Slot[] {
  const slots: Slot[] = []
  const professionals = ['Dra. Ana (demo)', 'Dr. Bruno (demo)', 'Dra. Carla (demo)', 'Dr. Diego (demo)']
  let seed = 7
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (const unit of UNITS) {
    const items: { kind: 'consulta' | 'exame'; refId: string }[] = [
      ...unit.specialtyIds.map((refId) => ({ kind: 'consulta' as const, refId })),
      ...unit.examIds.map((refId) => ({ kind: 'exame' as const, refId })),
    ]
    for (const item of items) {
      for (let d = 1; d <= 18; d++) {
        const day = new Date(now)
        day.setDate(day.getDate() + d)
        const dow = day.getDay()
        if (dow === 0 || dow === 6) continue
        if (rand() < 0.35) continue // dias sem agenda
        const hours = item.kind === 'exame' ? [7, 8, 9, 10] : [8, 9, 10, 11, 14, 15, 16]
        for (const h of hours) {
          for (const m of [0, 30]) {
            if (rand() < 0.55) continue
            const s = new Date(day)
            s.setHours(h, m, 0, 0)
            slots.push({
              id: `${unit.id}:${item.refId}:${s.toISOString()}`,
              unitId: unit.id,
              kind: item.kind,
              refId: item.refId,
              startsAt: s.toISOString(),
              durationMin: 30,
              professional: item.kind === 'consulta' ? professionals[Math.floor(rand() * professionals.length)] : null,
              booked: rand() < 0.15,
            })
          }
        }
      }
    }
  }
  return slots
}

/** Filas fictícias. Algumas unidades ficam sem dado ou com dado antigo, de propósito. */
export function generateDemoQueues(now = new Date()): QueueStatus[] {
  const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString()
  return [
    { unitId: 'ubs-acacias', level: 'baixo', peopleWaiting: 6, waitMinutes: 20, serviceType: 'Acolhimento e consultas', unitSituation: 'aberta', source: 'demonstracao', updatedAt: ago(12), updatedBy: 'Dados de demonstração' },
    { unitId: 'ubs-jardim-aurora', level: 'moderado', peopleWaiting: 14, waitMinutes: 45, serviceType: 'Acolhimento e consultas', unitSituation: 'aberta', source: 'demonstracao', updatedAt: ago(25), updatedBy: 'Dados de demonstração' },
    { unitId: 'upa-horizonte', level: 'alto', peopleWaiting: 38, waitMinutes: 150, serviceType: 'Pronto atendimento (classificação de risco)', unitSituation: 'aberta', source: 'demonstracao', updatedAt: ago(8), updatedBy: 'Dados de demonstração' },
    { unitId: 'hospital-boa-vista', level: 'moderado', peopleWaiting: 22, waitMinutes: 90, serviceType: 'Pronto-socorro', unitSituation: 'aberta', source: 'demonstracao', updatedAt: ago(40), updatedBy: 'Dados de demonstração' },
    { unitId: 'ame-ipes', level: 'baixo', peopleWaiting: null, waitMinutes: null, serviceType: 'Consultas agendadas', unitSituation: 'aberta', source: 'demonstracao', updatedAt: ago(200), updatedBy: 'Dados de demonstração' },
    { unitId: 'lab-central', level: 'indisponivel', peopleWaiting: null, waitMinutes: null, serviceType: 'Coleta', unitSituation: 'aberta', source: 'indisponivel', updatedAt: null, updatedBy: null },
    { unitId: 'ubs-rio-claro', level: 'baixo', peopleWaiting: 3, waitMinutes: 10, serviceType: 'Acolhimento e consultas', unitSituation: 'atendimento_restrito', source: 'demonstracao', updatedAt: ago(18), updatedBy: 'Dados de demonstração' },
    { unitId: 'upa-serra', level: 'alto', peopleWaiting: 31, waitMinutes: 120, serviceType: 'Pronto atendimento (classificação de risco)', unitSituation: 'aberta', source: 'demonstracao', updatedAt: ago(15), updatedBy: 'Dados de demonstração' },
  ]
}
