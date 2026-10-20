import { createDemoService } from './demoService'
import { createSupabaseService } from './supabaseService'
import type { DataService } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Supabase quando configurado; caso contrário, modo demonstração no navegador. */
export const api: DataService = url && key ? createSupabaseService(url, key) : createDemoService()

export * from './types'
