import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import Login from './pages/Login'
import Layout from './components/Layout'
import AvailableOrders from './pages/AvailableOrders'
import MyOrders from './pages/MyOrders'
import Earnings from './pages/Earnings'
import GlobalChat from './pages/GlobalChat'
import Teleports from './pages/Teleports'

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
          <Route index element={<Navigate to="/available" replace />} />
          <Route path="available" element={<AvailableOrders />} />
          <Route path="my-orders" element={<MyOrders />} />
          <Route path="earnings" element={<Earnings />} />
          <Route path="global-chat" element={<GlobalChat />} />
          <Route path="teleports" element={<Teleports />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
