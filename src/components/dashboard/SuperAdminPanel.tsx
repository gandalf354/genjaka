import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import axios from 'axios'
import { api } from '@/lib/api'
import type { AppUser } from '@/types'

interface SuperAdminPanelProps {
  admins: AppUser[]
  refresh: () => Promise<void>
}

export function SuperAdminPanel({ admins, refresh }: SuperAdminPanelProps) {
  const itemsPerPage = 10
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')
  const [adminError, setAdminError] = useState('')
  const [processingAction, setProcessingAction] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [editingAdmin, setEditingAdmin] = useState<AppUser | null>(null)
  const [editForm, setEditForm] = useState({ fullName: '', email: '', isActive: true })
  const [deleteAdmin, setDeleteAdmin] = useState<AppUser | null>(null)

  const filteredAdmins = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return admins

    return admins.filter((admin) => admin.fullName.toLowerCase().includes(keyword) || admin.email.toLowerCase().includes(keyword))
  }, [admins, search])

  const totalPages = Math.max(1, Math.ceil(filteredAdmins.length / itemsPerPage))
  const paginatedAdmins = useMemo(() => filteredAdmins.slice((page - 1) * itemsPerPage, page * itemsPerPage), [filteredAdmins, page])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setForm({ fullName: '', email: '', password: '' })
    setAdminError('')
  }

  const openEditModal = (admin: AppUser) => {
    setEditingAdmin(admin)
    setEditForm({
      fullName: admin.fullName,
      email: admin.email,
      isActive: admin.isActive,
    })
    setAdminError('')
  }

  const closeEditModal = () => {
    setEditingAdmin(null)
    setEditForm({ fullName: '', email: '', isActive: true })
    setAdminError('')
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setProcessingAction(true)
    setAdminError('')

    try {
      await api.post('/superadmin/admins', {
        fullName: form.fullName,
        email: form.email,
        password: form.password || undefined,
      })
      setMessage('Admin baru berhasil ditambahkan.')
      closeCreateModal()
      await refresh()
    } catch (error) {
      setAdminError(axios.isAxiosError(error) ? error.response?.data?.message || 'Admin belum bisa ditambahkan.' : 'Admin belum bisa ditambahkan.')
    } finally {
      setProcessingAction(false)
    }
  }

  const saveAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingAdmin) return

    setProcessingAction(true)
    setAdminError('')

    try {
      await api.put(`/superadmin/admins/${editingAdmin.id}`, editForm)
      setMessage('Data admin berhasil diperbarui.')
      closeEditModal()
      await refresh()
    } catch (error) {
      setAdminError(axios.isAxiosError(error) ? error.response?.data?.message || 'Data admin belum bisa diperbarui.' : 'Data admin belum bisa diperbarui.')
    } finally {
      setProcessingAction(false)
    }
  }

  const confirmDeleteAdmin = async () => {
    if (!deleteAdmin) return

    setProcessingAction(true)
    setAdminError('')

    try {
      await api.delete(`/superadmin/admins/${deleteAdmin.id}`)
      setMessage('Admin berhasil dinonaktifkan.')
      setDeleteAdmin(null)
      await refresh()
    } catch (error) {
      setAdminError(axios.isAxiosError(error) ? error.response?.data?.message || 'Admin belum bisa dinonaktifkan.' : 'Admin belum bisa dinonaktifkan.')
    } finally {
      setProcessingAction(false)
    }
  }

  const renderPagination = (currentPage: number, pageCount: number, onChange: (pageNumber: number) => void) => {
    if (pageCount <= 1) return null

    return (
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-xs">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-slate-600 disabled:opacity-40"
        >
          Sebelumnya
        </button>
        <span className="text-slate-500">
          Halaman {currentPage} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(pageCount, currentPage + 1))}
          disabled={currentPage === pageCount}
          className="rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-slate-600 disabled:opacity-40"
        >
          Berikutnya
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4">
      {message ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">{message}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl text-slate-900">Kelola Admin</h3>
          <p className="mt-1.5 text-xs leading-6 text-slate-500">Kelola akun admin dengan tampilan tabel compact dan pola CRUD yang konsisten.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreateModal(true)
            setAdminError('')
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-300 px-3.5 py-2 text-sm font-semibold text-slate-950"
        >
          <Plus className="h-4 w-4" />
          Tambah Admin
        </button>
      </div>

      <input
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          setPage(1)
        }}
        className="mt-4 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-800"
        placeholder="Cari nama atau email admin"
      />

      <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-stone-50 text-[11px] text-slate-500">
            <tr>
              <th className="px-2 py-1.5">No</th>
              <th className="px-2 py-1.5">Nama Admin</th>
              <th className="px-2 py-1.5">Email</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredAdmins.length === 0 ? (
              <tr className="border-t border-stone-200">
                <td colSpan={5} className="px-2 py-2.5 text-center text-[11px] text-slate-500">
                  {admins.length === 0 ? 'Belum ada data admin.' : 'Data admin tidak ditemukan.'}
                </td>
              </tr>
            ) : null}
            {paginatedAdmins.map((admin, index) => (
              <tr key={admin.id} className="border-t border-stone-200">
                <td className="px-2 py-1.5 text-slate-700">{(page - 1) * itemsPerPage + index + 1}</td>
                <td className="px-2 py-1.5 text-slate-900">{admin.fullName}</td>
                <td className="px-2 py-1.5 text-slate-500">{admin.email}</td>
                <td className="px-2 py-1.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      admin.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-slate-600'
                    }`}
                  >
                    {admin.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(admin)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                      aria-label={`Edit admin ${admin.fullName}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteAdmin(admin)
                        setAdminError('')
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                      aria-label={`Nonaktifkan admin ${admin.fullName}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {renderPagination(page, totalPages, setPage)}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={submit} className="w-full max-w-2xl rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900">Tambah Admin</h3>
                <p className="mt-2 text-sm text-slate-500">Isi nama admin, email, dan password bila ingin mengganti default password.</p>
              </div>
              <button type="button" onClick={closeCreateModal} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Nama admin"
              />
              <input
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Email admin"
              />
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                placeholder="Password admin (opsional, default: admin12345)"
              />
              {adminError ? <p className="text-[11px] text-rose-600 md:col-span-2">{adminError}</p> : null}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeCreateModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tutup
              </button>
              <button
                type="submit"
                disabled={processingAction}
                className="rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {processingAction ? 'Menyimpan...' : 'Simpan Admin'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingAdmin ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={saveAdmin} className="w-full max-w-2xl rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900">Edit Admin</h3>
                <p className="mt-2 text-sm text-slate-500">Perbarui nama, email, dan status admin.</p>
              </div>
              <button type="button" onClick={closeEditModal} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                value={editForm.fullName}
                onChange={(event) => setEditForm((current) => ({ ...current, fullName: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Nama admin"
              />
              <input
                value={editForm.email}
                onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Email admin"
              />
              <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(event) => setEditForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="h-4 w-4 rounded border-stone-300 text-teal-500"
                />
                Admin aktif
              </label>
              {adminError ? <p className="text-[11px] text-rose-600 md:col-span-2">{adminError}</p> : null}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeEditModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tutup
              </button>
              <button
                type="submit"
                disabled={processingAction}
                className="rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {processingAction ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteAdmin ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-md rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <h3 className="font-display text-2xl text-slate-900">Nonaktifkan Admin</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Apakah admin <span className="font-semibold text-slate-900">{deleteAdmin.fullName}</span> akan dinonaktifkan?
            </p>
            {adminError ? <p className="mt-3 text-[11px] text-rose-600">{adminError}</p> : null}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteAdmin(null)
                  setAdminError('')
                }}
                className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700"
              >
                Tidak
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteAdmin()}
                disabled={processingAction}
                className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {processingAction ? 'Memproses...' : 'Ya'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
