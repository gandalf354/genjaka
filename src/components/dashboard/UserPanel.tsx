import { useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, parse } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '@/lib/api'
import { createJakartaFormatter, getJakartaDateKey, getJakartaMonthStartFromDateKey, parseJakartaDateKey, shiftJakartaMonth } from '@/lib/time'
import type { UserDashboardResponse } from '@/types'

interface UserPanelProps {
  data: UserDashboardResponse
  refresh: () => Promise<void>
  section: 'profile' | 'roster' | 'attendance'
}

const rosterWeekdayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const rosterMonthFormatter = createJakartaFormatter('id-ID', { month: 'long', year: 'numeric' })
const rosterDateFormatter = createJakartaFormatter('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const attendanceMonthFormatter = createJakartaFormatter('id-ID', { month: 'long', year: 'numeric' })
const attendanceDateFormatter = createJakartaFormatter('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const attendanceStatusMap = {
  hadir: {
    label: 'Hadir',
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    cardClassName: 'border-emerald-100 bg-emerald-50/50',
  },
  izin: {
    label: 'Izin',
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700',
    cardClassName: 'border-amber-100 bg-amber-50/50',
  },
  sakit: {
    label: 'Sakit',
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-700',
    cardClassName: 'border-sky-100 bg-sky-50/50',
  },
  alpa: {
    label: 'Alpa',
    badgeClassName: 'border-rose-200 bg-rose-50 text-rose-700',
    cardClassName: 'border-rose-100 bg-rose-50/50',
  },
} as const

const getAgeFromBirthDate = (birthDate: string | null | undefined, todayDateKey: string) => {
  if (!birthDate) return null

  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number)
  const [currentYear, currentMonth, currentDay] = todayDateKey.split('-').map(Number)

  if (![birthYear, birthMonth, birthDay, currentYear, currentMonth, currentDay].every(Number.isFinite)) {
    return null
  }

  let age = currentYear - birthYear
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age -= 1
  }

  return age >= 0 ? age : null
}

