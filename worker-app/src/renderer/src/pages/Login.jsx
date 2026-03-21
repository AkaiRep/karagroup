import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api'
import { useAuthStore } from '../store'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('serverUrl') || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    window.electronBridge?.getVersion().then(setAppVersion).catch(() => {})
  }, [])
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(username, password)
      if (data.user.role !== 'worker') {
        setError('Это приложение только для качеров')
        setLoading(false)
        return
      }
      setAuth(data.user, data.access_token)
      navigate('/available')
    } catch (err) {
      const detail = err.response?.data?.detail || 'Ошибка авторизации'
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-brand-500 mb-2">KaraGroup</div>
          <div className="text-slate-400 text-sm">Кабинет качера</div>
          {appVersion && <div className="text-slate-600 text-xs mt-1">v{appVersion}</div>}
        </div>

        <form onSubmit={handleSubmit} className="bg-[#1a1f2e] rounded-2xl p-8 shadow-2xl border border-slate-700/50">
          <div className="mb-5">
            <label className="block text-sm text-slate-400 mb-1.5">Адрес сервера</label>
            <input
              className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-500 transition-colors"
              value={serverUrl}
              onChange={(e) => { setServerUrl(e.target.value); localStorage.setItem('serverUrl', e.target.value) }}
              placeholder="http://localhost:8000"
            />
          </div>
          <div className="mb-5">
            <label className="block text-sm text-slate-400 mb-1.5">Логин</label>
            <input
              className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-500 transition-colors"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm text-slate-400 mb-1.5">Пароль</label>
            <input
              type="password"
              className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-500 transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="mb-4 text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg py-2.5 font-medium transition-colors"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
