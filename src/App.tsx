import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout, RequireStaff } from './components/Layout'
import { AppProvider } from './context/AppContext'
import { AdminPage } from './pages/Admin'
import { HistoryPage, MyAppointmentsPage } from './pages/Appointments'
import { LoginPage, ResetPasswordPage, SignUpPage, SplashPage } from './pages/Auth'
import { BookingWizard, ConfirmationPage, ExamDetailPage, ExamsPage } from './pages/Booking'
import { HomePage } from './pages/Home'
import { NotificationsPage, ProfilePage } from './pages/Profile'
import { QueuesPage } from './pages/Queues'
import { UnitDetailPage, UnitsListPage, UnitsMapPage } from './pages/Units'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SplashPage />} />
          <Route path="/entrar" element={<LoginPage />} />
          <Route path="/cadastro" element={<SignUpPage />} />
          <Route path="/recuperar-senha" element={<ResetPasswordPage />} />
          <Route element={<AppLayout />}>
            <Route path="/inicio" element={<HomePage />} />
            <Route path="/unidades" element={<UnitsListPage />} />
            <Route path="/mapa" element={<UnitsMapPage />} />
            <Route path="/unidades/:id" element={<UnitDetailPage />} />
            <Route path="/filas" element={<QueuesPage />} />
            <Route path="/consultas/agendar" element={<BookingWizard kind="consulta" />} />
            <Route path="/exames" element={<ExamsPage />} />
            <Route path="/exames/:id" element={<ExamDetailPage />} />
            <Route path="/exames/:id/agendar" element={<BookingWizard kind="exame" />} />
            <Route path="/confirmacao/:id" element={<ConfirmationPage />} />
            <Route path="/agendamentos" element={<MyAppointmentsPage />} />
            <Route path="/historico" element={<HistoryPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/notificacoes" element={<NotificationsPage />} />
            <Route
              path="/admin"
              element={
                <RequireStaff>
                  <AdminPage />
                </RequireStaff>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
