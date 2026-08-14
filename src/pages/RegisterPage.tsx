import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await api.post('/auth/register', form)
      setStatus('success')
      setMessage(response.data.message)
      setTimeout(() => navigate('/login'), 1200)
    } catch (error) {
      setStatus('error')
      setMessage('Registrasi gagal. Pastikan semua data valid dan email belum terdaftar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10 text-slate-800">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[40px] border border-stone-200 bg-white/90 shadow-soft lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden border-r border-stone-200 bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.12),_transparent_36%)] p-10 lg:block">
          <div className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-teal-200 bg-white p-1.5">
            <img src="/genjaka-logo.png" alt="Logo Genjaka" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-8 font-display text-5xl text-slate-900">Registrasi Generus Baru</h1>
          <p className="mt-6 text-sm leading-8 text-slate-600">
            Setelah registrasi, akun akan masuk ke daftar approval Admin. Setelah disetujui, Anda dapat login dan melengkapi biodata.
          </p>
        </div>

        <div className="p-8 md:p-12">
          <p className="text-xs uppercase tracking-[0.35em] text-teal-600">Pendaftaran</p>
          <h2 className="mt-4 font-display text-4xl text-slate-900">Buat Akun Generus</h2>

          <form className="mt-10 space-y-5" onSubmit={submit}>
            <label className="block space-y-2">
              <span className="text-sm text-slate-600">Nama Lengkap</span>
              <input
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-400"
                placeholder="Nama lengkap generus"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-slate-600">Email</span>
              <input
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-400"
                placeholder="email@example.com"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-slate-600">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-teal-400"
                placeholder="Minimal 8 karakter"
              />
            </label>
            {message ? (
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${
                  status === 'success'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {message}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-200 disabled:opacity-70"
            >
              {loading ? 'Mendaftarkan...' : 'Registrasi'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
            <Link to="/" className="hover:text-slate-900">Kembali ke Landing Page</Link>
            <Link to="/login" className="hover:text-teal-600">Sudah punya akun? Login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
