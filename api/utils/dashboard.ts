import type { AppData, AttendanceRecord, DashboardStat, LandingPageContent, UserProfile } from '../types.js'

type BasicAccount = {
  id: number
  fullName: string
  email: string
  role: string
  approvalStatus: string
  isActive: boolean
}

const countAttendance = (records: AttendanceRecord[], status: AttendanceRecord['status']) =>
  records.filter((item) => item.status === status).length

export const buildStudyAttendanceRecords = (
  data: Pick<AppData, 'studyAttendanceEntries' | 'studyAttendanceSessions' | 'schedules'>,
): AttendanceRecord[] =>
  data.studyAttendanceEntries
    .map((item) => {
      const session = data.studyAttendanceSessions.find((sessionItem) => sessionItem.id === item.sessionId)
      if (!session) return null

      const schedule = data.schedules.find((scheduleItem) => scheduleItem.id === session.scheduleId)
      if (!schedule) return null

      return {
        id: 1_000_000_000 + item.id,
        userId: item.userId,
        attendanceDate: schedule.studyDate,
        status: item.status,
        note: `Absensi Pengajian: ${schedule.studyName}`,
        markedBy: session.supervisor1Id,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }
    })
    .filter((item): item is AttendanceRecord => Boolean(item))
    .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate) || b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id)

export const buildUserStats = (records: AttendanceRecord[]): DashboardStat[] => [
  { label: 'Total Catatan', value: String(records.length), tone: 'neutral' },
  { label: 'Hadir', value: String(countAttendance(records, 'hadir')), tone: 'success' },
  { label: 'Izin / Sakit', value: String(countAttendance(records, 'izin') + countAttendance(records, 'sakit')), tone: 'warning' },
  { label: 'Alpa', value: String(countAttendance(records, 'alpa')), tone: 'danger' },
]

export const buildTeacherStats = (users: BasicAccount[], attendances: AttendanceRecord[]): DashboardStat[] => [
  { label: 'Total User', value: String(users.length), tone: 'neutral' },
  { label: 'Absensi Hari Ini', value: String(new Set(attendances.map((item) => item.userId)).size), tone: 'success' },
  { label: 'Perlu Tindak Lanjut', value: String(attendances.filter((item) => item.status === 'alpa').length), tone: 'danger' },
]

export const buildAdminStats = (
  users: BasicAccount[],
  teachers: BasicAccount[],
  pendingUsers: BasicAccount[],
  totalAttendanceCount: number,
): DashboardStat[] => [
  { label: 'Total Generus', value: String(users.length), tone: 'neutral' },
  { label: 'Dewan Guru', value: String(teachers.length), tone: 'success' },
  { label: 'Registrasi Pending', value: String(pendingUsers.length), tone: 'warning' },
  { label: 'Total Absensi', value: String(totalAttendanceCount), tone: 'neutral' },
]

export const buildPublicHighlights = (content: LandingPageContent) => [
  ...(content.ui?.highlights?.length
    ? content.ui.highlights.map((item, index) => ({
        label: item.label,
        value: index === 0 ? String(content.activities.length) : item.value,
      }))
    : [
        { label: 'Program Aktif', value: String(content.activities.length) },
        { label: 'Sistem', value: 'Multi-role' },
        { label: 'Layanan', value: 'Registrasi & Absensi' },
      ]),
]

export const enrichUser = (
  account: {
    id: number
    fullName: string
    email: string
    role: string
    approvalStatus: string
    isActive: boolean
  },
  profiles: UserProfile[],
) => ({
  ...account,
  profile: profiles.find((item) => item.userId === account.id) || null,
})
