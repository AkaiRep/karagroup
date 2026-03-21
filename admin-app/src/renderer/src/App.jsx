import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store'
import { applyBrandColor } from './utils/brandColor'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Products from './pages/Products'
import Workers from './pages/Workers'
import Monitoring from './pages/Monitoring'
import Financial from './pages/Financial'
import GlobalChat from './pages/GlobalChat'
import Media from './pages/Media'
import Settings from './pages/Settings'
import Health from './pages/Health'
import FAQ from './pages/FAQ'
import Blog from './pages/Blog'
import Payments from './pages/Payments'
import BotSettings from './pages/BotSettings'

function ProtectedRoute({ children }) {
  const { token } = useAuthStore()
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  useEffect(() => {
    const saved = localStorage.getItem('adminAccentColor')
    if (saved) applyBrandColor(saved)
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="products" element={<Products />} />
          <Route path="workers" element={<Workers />} />
          <Route path="monitoring" element={<Monitoring />} />
          <Route path="financial" element={<Financial />} />
          <Route path="global-chat" element={<GlobalChat />} />
          <Route path="media" element={<Media />} />
          <Route path="settings" element={<Settings />} />
          <Route path="health" element={<Health />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="blog" element={<Blog />} />
          <Route path="payments" element={<Payments />} />
          <Route path="bot" element={<BotSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