export function UserPanel({ data, refresh, section }: UserPanelProps) {
  const [form, setForm] = useState({
    fullName: data.user.fullName || '',
    gender: data.profile?.gender || '',
    birthPlace: data.profile?.birthPlace || '',
    birthDate: data.profile?.birthDate || '',
    address: data.profile?.address || '',
    phoneNumber: data.profile?.phoneNumber || '',
    guardianName: data.profile?.guardianName || '',
    motherName: data.profile?.motherName || '',
    biography: data.profile?.biography || '',
  })
  const [message, setMessage] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [selectedRosterDate, setSelectedRosterDate] = useState(getJakartaDateKey())
  const [rosterMonth, setRosterMonth] = useState(() => getJakartaMonthStartFromDateKey(getJakartaDateKey()))
  const [rosterInitialized, setRosterInitialized] = useState(false)

  const selectedBirthDate = useMemo(() => {
    if (!form.birthDate) return null
    return parse(form.birthDate, 'yyyy-MM-dd', new Date())
  }, [form.birthDate])

  const sortedAttendances = useMemo(
    () => [...data.attendances].sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate)),
    [data.attendances],
  )
  const attendanceSummary = useMemo(
    () =>
      sortedAttendances.reduce(
        (summary, item) => {
          summary.total += 1
          if (item.status === 'hadir') summary.hadir += 1
          if (item.status === 'izin') summary.izin += 1
          if (item.status === 'sakit') summary.sakit += 1
          if (item.status === 'alpa') summary.alpa += 1
          return summary
        },
        { total: 0, hadir: 0, izin: 0, sakit: 0, alpa: 0 },
      ),
    [sortedAttendances],
  )
  const attendanceGroups = useMemo(() => {
    return sortedAttendances.reduce<Array<{ monthKey: string; monthLabel: string; items: typeof sortedAttendances }>>((groups, item) => {
      const monthKey = item.attendanceDate.slice(0, 7)
      const existingGroup = groups.find((group) => group.monthKey === monthKey)

      if (existingGroup) {
        existingGroup.items.push(item)
        return groups
      }

      groups.push({
        monthKey,
        monthLabel: attendanceMonthFormatter.format(parseJakartaDateKey(`${monthKey}-01`)),
        items: [item],
      })

      return groups
    }, [])
  }, [sortedAttendances])

  const todayDateKey = getJakartaDateKey()
  const rosterAge = useMemo(() => getAgeFromBirthDate(data.profile?.birthDate, todayDateKey), [data.profile?.birthDate, todayDateKey])
  const rosterAgeGroup = useMemo(
    () =>
      rosterAge === null
        ? null
        : data.ageGroups.find((ageGroup) => rosterAge >= ageGroup.minAge && (ageGroup.maxAge === null || rosterAge <= ageGroup.maxAge)) || null,
    [data.ageGroups, rosterAge],
  )
  const rosterGroupId = data.profile?.groupId ?? null
  const rosterGroup = useMemo(() => data.groups.find((group) => group.id === rosterGroupId) || null, [data.groups, rosterGroupId])
  const rosterVillage = useMemo(
    () => data.villages.find((village) => village.id === rosterGroup?.villageId) || null,
    [data.villages, rosterGroup?.villageId],
  )
  const rosterSchedules = useMemo(
    () =>
      [...data.schedules]
        .filter((schedule) => schedule.groupId === rosterGroupId && schedule.ageGroupId === rosterAgeGroup?.id)
        .sort((a, b) => a.studyDate.localeCompare(b.studyDate) || a.startTime.localeCompare(b.startTime) || a.id - b.id),
    [data.schedules, rosterAgeGroup?.id, rosterGroupId],
  )
  const scheduleCountByDate = useMemo(
    () =>
      rosterSchedules.reduce<Record<string, number>>((counts, schedule) => {
        counts[schedule.studyDate] = (counts[schedule.studyDate] || 0) + 1
        return counts
      }, {}),
    [rosterSchedules],
  )
  const selectedRosterSchedules = useMemo(
    () => rosterSchedules.filter((schedule) => schedule.studyDate === selectedRosterDate),
    [rosterSchedules, selectedRosterDate],
  )
  const calendarDays = useMemo(() => {
    const year = rosterMonth.getUTCFullYear()
    const month = rosterMonth.getUTCMonth()
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1, 5, 0, 0))
    const gridStart = new Date(Date.UTC(year, month, 1 - firstDayOfMonth.getUTCDay(), 5, 0, 0))

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(Date.UTC(gridStart.getUTCFullYear(), gridStart.getUTCMonth(), gridStart.getUTCDate() + index, 5, 0, 0))
      const dateKey = getJakartaDateKey(date)

      return {
        dateKey,
        dayNumber: date.getUTCDate(),
        isCurrentMonth: date.getUTCMonth() === month,
        scheduleCount: scheduleCountByDate[dateKey] || 0,
      }
    })
  }, [rosterMonth, scheduleCountByDate])

  useEffect(() => {
    if (rosterInitialized) return

    setRosterInitialized(true)
  }, [rosterInitialized])

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await api.put('/user/profile', form)
    setMessage('Biodata berhasil diperbarui.')
    await refresh()
  }

  const uploadPhoto = async () => {
    if (!photoFile) return

    const formData = new FormData()
    formData.append('photo', photoFile)
    await api.post('/user/profile/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    setMessage('Foto profil berhasil diperbarui.')
    setPhotoFile(null)
    await refresh()
  }

  if (section === 'attendance') {
    return (
      <div className="rounded-[24px] border border-stone-200 bg-white/90 p-4">
        <h3 className="font-display text-2xl text-slate-900">Absensi Saya</h3>
        <p className="mt-2 text-sm text-slate-500">Riwayat kehadiran ditampilkan per bulan dengan status yang lebih jelas agar cepat dibaca.</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Total Catatan', value: attendanceSummary.total, tone: 'text-slate-900', bg: 'bg-stone-50 border-stone-200' },
            { label: 'Hadir', value: attendanceSummary.hadir, tone: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
            { label: 'Izin', value: attendanceSummary.izin, tone: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Sakit', value: attendanceSummary.sakit, tone: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
            { label: 'Alpa', value: attendanceSummary.alpa, tone: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl border px-3 py-3 ${item.bg}`}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
              <p className={`mt-1 text-xl font-semibold ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {attendanceGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-sm text-slate-500">
              Belum ada data kehadiran yang tercatat untuk akun Anda.
            </div>
          ) : null}

          {attendanceGroups.map((group) => (
            <div key={group.monthKey} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="border-b border-stone-200 bg-stone-50 px-3 py-2">
                <h4 className="text-xs font-semibold text-slate-900">{group.monthLabel}</h4>
                <p className="mt-0.5 text-[11px] text-slate-500">{group.items.length} catatan kehadiran</p>
              </div>

              <div className="divide-y divide-stone-200">
                {group.items.map((item) => {
                  const statusMeta = attendanceStatusMap[item.status]

                  return (
                    <div key={item.id} className="grid gap-2.5 px-3 py-2 md:grid-cols-[190px_90px_minmax(0,1fr)] md:items-center">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Tanggal Kehadiran</p>
                        <p className="mt-0.5 text-[12px] font-semibold text-slate-900">{attendanceDateFormatter.format(parseJakartaDateKey(item.attendanceDate))}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{item.attendanceDate}</p>
                      </div>

                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Status</p>
                        <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusMeta.badgeClassName}`}>
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className={`rounded-lg border px-2.5 py-2 ${statusMeta.cardClassName}`}>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Catatan</p>
                        <p className="mt-0.5 text-[11px] leading-5 text-slate-700">{item.note?.trim() ? item.note : 'Tidak ada catatan tambahan untuk kehadiran ini.'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (section === 'roster') {
    return (
      <div className="rounded-[24px] border border-stone-200 bg-white/90 p-4">
        <div>
          <h3 className="font-display text-2xl text-slate-900">Roster Pengajian</h3>
          <p className="mt-2 text-sm text-slate-500">Jadwal pengajian ini otomatis menyesuaikan dengan kelompok dan kelompok usia yang terdaftar pada profil Anda.</p>
          <p className="mt-2 text-xs text-slate-500">
            Kelompok: <span className="font-medium text-slate-700">{rosterGroup ? `${rosterVillage?.name || 'Tanpa Desa'} - ${rosterGroup.name}` : 'Belum dipilih'}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Kelompok Usia:{' '}
            <span className="font-medium text-slate-700">
              {rosterAgeGroup ? `${rosterAgeGroup.name}${rosterAge !== null ? ` (${rosterAge} tahun)` : ''}` : 'Belum dapat ditentukan'}
            </span>
          </p>
        </div>

        {!rosterGroup ? (
          <div className="mt-4 rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm text-slate-500">
            Profil Anda belum memiliki kelompok. Silakan hubungi admin agar kelompok Anda ditentukan terlebih dahulu.
          </div>
        ) : !rosterAgeGroup ? (
          <div className="mt-4 rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm text-slate-500">
            Kelompok usia Anda belum dapat ditentukan. Pastikan tanggal lahir pada biodata sudah terisi dengan benar.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Kalender Bulan</p>
                  <h4 className="mt-1 text-sm font-semibold text-slate-900">{rosterMonthFormatter.format(rosterMonth)}</h4>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setRosterMonth((current) => shiftJakartaMonth(current, -1))}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                    aria-label="Bulan sebelumnya"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRosterMonth((current) => shiftJakartaMonth(current, 1))}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                    aria-label="Bulan berikutnya"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1">
                {rosterWeekdayLabels.map((label) => (
                  <div key={label} className="rounded-md bg-stone-50 px-1 py-1.5 text-center text-[11px] font-medium text-slate-500">
                    {label}
                  </div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const isSelected = day.dateKey === selectedRosterDate

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => {
                        setSelectedRosterDate(day.dateKey)
                        if (!day.isCurrentMonth) {
                          setRosterMonth(getJakartaMonthStartFromDateKey(day.dateKey))
                        }
                      }}
                      className={`min-h-[72px] rounded-lg border px-1.5 py-1.5 text-left transition ${
                        isSelected
                          ? 'border-teal-300 bg-teal-50'
                          : day.isCurrentMonth
                            ? 'border-stone-200 bg-white hover:border-teal-200 hover:bg-stone-50'
                            : 'border-stone-200 bg-stone-50/80 text-slate-400 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-xs font-medium ${isSelected ? 'text-teal-700' : day.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'}`}>
                          {day.dayNumber}
                        </span>
                        {day.scheduleCount > 0 ? (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              isSelected ? 'bg-teal-200 text-teal-800' : 'bg-stone-100 text-slate-600'
                            }`}
                          >
                            {day.scheduleCount}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4">
                        {day.scheduleCount > 0 ? <div className={`h-1.5 w-6 rounded-full ${isSelected ? 'bg-teal-500' : 'bg-amber-400'}`} /> : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <div className="border-b border-stone-200 pb-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Jadwal Pengajian</p>
                <h4 className="mt-1 text-sm font-semibold text-slate-900">{rosterDateFormatter.format(parseJakartaDateKey(selectedRosterDate))}</h4>
                <p className="mt-1 text-[11px] text-slate-500">{selectedRosterSchedules.length} jadwal untuk kelompok usia Anda pada tanggal ini.</p>
              </div>

              <div className="mt-3 space-y-2">
                {selectedRosterSchedules.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-4 text-[11px] text-slate-500">
                    Belum ada jadwal pengajian pada tanggal ini.
                  </div>
                ) : null}

                {selectedRosterSchedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-lg border border-stone-200 bg-stone-50/70 px-3 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{schedule.studyName}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{rosterVillage?.name || 'Tanpa Desa'} - {rosterGroup.name}</p>
                        <p className="mt-1 text-[11px] text-slate-500">Kelompok Usia: {rosterAgeGroup.name}</p>
                      </div>
                      <div className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
                        {schedule.startTime} - {schedule.endTime}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.85fr]">
      <div className="rounded-[24px] border border-stone-200 bg-white/90 p-5">
        <h3 className="font-display text-2xl text-slate-900">Biodata User</h3>
        <p className="mt-2 text-sm text-slate-500">Lengkapi data diri dan perbarui profil Anda secara mandiri.</p>
        <form className="mt-6 grid gap-3 md:grid-cols-2" onSubmit={saveProfile}>
          <label className="block space-y-2">
            <span className="text-sm text-slate-600">Nama Lengkap</span>
            <input
              value={form.fullName}
              readOnly
              className="w-full rounded-xl border border-stone-300 bg-stone-100 px-3.5 py-2.5 text-sm text-slate-800 outline-none"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-600">Jenis Kelamin</span>
            <select
              value={form.gender}
              onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400"
            >
              <option value="">Pilih Jenis Kelamin</option>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-600">Tempat Lahir</span>
            <input
              value={form.birthPlace}
              onChange={(event) => setForm((current) => ({ ...current, birthPlace: event.target.value }))}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-600">Tanggal Lahir</span>
            <DatePicker
              selected={selectedBirthDate}
              onChange={(date: Date | null) =>
                setForm((current) => ({
                  ...current,
                  birthDate: date ? format(date, 'yyyy-MM-dd') : '',
                }))
              }
              dateFormat="dd-MM-yyyy"
              locale={localeId}
              placeholderText="dd-mm-yyyy"
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400"
              calendarClassName="genjaka-datepicker"
              popperClassName="genjaka-datepicker-popper"
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              isClearable
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-600">Nomor Telepon</span>
            <input
              value={form.phoneNumber}
              onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-600">Nama Ayah</span>
            <input
              value={form.guardianName}
              onChange={(event) => setForm((current) => ({ ...current, guardianName: event.target.value }))}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-600">Nama Ibu</span>
            <input
              value={form.motherName}
              onChange={(event) => setForm((current) => ({ ...current, motherName: event.target.value }))}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400"
            />
          </label>
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm text-slate-600">Alamat</span>
            <textarea
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              className="min-h-24 w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400"
            />
          </label>
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm text-slate-600">Biografi Singkat</span>
            <textarea
              value={form.biography}
              onChange={(event) => setForm((current) => ({ ...current, biography: event.target.value }))}
              className="min-h-24 w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400"
            />
          </label>
          {message ? <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">{message}</div> : null}
          <button type="submit" className="rounded-xl bg-teal-300 px-3.5 py-2.5 text-sm font-semibold text-slate-950 md:col-span-2">
            Simpan Biodata
          </button>
        </form>
      </div>

      <div className="rounded-[24px] border border-stone-200 bg-white/90 p-5">
        <h3 className="font-display text-2xl text-slate-900">Foto Profil</h3>
        <div className="mt-5 overflow-hidden rounded-[20px] border border-stone-200 bg-stone-100">
          {data.profile?.photoUrl ? (
            <img src={data.profile.photoUrl} alt={data.user.fullName} className="h-[512px] w-full object-cover" />
          ) : (
            <div className="flex h-[512px] items-center justify-center text-sm text-slate-500">Belum ada foto profil</div>
          )}
        </div>
        <div className="mt-4 space-y-2.5">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-teal-300 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
          />
          <button type="button" onClick={uploadPhoto} className="rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-slate-700">
            Upload Foto
          </button>
        </div>
      </div>
    </div>
  )
}
