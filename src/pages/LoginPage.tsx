import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const setSession = useAppStore((state) => state.setSession)
  const [form, setForm] = useState({ email: '', password: '' })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await api.post('/auth/login', form)
      setSession({ token: response.data.token, user: response.data.user })
      navigate('/dashboard')
    } catch (error) {
      setMessage('Login gagal. Periksa kembali kredensial Anda atau status approval akun.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10 text-slate-800">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[40px] border border-stone-200 bg-white/90 shadow-soft lg:grid-cols-[0.95fr_1.05fr]">
        <div className="hidden bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.14),_transparent_35%)] p-10 lg:block">
          <div className="max-w-md">
            <div className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-teal-200 bg-white p-1.5">
              <img src="/genjaka-logo.png" alt="Logo Genjaka" className="h-full w-full object-contain" />
            </div>
            <h1 className="mt-8 font-display text-5xl text-slate-900">Masuk ke Portal Genjaka</h1>
            <p className="mt-6 text-sm leading-8 text-slate-600">
              Login akan mengarahkan Anda ke dashboard sesuai role: User, Dewan Guru, Admin, atau SuperAdmin.
            </p>
          </div>
        </div>

        <div className="p-8 md:p-12">
          <p className="text-xs uppercase tracking-[0.35em] text-teal-600">Autentikasi</p>
          <h2 className="mt-4 font-display text-4xl text-slate-900">Login</h2>
          <p className="mt-3 text-sm text-slate-500">Gunakan akun yang sudah disetujui untuk masuk ke sistem.</p>

          <form className="mt-10 space-y-5" onSubmit={submit}>
            <label className="block space-y-2">
              <span className="text-sm text-slate-600">Email</span>
              <input
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-400"
                placeholder="user@genjaka.local"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-slate-600">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-400"
                placeholder="Masukkan password"
              />
            </label>
            {message ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div> : null}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-200 disabled:opacity-70"
            >
              {loading ? 'Memproses...' : 'Masuk'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
            <Link to="/" className="hover:text-slate-900">Kembali ke Landing Page</Link>
            <Link to="/register" className="hover:text-teal-600">Belum punya akun? Registrasi</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
