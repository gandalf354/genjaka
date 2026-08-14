import { useMemo } from 'react'
import type { TeacherDashboardResponse, UserWithProfile } from '@/types'

interface TeacherPanelProps {
  data: TeacherDashboardResponse
  refresh: () => Promise<void>
  section: 'users' | 'attendance'
}

export function TeacherPanel({ data, refresh: _refresh, section }: TeacherPanelProps) {
  const users = useMemo<UserWithProfile[]>(() => data.users || [], [data.users])

  if (section === 'users') {
    return (
      <div className="rounded-[24px] border border-stone-200 bg-white/90 p-5">
        <h3 className="font-display text-2xl text-slate-900">Data Generus</h3>
        <p className="mt-2 text-sm text-slate-500">Lihat daftar generus secara terpisah agar pemantauan data peserta lebih fokus.</p>
        <div className="mt-5 space-y-2.5">
          {users.map((user) => (
            <div key={user.id} className="rounded-xl border border-stone-200 bg-stone-50 p-3.5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{user.fullName}</p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs uppercase tracking-[0.25em] text-teal-700">{user.approvalStatus}</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{user.profile?.address || 'Alamat belum diisi.'}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-stone-200 bg-white/90 p-5">
        <h3 className="font-display text-2xl text-slate-900">Input Absensi</h3>
        <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-7 text-slate-600">
          Input absensi lama sudah dihapus. Pengelolaan kehadiran sekarang dipusatkan melalui fitur <span className="font-semibold text-slate-900">Absensi Pengajian</span>.
        </div>
      </div>

      <div className="rounded-[24px] border border-stone-200 bg-white/90 p-5">
        <h3 className="font-display text-2xl text-slate-900">Laporan Absensi</h3>
        <div className="mt-5 overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Tanggal</th>
                <th className="px-3 py-2.5">Generus</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {data.recentAttendances.map((item) => {
                const user = users.find((entry) => entry.id === item.userId)
                return (
                  <tr key={item.id} className="border-t border-stone-200">
                    <td className="px-3 py-2.5 text-slate-700">{item.attendanceDate}</td>
                    <td className="px-3 py-2.5 text-slate-700">{user?.fullName || '-'}</td>
                    <td className="px-3 py-2.5 text-teal-700">{item.status}</td>
                    <td className="px-3 py-2.5 text-slate-500">{item.note || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
