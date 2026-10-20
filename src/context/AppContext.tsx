import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../services'
import type { Exam, HealthUnit, QueueStatus, Specialty, UserProfile } from '../lib/types'
import { DEFAULT_CENTER, NEIGHBORHOODS } from '../data/demo'

export interface UserLocation {
  lat: number
  lng: number
  label: string
  precise: boolean
}

interface AppState {
  user: UserProfile | null
  authReady: boolean
  setUser: (u: UserProfile | null) => void
  units: HealthUnit[]
  specialties: Specialty[]
  exams: Exam[]
  queues: QueueStatus[]
  catalogReady: boolean
  catalogError: string | null
  reloadCatalog: () => Promise<void>
  reloadQueues: () => Promise<void>
  location: UserLocation
  setLocation: (l: UserLocation) => void
  unreadCount: number
  refreshUnread: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

const LOC_KEY = 'mas-location'

function initialLocation(user: UserProfile | null): UserLocation {
  try {
    const raw = localStorage.getItem(LOC_KEY)
    if (raw) return JSON.parse(raw) as UserLocation
  } catch {
    /* ignore */
  }
  const n = user?.neighborhood && NEIGHBORHOODS.find((x) => x.name === user.neighborhood)
  if (n) return { lat: n.lat, lng: n.lng, label: n.name, precise: false }
  return { ...DEFAULT_CENTER, precise: false }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [units, setUnits] = useState<HealthUnit[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [queues, setQueues] = useState<QueueStatus[]>([])
  const [catalogReady, setCatalogReady] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [location, setLocationState] = useState<UserLocation>(() => initialLocation(null))
  const [unreadCount, setUnread] = useState(0)

  const reloadCatalog = useCallback(async () => {
    try {
      setCatalogError(null)
      const [u, s, e, q] = await Promise.all([api.listUnits(), api.listSpecialties(), api.listExams(), api.listQueues()])
      setUnits(u)
      setSpecialties(s)
      setExams(e)
      setQueues(q)
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : 'Não foi possível carregar os dados.')
    } finally {
      setCatalogReady(true)
    }
  }, [])

  const reloadQueues = useCallback(async () => {
    setQueues(await api.listQueues())
  }, [])

  const refreshUnread = useCallback(async () => {
    try {
      const list = await api.listNotifications()
      setUnread(list.filter((n) => !n.read).length)
    } catch {
      setUnread(0)
    }
  }, [])

  useEffect(() => {
    api
      .getCurrentUser()
      .then((u) => {
        setUser(u)
        if (u && !localStorage.getItem(LOC_KEY)) setLocationState(initialLocation(u))
      })
      .finally(() => setAuthReady(true))
    reloadCatalog()
  }, [reloadCatalog])

  useEffect(() => {
    if (user) refreshUnread()
  }, [user, refreshUnread])

  const setLocation = useCallback((l: UserLocation) => {
    setLocationState(l)
    try {
      localStorage.setItem(LOC_KEY, JSON.stringify(l))
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      authReady,
      setUser,
      units,
      specialties,
      exams,
      queues,
      catalogReady,
      catalogError,
      reloadCatalog,
      reloadQueues,
      location,
      setLocation,
      unreadCount,
      refreshUnread,
    }),
    [user, authReady, units, specialties, exams, queues, catalogReady, catalogError, reloadCatalog, reloadQueues, location, setLocation, unreadCount, refreshUnread],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp fora do AppProvider')
  return v
}
