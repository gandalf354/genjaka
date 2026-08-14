import { useState } from 'react'
import { api } from '@/lib/api'
import type { AppUser } from '@/types'

interface ResetPasswordPanelProps {
  user: AppUser
}

export function ResetPasswordPanel({ user }: ResetPasswordPanelProps) {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (form.newPassword !== form.confirmPassword) {
      setMessage('Konfirmasi password baru tidak cocok.')
      return
    }

    setIsSaving(true)
    try {
      const response = await api.put('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      setMessage(response.data.message || 'Password berhasil diperbarui.')
      setForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (error) {
      const nextMessage =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
            (error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error ||
            'Gagal memperbarui password.'
          : 'Gagal memperbarui password.'
      setMessage(nextMessage)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-[24px] border border-stone-200 bg-white/90 p-4">
      <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
        <h3 className="font-display text-2xl text-slate-900">Reset Password</h3>
        <p className="mt-2 text-sm text-slate-500">Perbarui password akun Anda di sini. Gunakan password baru minimal 8 karakter.</p>
        <p className="mt-2 text-[11px] text-slate-500">
          Akun: <span className="font-medium text-slate-700">{user.fullName}</span> ({user.email})
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 rounded-[20px] border border-stone-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Password Saat Ini</span>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-slate-800"
              placeholder="Masukkan password saat ini"
              autoComplete="current-password"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Password Baru</span>
            <input
              type="password"
              value={form.newPassword}
              onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-slate-800"
              placeholder="Masukkan password baru"
              autoComplete="new-password"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Konfirmasi Password Baru</span>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-slate-800"
              placeholder="Konfirmasi password baru"
              autoComplete="new-password"
            />
          </label>
        </div>

        {message ? <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-slate-600">{message}</div> : null}

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-amber-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Password Baru'}
          </button>
        </div>
      </form>
    </div>
  )
}
