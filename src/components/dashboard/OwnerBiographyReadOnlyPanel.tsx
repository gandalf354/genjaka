import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { api } from '@/lib/api'
import type { OwnerBiography, OwnerWorkHistory } from '@/types'

export function OwnerBiographyReadOnlyPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [biography, setBiography] = useState<OwnerBiography | null>(null)
  const [histories, setHistories] = useState<OwnerWorkHistory[]>([])

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.get('/admin/owner-biography')
      setBiography(response.data.biography as OwnerBiography)
      setHistories((response.data.histories || []) as OwnerWorkHistory[])
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

  if (loading) {
    return <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4 text-sm text-slate-600">Memuat biografi owner...</div>
  }

  if (error) {
    return <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
  }

  return (
    <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4">
      <div>
        <h3 className="font-display text-xl text-slate-900">Biografi Owner</h3>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
        <div className="rounded-[18px] border border-stone-200 bg-white p-4">
          <div className="aspect-[2/3] w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
            {biography?.photoUrl ? (
              <img src={biography.photoUrl} alt="Foto owner" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">Foto belum diunggah</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[18px] border border-stone-200 bg-white p-3">
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
              <div>
                <div className="text-[10px] font-semibold text-slate-500">Nama Lengkap</div>
                <div className="mt-0.5 text-xs text-slate-800">{biography?.fullName || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-500">No. Telp</div>
                <div className="mt-0.5 text-xs text-slate-800">{biography?.phoneNumber || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-500">Tempat</div>
                <div className="mt-0.5 text-xs text-slate-800">{biography?.birthPlace || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-500">Tanggal Lahir</div>
                <div className="mt-0.5 text-xs text-slate-800">{biography?.birthDate || '-'}</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-[10px] font-semibold text-slate-500">Alamat</div>
              <div className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-slate-800">{biography?.address || '-'}</div>
            </div>

            <div className="mt-3 text-[10px] text-slate-500">
              Terakhir diperbarui: <span className="font-medium text-slate-700">{biography?.updatedAt || '-'}</span>
            </div>
          </div>

          <div className="rounded-[18px] border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">History Pekerjaan</h4>
                <p className="mt-1 text-xs text-slate-500">Daftar riwayat pekerjaan owner.</p>
              </div>
              <div className="text-xs text-slate-500">
                Total: <span className="font-semibold text-slate-800">{sortedHistories.length}</span>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="grid grid-cols-[54px_1fr_1fr_1fr] gap-2 bg-stone-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                <div>No</div>
                <div>Periode Tahun</div>
                <div>Jabatan</div>
                <div>Pekerjaan</div>
              </div>
              {sortedHistories.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-500">Belum ada history pekerjaan.</div>
              ) : (
                <div className="max-h-[420px] divide-y divide-stone-100 overflow-y-auto">
                  {sortedHistories.map((history, index) => (
                    <div key={history.id} className="grid grid-cols-[54px_1fr_1fr_1fr] gap-2 px-3 py-2 text-xs text-slate-700">
                      <div className="text-slate-500">{index + 1}</div>
                      <div>{history.periodYear}</div>
                      <div>{history.positionTitle}</div>
                      <div>{history.jobTitle}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
