import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Products from './pages/Products'
import Workers from './pages/Workers'
import Financial from './pages/Financial'
import GlobalChat from './pages/GlobalChat'
import Media from './pages/Media'
import Settings from './pages/Settings'

function ProtectedRoute({ children }) {
  const { token } = useAuthStore()
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
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
          <Route path="financial" element={<Financial />} />
          <Route path="global-chat" element={<GlobalChat />} />
          <Route path="media" element={<Media />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
