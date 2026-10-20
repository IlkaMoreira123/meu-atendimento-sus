import { Bell, CalendarDays, Home, LayoutDashboard, MapPinned, User, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { api } from '../services'
import { Logo, Spinner } from './ui'

const NAV = [
  { to: '/inicio', label: 'Início', icon: Home },
  { to: '/unidades', label: 'Unidades', icon: MapPinned },
  { to: '/filas', label: 'Filas', icon: Users },
  { to: '/agendamentos', label: 'Agenda', icon: CalendarDays },
  { to: '/perfil', label: 'Perfil', icon: User },
]

function DemoStrip() {
  if (api.mode !== 'demo') return null
  return (
    <div className="bg-amber-100 px-4 py-1.5 text-center text-sm font-bold text-amber-900">
      Versão de demonstração: unidades, vagas e filas são fictícias.
    </div>
  )
}

export function AppLayout() {
  const { user, authReady, unreadCount } = useApp()
  const loc = useLocation()
  if (!authReady) return <Spinner />
  if (!user) return <Navigate to="/entrar" replace state={{ from: loc.pathname }} />
  const staff = user.role !== 'cidadao'

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      {/* Navegação lateral (computador/tablet) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-linha bg-white p-4 md:flex">
        <Link to="/inicio" className="mb-6 px-2 pt-2 text-lg">
          <Logo size={42} />
        </Link>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-h-12 items-center gap-3 rounded-2xl px-3 font-bold ${isActive ? 'bg-azul-700 text-white' : 'text-tinta hover:bg-azul-50'}`
            }
          >
            <Icon className="size-5" aria-hidden /> {label}
          </NavLink>
        ))}
        <NavLink
          to="/notificacoes"
          className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-2xl px-3 font-bold ${isActive ? 'bg-azul-700 text-white' : 'text-tinta hover:bg-azul-50'}`}
        >
          <Bell className="size-5" aria-hidden /> Notificações
          {unreadCount > 0 && <span className="ml-auto rounded-full bg-verde-500 px-2 text-sm text-white">{unreadCount}</span>}
        </NavLink>
        {staff && (
          <NavLink
            to="/admin"
            className={({ isActive }) => `mt-4 flex min-h-12 items-center gap-3 rounded-2xl px-3 font-bold ${isActive ? 'bg-verde-500 text-white' : 'text-verde-700 hover:bg-verde-100'}`}
          >
            <LayoutDashboard className="size-5" aria-hidden /> Painel da unidade
          </NavLink>
        )}
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <DemoStrip />
        {/* Topo (celular) */}
        <header className="sticky top-0 z-[500] flex items-center justify-between border-b border-linha bg-white/95 px-4 py-2.5 backdrop-blur md:hidden">
          <Link to="/inicio" className="text-[15px]">
            <Logo size={34} />
          </Link>
          <div className="flex items-center gap-1">
            {staff && (
              <Link to="/admin" className="grid size-11 place-items-center rounded-full text-verde-700 hover:bg-verde-100" aria-label="Painel da unidade">
                <LayoutDashboard className="size-6" />
              </Link>
            )}
            <Link to="/notificacoes" className="relative grid size-11 place-items-center rounded-full text-azul-700 hover:bg-azul-100" aria-label={`Notificações${unreadCount ? `, ${unreadCount} não lidas` : ''}`}>
              <Bell className="size-6" />
              {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 size-3 rounded-full bg-verde-500 ring-2 ring-white" />}
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          <Outlet />
        </main>

        {/* Barra inferior (celular) */}
        <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-[500] grid grid-cols-5 border-t border-linha bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[13px] font-bold ${isActive ? 'text-azul-700' : 'text-tinta-suave'}`}
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-8 w-12 place-items-center rounded-full ${isActive ? 'bg-azul-100' : ''}`}>
                    <Icon className="size-6" aria-hidden />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export function RequireStaff({ children }: { children: ReactNode }) {
  const { user } = useApp()
  if (!user || user.role === 'cidadao') {
    return (
      <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-linha">
        <h1 className="text-xl font-bold">Acesso restrito</h1>
        <p className="mt-2 text-tinta-suave">O painel é exclusivo para profissionais autorizados das unidades de saúde.</p>
        <Link to="/inicio" className="mt-4 inline-block font-bold text-azul-700 underline">
          Voltar ao início
        </Link>
      </div>
    )
  }
  return <>{children}</>
}
