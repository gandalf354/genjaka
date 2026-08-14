import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import axios from 'axios'
import { api } from '@/lib/api'
import type { OwnerBiography, OwnerWorkHistory } from '@/types'

export function OwnerBiographyPanel() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [processingAction, setProcessingAction] = useState(false)

  const [biography, setBiography] = useState<OwnerBiography | null>(null)
  const [biographyForm, setBiographyForm] = useState({
    fullName: '',
    birthPlace: '',
    birthDate: '',
    address: '',
    phoneNumber: '',
    visibleToAdmin: true,
  })

  const [histories, setHistories] = useState<OwnerWorkHistory[]>([])
  const [createHistoryForm, setCreateHistoryForm] = useState({ periodYear: '', positionTitle: '', jobTitle: '' })
  const [editingHistory, setEditingHistory] = useState<OwnerWorkHistory | null>(null)
  const [editHistoryForm, setEditHistoryForm] = useState({ periodYear: '', positionTitle: '', jobTitle: '' })

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.get('/superadmin/owner-biography')
      const loadedBiography = response.data.biography as OwnerBiography
      const loadedHistories = (response.data.histories || []) as OwnerWorkHistory[]
      setBiography(loadedBiography)
      setBiographyForm({
        fullName: loadedBiography.fullName || '',
        birthPlace: loadedBiography.birthPlace || '',
        birthDate: loadedBiography.birthDate || '',
        address: loadedBiography.address || '',
        phoneNumber: loadedBiography.phoneNumber || '',
        visibleToAdmin: loadedBiography.visibleToAdmin ?? true,
      })
      setHistories(loadedHistories)
    } catch (fetchError) {
      setError(
        axios.isAxiosError(fetchError)
          ? fetchError.response?.data?.message || 'Data biografi owner belum bisa dimuat.'
          : 'Data biografi owner belum bisa dimuat.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const sortedHistories = useMemo(() => {
    const getPeriodYearStart = (value: string) => {
      const matches = String(value || '').match(/\b(19|20)\d{2}\b/g)
      if (!matches || matches.length === 0) return null
      const numeric = Number(matches[0])
      return Number.isFinite(numeric) ? numeric : null
    }

    return [...histories].sort((a, b) => {
      const leftYear = getPeriodYearStart(a.periodYear)
      const rightYear = getPeriodYearStart(b.periodYear)
      if (leftYear !== null && rightYear !== null && leftYear !== rightYear) return rightYear - leftYear
      if (leftYear !== null && rightYear === null) return -1
      if (leftYear === null && rightYear !== null) return 1
      const periodCompare = String(b.periodYear || '').localeCompare(String(a.periodYear || ''), 'id-ID')
      if (periodCompare !== 0) return periodCompare
      return a.id - b.id
    })
  }, [histories])

  const saveBiography = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setProcessingAction(true)
    setError('')
    setMessage('')

    try {
      const response = await api.put('/superadmin/owner-biography', biographyForm)
      setBiography(response.data.biography as OwnerBiography)
      setMessage('Biografi Owner berhasil disimpan.')
    } catch (submitError) {
      setError(
        axios.isAxiosError(submitError)
          ? submitError.response?.data?.message || 'Biografi Owner belum bisa disimpan.'
          : 'Biografi Owner belum bisa disimpan.',
      )
    } finally {
      setProcessingAction(false)
    }
  }

  const uploadPhoto = async (file: File) => {
    setProcessingAction(true)
    setError('')
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('photo', file)
      const response = await api.post('/superadmin/owner-biography/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setBiography(response.data.biography as OwnerBiography)
      setMessage('Foto owner berhasil diunggah.')
    } catch (submitError) {
      setError(
        axios.isAxiosError(submitError)
          ? submitError.response?.data?.message || 'Foto owner belum bisa diunggah.'
          : 'Foto owner belum bisa diunggah.',
      )
    } finally {
      setProcessingAction(false)
    }
  }

  const createHistory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setProcessingAction(true)
    setError('')
    setMessage('')

    try {
      await api.post('/superadmin/owner-work-histories', createHistoryForm)
      setCreateHistoryForm({ periodYear: '', positionTitle: '', jobTitle: '' })
      setMessage('History Pekerjaan berhasil ditambahkan.')
      await loadData()
    } catch (submitError) {
      setError(
        axios.isAxiosError(submitError)
          ? submitError.response?.data?.message || 'History Pekerjaan belum bisa ditambahkan.'
          : 'History Pekerjaan belum bisa ditambahkan.',
      )
    } finally {
      setProcessingAction(false)
    }
  }

  const openEditHistory = (history: OwnerWorkHistory) => {
    setEditingHistory(history)
    setEditHistoryForm({
      periodYear: history.periodYear,
      positionTitle: history.positionTitle,
      jobTitle: history.jobTitle,
    })
    setError('')
  }

  const closeEditHistory = () => {
    setEditingHistory(null)
    setEditHistoryForm({ periodYear: '', positionTitle: '', jobTitle: '' })
    setError('')
  }

  const saveHistory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingHistory) return

    setProcessingAction(true)
    setError('')
    setMessage('')

    try {
      await api.put(`/superadmin/owner-work-histories/${editingHistory.id}`, editHistoryForm)
      setMessage('History Pekerjaan berhasil diperbarui.')
      closeEditHistory()
      await loadData()
    } catch (submitError) {
      setError(
        axios.isAxiosError(submitError)
          ? submitError.response?.data?.message || 'History Pekerjaan belum bisa diperbarui.'
          : 'History Pekerjaan belum bisa diperbarui.',
      )
    } finally {
      setProcessingAction(false)
    }
  }

  const removeHistory = async (history: OwnerWorkHistory) => {
    setProcessingAction(true)
    setError('')
    setMessage('')

    try {
      await api.delete(`/superadmin/owner-work-histories/${history.id}`)
      setMessage('History Pekerjaan berhasil dihapus.')
      await loadData()
    } catch (submitError) {
      setError(
        axios.isAxiosError(submitError)
          ? submitError.response?.data?.message || 'History Pekerjaan belum bisa dihapus.'
          : 'History Pekerjaan belum bisa dihapus.',
      )
    } finally {
      setProcessingAction(false)
    }
  }

  if (loading) {
    return <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4 text-sm text-slate-600">Memuat biografi owner...</div>
  }

  return (
    <div className="space-y-4">
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</div> : null}

      <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4">
        <div>
          <h3 className="font-display text-xl text-slate-900">Biografi Owner</h3>
          <p className="mt-1.5 text-xs leading-6 text-slate-500">Data biografi hanya disimpan 1 entri untuk profil owner portal publik.</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="h-16 w-16 overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
            {biography?.photoUrl ? (
              <img src={biography.photoUrl} alt="Foto owner" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-400">Foto</div>
            )}
          </div>
          <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-stone-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:text-teal-700">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                void uploadPhoto(file)
              }}
              disabled={processingAction}
            />
            Upload Foto
          </label>
          <div className="text-[11px] text-slate-500">PNG/JPG, otomatis tersimpan.</div>
        </div>

        <form onSubmit={saveBiography} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs text-slate-600">
              <span>Nama Lengkap</span>
              <input
                value={biographyForm.fullName}
                onChange={(event) => setBiographyForm((prev) => ({ ...prev, fullName: event.target.value }))}
                className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-slate-800"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <span>No. Telp</span>
              <input
                value={biographyForm.phoneNumber}
                onChange={(event) => setBiographyForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-slate-800"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <span>Tempat</span>
              <input
                value={biographyForm.birthPlace}
                onChange={(event) => setBiographyForm((prev) => ({ ...prev, birthPlace: event.target.value }))}
                className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-slate-800"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <span>Tanggal Lahir</span>
              <input
                type="date"
                value={biographyForm.birthDate}
                onChange={(event) => setBiographyForm((prev) => ({ ...prev, birthDate: event.target.value }))}
                className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-slate-800"
              />
            </label>
          </div>

          <label className="space-y-1 text-xs text-slate-600">
            <span>Alamat</span>
            <textarea
              value={biographyForm.address}
              onChange={(event) => setBiographyForm((prev) => ({ ...prev, address: event.target.value }))}
              className="min-h-[84px] w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-slate-800"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500">
              Terakhir diperbarui: <span className="font-medium text-slate-700">{biography?.updatedAt || '-'}</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <label className="flex items-center gap-2 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={biographyForm.visibleToAdmin}
                  onChange={(event) => setBiographyForm((prev) => ({ ...prev, visibleToAdmin: event.target.checked }))}
                  className="h-4 w-4 rounded border-stone-300 text-teal-600"
                />
                Tampilkan di Admin
              </label>
              <button
                type="submit"
                disabled={processingAction}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                Simpan
              </button>
            </div>
          </div>
        </form>

        <div className="my-6 border-t border-stone-200" />

        <div>
          <h4 className="text-sm font-semibold text-slate-900">History Pekerjaan</h4>
          <p className="mt-1.5 text-xs leading-6 text-slate-500">History pekerjaan dapat diinput lebih dari 1 data.</p>
        </div>

        <form onSubmit={createHistory} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="space-y-1 text-xs text-slate-600">
            <span>Periode Tahun</span>
            <input
              value={createHistoryForm.periodYear}
              onChange={(event) => setCreateHistoryForm((prev) => ({ ...prev, periodYear: event.target.value }))}
              className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-slate-800"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Jabatan</span>
            <input
              value={createHistoryForm.positionTitle}
              onChange={(event) => setCreateHistoryForm((prev) => ({ ...prev, positionTitle: event.target.value }))}
              className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-slate-800"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Pekerjaan</span>
            <input
              value={createHistoryForm.jobTitle}
              onChange={(event) => setCreateHistoryForm((prev) => ({ ...prev, jobTitle: event.target.value }))}
              className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-slate-800"
            />
          </label>
          <div className="flex items-end justify-end">
            <button
              type="submit"
              disabled={processingAction}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Tambah
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="grid grid-cols-[54px_1fr_1fr_1fr_120px] gap-2 bg-stone-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
            <div>No</div>
            <div>Periode Tahun</div>
            <div>Jabatan</div>
            <div>Pekerjaan</div>
            <div className="text-right">Aksi</div>
          </div>
          {sortedHistories.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500">Belum ada history pekerjaan.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {sortedHistories.map((history, index) => (
                <div
                  key={history.id}
                  className="grid grid-cols-[54px_1fr_1fr_1fr_120px] items-start gap-2 px-3 py-2 text-xs text-slate-700"
                >
                  <div className="pt-2 text-slate-500">{index + 1}</div>
                  <div className="pt-2">{history.periodYear}</div>
                  <div className="pt-2">{history.positionTitle}</div>
                  <div className="pt-2">{history.jobTitle}</div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditHistory(history)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-slate-600 hover:border-teal-200 hover:text-teal-700"
                      aria-label="Edit history"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeHistory(history)}
                      disabled={processingAction}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-700 disabled:opacity-50"
                      aria-label="Hapus history"
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingHistory ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 py-6">
          <div className="w-full max-w-lg rounded-[20px] border border-stone-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">Edit History Pekerjaan</h4>
                <p className="mt-1 text-xs text-slate-500">Perbarui detail periode tahun, jabatan, dan pekerjaan.</p>
              </div>
              <button
                type="button"
                onClick={closeEditHistory}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-slate-600 hover:border-stone-300"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={saveHistory} className="mt-4 space-y-3">
              <label className="space-y-1 text-xs text-slate-600">
                <span>Periode Tahun</span>
                <input
                  value={editHistoryForm.periodYear}
                  onChange={(event) => setEditHistoryForm((prev) => ({ ...prev, periodYear: event.target.value }))}
                  className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-slate-800"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>Jabatan</span>
                <input
                  value={editHistoryForm.positionTitle}
                  onChange={(event) => setEditHistoryForm((prev) => ({ ...prev, positionTitle: event.target.value }))}
                  className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-slate-800"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <span>Pekerjaan</span>
                <input
                  value={editHistoryForm.jobTitle}
                  onChange={(event) => setEditHistoryForm((prev) => ({ ...prev, jobTitle: event.target.value }))}
                  className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-slate-800"
                />
              </label>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEditHistory}
                  className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={processingAction}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
