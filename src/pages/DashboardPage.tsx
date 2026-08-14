import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import type { DashboardMenuItem } from '@/components/dashboard/DashboardShell'
import { AdminPanel } from '@/components/dashboard/AdminPanel'
import { SuperAdminPanel } from '@/components/dashboard/SuperAdminPanel'
import { OwnerBiographyPanel } from '@/components/dashboard/OwnerBiographyPanel'
import { OwnerBiographyReadOnlyPanel } from '../components/dashboard/OwnerBiographyReadOnlyPanel'
import { TeacherPanel } from '@/components/dashboard/TeacherPanel'
import { UserPanel } from '@/components/dashboard/UserPanel'
import { ResetPasswordPanel } from '@/components/dashboard/ResetPasswordPanel'
import { StatCard } from '@/components/StatCard'
import { api } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import type {
  AgeGroup,
  AdminDashboardResponse,
  AppUser,
  AttendanceRecord,
  DashboardStat,
  Group,
  LandingPageContent,
  StudySchedule,
  StudyAttendanceEntry,
  StudyAttendanceSession,
  SuperAdminDashboardResponse,
  TeacherDashboardResponse,
  UserDashboardResponse,
  UserWithProfile,
  Village,
} from '@/types'

type DashboardData = {
  stats: DashboardStat[]
  userData?: UserDashboardResponse
  teacherData?: TeacherDashboardResponse
  adminData?: AdminDashboardResponse
  superAdminData?: SuperAdminDashboardResponse
  users: UserWithProfile[]
  teachers: UserWithProfile[]
  ppgs: UserWithProfile[]
  pjps: UserWithProfile[]
  registrations: UserWithProfile[]
  attendances: Array<AttendanceRecord & { user?: AppUser }>
  studyAttendanceSessions: StudyAttendanceSession[]
  studyAttendanceEntries: StudyAttendanceEntry[]
  landingPage: LandingPageContent | null
  admins: AppUser[]
  villages: Village[]
  groups: Group[]
  ageGroups: AgeGroup[]
  schedules: StudySchedule[]
  ownerBiographyVisibleToAdmin: boolean
}

const emptyData: DashboardData = {
  stats: [],
  users: [],
  teachers: [],
  ppgs: [],
  pjps: [],
  registrations: [],
  attendances: [],
  studyAttendanceSessions: [],
  studyAttendanceEntries: [],
  landingPage: null,
  admins: [],
  villages: [],
  groups: [],
  ageGroups: [],
  schedules: [],
  ownerBiographyVisibleToAdmin: false,
}

const emptyLandingPage: LandingPageContent = {
  heroTitle: '',
  heroSubtitle: '',
  heroBadge: '',
  heroImageUrl: '',
  visionText: '',
  missionItems: [],
  contactAddress: '',
  contactPhone: '',
  contactEmail: '',
  instagramUrl: '',
  facebookUrl: '',
  tiktokUrl: '',
  ui: {
    headerBrandName: 'Genjaka',
    headerTagline: 'Portal Akademik',
    headerLogoAlt: 'Logo Genjaka',
    navHomeLabel: 'Home',
    navVisionLabel: 'Visi',
    navMissionLabel: 'Misi',
    navActivitiesLabel: 'Kegiatan',
    navContactLabel: 'Hubungi',
    headerLoginLabel: 'Login',
    headerRegisterLabel: 'Registrasi',
    heroPrimaryButtonLabel: 'Registrasi Sekarang',
    heroSecondaryButtonLabel: 'Login Dashboard',
    heroImageAlt: 'Foto utama Genjaka',
    heroImagePlaceholderText: 'Foto utama home belum ditambahkan.',
    visionHeadingTitle: 'Landasan digital yang modern, tertib, dan tetap terasa hangat.',
    visionHeadingDescription:
      'Landing page membawa identitas lembaga ke ruang publik, sementara dashboard internal membantu pengelolaan data dan proses harian secara akurat.',
    missionHeadingTitle: 'Tiga fokus utama yang menjadi penggerak sistem.',
    missionHeadingDescription: '',
    activitiesHeadingTitle: 'Ruang aktivitas yang memperlihatkan ritme pembinaan dan kolaborasi.',
    activitiesHeadingDescription:
      'Menampilkan tiga kegiatan terbaru secara descending. Jika datanya lebih dari tiga, kartu akan bergeser otomatis dan tetap bisa digeser manual.',
    contactHeadingTitle: 'Buka percakapan awal dengan lembaga Anda secara lebih rapi.',
    contactHeadingDescription:
      'Bagian kontak ini juga dikelola dari panel admin, termasuk daftar sosial media agar pengunjung mudah terhubung lewat kanal yang mereka gunakan.',
    socialMediaTitle: 'Sosial Media',
    highlights: [
      { label: 'Program Aktif', value: '' },
      { label: 'Sistem', value: 'Multi-role' },
      { label: 'Layanan', value: 'Registrasi & Absensi' },
    ],
  },
  activities: [],
}

export default function DashboardPage() {
  const { initialized, token, user, loadCurrentUser } = useAppStore()
  const profile = useAppStore((state) => state.profile)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<DashboardData>(emptyData)

  const menu = useMemo<DashboardMenuItem[]>(() => {
    const common: DashboardMenuItem[] = [{ key: 'overview', label: 'Halaman Utama' }]
    const resetPasswordMenu: DashboardMenuItem = { key: 'account-reset-password', label: 'Reset Password' }
    if (user?.role === 'user') {
      return [
        ...common,
        { key: 'user-profile', label: 'Biodata' },
        { key: 'user-study-roster', label: 'Roster Pengajian' },
        { key: 'user-attendance', label: 'Absensi' },
        resetPasswordMenu,
      ]
    }
    if (user?.role === 'ppg' || user?.role === 'pjp') {
      return [
        ...common,
        { key: 'role-users', label: 'Data Generus' },
        {
          key: 'role-study-schedules',
          label: 'Pengajian',
          children: [
            { key: 'role-study-schedules', label: 'Jadwal Pengajian' },
            { key: 'role-study-roster', label: 'Roster Pengajian' },
            ...(user.role === 'pjp' ? [{ key: 'role-study-attendance', label: 'Absensi' }] : []),
          ],
        },
        resetPasswordMenu,
      ]
    }
    if (user?.role === 'teacher') {
      return [
        ...common,
        { key: 'teacher-users', label: 'Data Generus' },
        {
          key: 'teacher-study-schedules',
          label: 'Pengajian',
          children: [
            { key: 'teacher-study-schedules', label: 'Jadwal Pengajian' },
            { key: 'teacher-study-roster', label: 'Roster Pengajian' },
          ],
        },
        resetPasswordMenu,
      ]
    }
    if (user?.role === 'admin') {
      return [
        ...common,
        { key: 'admin-locations', label: 'Manajemen Lokasi' },
        {
          key: 'admin-user-approvals',
          label: 'Manajemen User',
          children: [
            { key: 'admin-user-approvals', label: 'Approval Registrasi' },
            { key: 'admin-user-users', label: 'Data Generus' },
            { key: 'admin-user-teachers', label: 'Kelola Dewan Guru' },
            { key: 'admin-user-ppg', label: 'Data PPG' },
            {
              key: 'admin-user-pjp-parent',
              label: 'Data PJP',
              children: [
                { key: 'admin-user-pjp-village', label: 'PJP Desa' },
                { key: 'admin-user-pjp-group', label: 'PJP Kelompok' },
              ],
            },
          ],
        },
        {
          key: 'admin-study-schedules',
          label: 'Pengajian',
          children: [
            { key: 'admin-study-schedules', label: 'Jadwal Pengajian' },
            { key: 'admin-study-roster', label: 'Roster Pengajian' },
          ],
        },
        { key: 'admin-attendance', label: 'Manajemen Absensi' },
        {
          key: 'admin-landing-page-home',
          label: 'Kelola Landing Page',
          children: [
            { key: 'admin-landing-page-home', label: 'Home' },
            { key: 'admin-landing-page-header', label: 'Header & Navigasi' },
            { key: 'admin-landing-page-vision', label: 'Visi' },
            { key: 'admin-landing-page-mission', label: 'Misi' },
            { key: 'admin-landing-page-activities', label: 'Kegiatan' },
            { key: 'admin-landing-page-contact', label: 'Hubungi' },
          ],
        },
        resetPasswordMenu,
        ...(dashboard.ownerBiographyVisibleToAdmin ? [{ key: 'admin-owner-biography', label: 'Biografi Owner' }] : []),
      ]
    }
    if (user?.role === 'superadmin') {
      return [
        ...common,
        { key: 'admin-locations', label: 'Manajemen Lokasi' },
        { key: 'superadmin-age-groups', label: 'Kelompok Usia' },
        {
          key: 'admin-user-approvals',
          label: 'Manajemen User',
          children: [
            { key: 'admin-user-approvals', label: 'Approval Registrasi' },
            { key: 'admin-user-users', label: 'Data Generus' },
            { key: 'admin-user-teachers', label: 'Kelola Dewan Guru' },
            { key: 'admin-user-ppg', label: 'Data PPG' },
            {
              key: 'admin-user-pjp-parent',
              label: 'Data PJP',
              children: [
                { key: 'admin-user-pjp-village', label: 'PJP Desa' },
                { key: 'admin-user-pjp-group', label: 'PJP Kelompok' },
              ],
            },
          ],
        },
        {
          key: 'admin-study-schedules',
          label: 'Pengajian',
          children: [
            { key: 'admin-study-schedules', label: 'Jadwal Pengajian' },
            { key: 'admin-study-roster', label: 'Roster Pengajian' },
          ],
        },
        { key: 'admin-attendance', label: 'Manajemen Absensi' },
        {
          key: 'admin-landing-page-home',
          label: 'Kelola Landing Page',
          children: [
            { key: 'admin-landing-page-home', label: 'Home' },
            { key: 'admin-landing-page-header', label: 'Header & Navigasi' },
            { key: 'admin-landing-page-vision', label: 'Visi' },
            { key: 'admin-landing-page-mission', label: 'Misi' },
            { key: 'admin-landing-page-activities', label: 'Kegiatan' },
            { key: 'admin-landing-page-contact', label: 'Hubungi' },
          ],
        },
        { key: 'superadmin', label: 'Kelola Admin' },
        resetPasswordMenu,
        { key: 'superadmin-owner-biography', label: 'Biografi Owner' },
      ]
    }
    return common
  }, [dashboard.ownerBiographyVisibleToAdmin, user?.role])

  const fetchDashboard = async () => {
    if (!user) return

    setLoading(true)
    await loadCurrentUser()

    if (user.role === 'user' || user.role === 'ppg' || user.role === 'pjp') {
      const response = await api.get('/user/dashboard')
      setDashboard({
        ...emptyData,
        stats: response.data.stats,
        userData: response.data,
        users: response.data.directoryUsers || response.data.users || [],
        villages: response.data.directoryVillages || response.data.villages || [],
        groups: response.data.directoryGroups || response.data.groups || [],
        schedules: response.data.directorySchedules || response.data.schedules || [],
        ageGroups: response.data.ageGroups || [],
      })
      setLoading(false)
      return
    }

    if (user.role === 'teacher') {
      const response = await api.get('/teacher/dashboard')
      setDashboard({
        ...emptyData,
        stats: response.data.stats,
        teacherData: response.data,
        users: response.data.users || [],
        villages: response.data.villages || [],
        groups: response.data.groups || [],
        ageGroups: response.data.ageGroups || [],
        schedules: response.data.schedules || [],
      })
      setLoading(false)
      return
    }

    const [
      adminDashboard,
      usersResponse,
      teachersResponse,
      ppgsResponse,
      pjpsResponse,
      registrationsResponse,
      attendanceResponse,
      landingPageResponse,
      locationsResponse,
      ageGroupsResponse,
      schedulesResponse,
      ownerBiographyResponse,
    ] =
      await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/users'),
        api.get('/admin/teachers'),
        api.get('/admin/ppg'),
        api.get('/admin/pjp'),
        api.get('/admin/registrations'),
        api.get('/admin/attendance'),
        api.get('/admin/landing-page'),
        api.get('/admin/locations'),
        api.get('/admin/age-groups'),
        api.get('/admin/study-schedules'),
        api.get('/admin/owner-biography').catch(() => null),
      ])

    const ownerBiographyVisibleToAdmin = Boolean(ownerBiographyResponse && (ownerBiographyResponse as { data?: any }).data?.biography?.visibleToAdmin)

    if (user.role === 'admin') {
      setDashboard({
        stats: adminDashboard.data.stats,
        adminData: adminDashboard.data,
        users: usersResponse.data.users,
        teachers: teachersResponse.data.teachers,
        ppgs: ppgsResponse.data.ppgs,
        pjps: pjpsResponse.data.pjps,
        registrations: registrationsResponse.data.registrations,
        attendances: attendanceResponse.data.attendances,
        studyAttendanceSessions: adminDashboard.data.studyAttendanceSessions || [],
        studyAttendanceEntries: adminDashboard.data.studyAttendanceEntries || [],
        landingPage: landingPageResponse.data.content,
        admins: [],
        villages: locationsResponse.data.villages,
        groups: locationsResponse.data.groups,
        ageGroups: ageGroupsResponse.data.ageGroups,
        schedules: schedulesResponse.data.schedules,
        ownerBiographyVisibleToAdmin,
      })
      setLoading(false)
      return
    }

    const superAdminDashboard = await api.get('/superadmin/dashboard')

    setDashboard({
      stats: superAdminDashboard.data.stats,
      superAdminData: superAdminDashboard.data,
      adminData: adminDashboard.data,
      users: usersResponse.data.users,
      teachers: teachersResponse.data.teachers,
      ppgs: ppgsResponse.data.ppgs,
      pjps: pjpsResponse.data.pjps,
      registrations: registrationsResponse.data.registrations,
      attendances: attendanceResponse.data.attendances,
      studyAttendanceSessions: adminDashboard.data.studyAttendanceSessions || [],
      studyAttendanceEntries: adminDashboard.data.studyAttendanceEntries || [],
      landingPage: landingPageResponse.data.content,
      admins: superAdminDashboard.data.admins,
      villages: locationsResponse.data.villages,
      groups: locationsResponse.data.groups,
      ageGroups: ageGroupsResponse.data.ageGroups,
      schedules: schedulesResponse.data.schedules,
      ownerBiographyVisibleToAdmin,
    })
    setLoading(false)
  }

  useEffect(() => {
    if (!token) return
    void fetchDashboard()
  }, [token, user?.role])

  useEffect(() => {
    if (menu[0]) {
      setActiveTab(menu[0].key)
    }
  }, [menu])

  if (!initialized) {
    return <div className="min-h-screen bg-ink" />
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!user) {
    return <div className="min-h-screen bg-ink" />
  }

  const titleMap = {
    user: 'Dashboard User',
    teacher: 'Dashboard Dewan Guru',
    admin: 'Dashboard Admin',
    superadmin: 'Dashboard SuperAdmin',
    ppg: 'Dashboard PPG',
    pjp: 'Dashboard PJP',
  }

  const subtitleMap = {
    user: 'Kelola biodata pribadi, lihat status akun, dan pantau riwayat absensi Anda.',
    teacher: 'Pantau data generus, lakukan absensi harian, dan tinjau laporan absensi dengan cepat.',
    admin: 'Atur user, dewan guru, approval registrasi, absensi, serta konten landing page dari satu tempat.',
    superadmin: 'Akses seluruh kemampuan Admin sekaligus mengelola akun Admin lain.',
    ppg: 'Pantau informasi utama PPG dari halaman utama dashboard.',
    pjp: 'Pantau informasi utama PJP dari halaman utama dashboard.',
  }

  const showStats =
    dashboard.stats.length > 0 &&
    !(user.role === 'user' && ['user-profile', 'user-study-roster', 'user-attendance', 'account-reset-password'].includes(activeTab)) &&
    !(['ppg', 'pjp'].includes(user.role) && activeTab !== 'overview') &&
    !(user.role === 'teacher' && activeTab !== 'overview') &&
    !(user.role === 'admin' && activeTab !== 'overview') &&
    !(user.role === 'superadmin' && activeTab !== 'overview')

  return (
    <DashboardShell
      user={user}
      title={titleMap[user.role]}
      subtitle={subtitleMap[user.role]}
      menu={menu}
      activeKey={activeTab}
      onSelect={setActiveTab}
    >
      {showStats ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.stats.map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </section>
      ) : null}

      {loading ? <div className="rounded-[24px] border border-stone-200 bg-white/85 p-5 text-sm text-slate-600">Memuat dashboard...</div> : null}

      {!loading && ['user', 'ppg', 'pjp'].includes(user.role) && dashboard.userData && activeTab === 'user-profile' ? (
        <UserPanel data={dashboard.userData} refresh={fetchDashboard} section="profile" />
      ) : null}
      {!loading && ['user', 'ppg', 'pjp'].includes(user.role) && dashboard.userData && activeTab === 'user-study-roster' ? (
        <UserPanel data={dashboard.userData} refresh={fetchDashboard} section="roster" />
      ) : null}
      {!loading && ['user', 'ppg', 'pjp'].includes(user.role) && dashboard.userData && activeTab === 'user-attendance' ? (
        <UserPanel data={dashboard.userData} refresh={fetchDashboard} section="attendance" />
      ) : null}
      {!loading && ['ppg', 'pjp'].includes(user.role) && activeTab === 'role-users' ? (
        <AdminPanel
          users={dashboard.users}
          teachers={[]}
          ppgs={[]}
          pjps={[]}
          registrations={[]}
          attendances={[]}
          villages={dashboard.villages}
          groups={dashboard.groups}
          ageGroups={dashboard.ageGroups}
          schedules={[]}
          landingPage={emptyLandingPage}
          refresh={fetchDashboard}
          managedUserApiBasePath={user.role === 'ppg' ? '/admin' : '/user'}
          managedUserReadOnly={user.role === 'ppg'}
          section="user-users"
        />
      ) : null}
      {!loading && ['ppg', 'pjp'].includes(user.role) && dashboard.userData && activeTab === 'role-study-schedules' ? (
        <AdminPanel
          users={[]}
          teachers={[]}
          ppgs={[]}
          pjps={[]}
          registrations={[]}
          attendances={[]}
          villages={user.role === 'ppg' ? dashboard.villages : dashboard.userData.villages}
          groups={user.role === 'ppg' ? dashboard.groups : dashboard.userData.groups}
          ageGroups={dashboard.ageGroups}
          schedules={user.role === 'ppg' ? dashboard.schedules : dashboard.userData.schedules}
          landingPage={emptyLandingPage}
          refresh={fetchDashboard}
          scheduleApiBasePath="/user/study-schedules"
          scheduleReadOnly={user.role === 'ppg'}
          section="study-schedules"
        />
      ) : null}
      {!loading && ['ppg', 'pjp'].includes(user.role) && dashboard.userData && activeTab === 'role-study-roster' ? (
        <AdminPanel
          users={[]}
          teachers={[]}
          ppgs={[]}
          pjps={[]}
          registrations={[]}
          attendances={[]}
          villages={user.role === 'ppg' ? dashboard.villages : dashboard.userData.villages}
          groups={user.role === 'ppg' ? dashboard.groups : dashboard.userData.groups}
          ageGroups={dashboard.ageGroups}
          schedules={user.role === 'ppg' ? dashboard.schedules : dashboard.userData.schedules}
          studyAttendanceSessions={user.role === 'pjp' ? dashboard.userData.studyAttendanceSessions || [] : []}
          landingPage={emptyLandingPage}
          refresh={fetchDashboard}
          scheduleApiBasePath="/user/study-schedules"
          scheduleReadOnly={user.role === 'ppg'}
          section="study-roster"
        />
      ) : null}
      {!loading && user.role === 'pjp' && dashboard.userData && activeTab === 'role-study-attendance' ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.userData.teachers || []}
          ppgs={dashboard.userData.ppgs || []}
          pjps={dashboard.userData.pjpVillages || []}
          registrations={[]}
          attendances={dashboard.userData.scopeAttendances || []}
          villages={dashboard.userData.villages}
          groups={dashboard.userData.groups}
          ageGroups={dashboard.ageGroups}
          schedules={dashboard.userData.schedules}
          studyAttendanceSessions={dashboard.userData.studyAttendanceSessions || []}
          studyAttendanceEntries={dashboard.userData.studyAttendanceEntries || []}
          landingPage={emptyLandingPage}
          refresh={fetchDashboard}
          currentUser={dashboard.userData.user}
          currentUserProfile={dashboard.userData.profile}
          scheduleReadOnly
          section="study-attendance"
        />
      ) : null}
      {!loading && ['user', 'ppg', 'pjp'].includes(user.role) && activeTab === 'overview' ? (
        <div className="rounded-[24px] border border-stone-200 bg-white/85 p-5 text-sm leading-7 text-slate-600">
          {user.role === 'user'
            ? 'Selamat datang. Gunakan menu samping untuk membuka biodata dan absensi Anda secara terpisah.'
            : user.role === 'ppg'
              ? 'Selamat datang di Dashboard PPG. Gunakan menu Pengajian untuk membuka Jadwal Pengajian dan Roster Pengajian.'
              : 'Selamat datang di Dashboard PJP. Gunakan menu Pengajian untuk membuka Jadwal Pengajian dan Roster Pengajian.'}
        </div>
      ) : null}
      {!loading && activeTab === 'account-reset-password' ? <ResetPasswordPanel user={user} /> : null}
      {!loading && user.role === 'admin' && activeTab === 'admin-owner-biography' && dashboard.ownerBiographyVisibleToAdmin ? (
        <OwnerBiographyReadOnlyPanel />
      ) : null}

      {!loading && user.role === 'teacher' && activeTab === 'teacher-users' && dashboard.teacherData ? (
        <AdminPanel
          users={dashboard.users}
          teachers={[]}
          ppgs={[]}
          pjps={[]}
          registrations={[]}
          attendances={[]}
          villages={dashboard.villages}
          groups={dashboard.groups}
          ageGroups={dashboard.ageGroups}
          schedules={[]}
          landingPage={emptyLandingPage}
          refresh={fetchDashboard}
          managedUserReadOnly
          section="user-users"
        />
      ) : null}
      {!loading && user.role === 'teacher' && activeTab === 'teacher-study-schedules' ? (
        <AdminPanel
          users={[]}
          teachers={[]}
          ppgs={[]}
          pjps={[]}
          registrations={[]}
          attendances={[]}
          villages={dashboard.villages}
          groups={dashboard.groups}
          ageGroups={dashboard.ageGroups}
          schedules={dashboard.schedules}
          landingPage={emptyLandingPage}
          refresh={fetchDashboard}
          scheduleReadOnly
          section="study-schedules"
        />
      ) : null}
      {!loading && user.role === 'teacher' && activeTab === 'teacher-study-roster' ? (
        <AdminPanel
          users={[]}
          teachers={[]}
          ppgs={[]}
          pjps={[]}
          registrations={[]}
          attendances={[]}
          villages={dashboard.villages}
          groups={dashboard.groups}
          ageGroups={dashboard.ageGroups}
          schedules={dashboard.schedules}
          landingPage={emptyLandingPage}
          refresh={fetchDashboard}
          scheduleReadOnly
          section="study-roster"
        />
      ) : null}
      {!loading && user.role === 'teacher' && activeTab === 'teacher-attendance' && dashboard.teacherData ? (
        <TeacherPanel data={dashboard.teacherData} refresh={fetchDashboard} section="attendance" />
      ) : null}
      {!loading && user.role === 'teacher' && activeTab === 'overview' ? (
        <div className="rounded-[24px] border border-stone-200 bg-white/85 p-5 text-sm leading-7 text-slate-600">
          Halaman utama ini menampilkan gambaran cepat data generus dan aktivitas absensi terbaru.
        </div>
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-user-approvals' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="user-approvals"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-user-users' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          ageGroups={dashboard.ageGroups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="user-users"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-user-teachers' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="user-teachers"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-user-ppg' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="user-ppg"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-user-pjp-village' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="user-pjp-village"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-user-pjp-group' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="user-pjp-group"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-locations' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="locations"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-study-schedules' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          ageGroups={dashboard.ageGroups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="study-schedules"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-study-roster' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          ageGroups={dashboard.ageGroups}
          schedules={dashboard.schedules}
          studyAttendanceSessions={dashboard.studyAttendanceSessions}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="study-roster"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-attendance' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          admins={dashboard.admins}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          studyAttendanceSessions={dashboard.studyAttendanceSessions}
          studyAttendanceEntries={dashboard.studyAttendanceEntries}
          villages={dashboard.villages}
          groups={dashboard.groups}
          ageGroups={dashboard.ageGroups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          currentUser={user}
          currentUserProfile={profile}
          section="study-attendance"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-landing-page-home' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="landing-home"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-landing-page-header' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="landing-header"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-landing-page-vision' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="landing-vision"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-landing-page-mission' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="landing-mission"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-landing-page-activities' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="landing-activities"
        />
      ) : null}

      {!loading && user.role === 'admin' && activeTab === 'admin-landing-page-contact' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="landing-contact"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-user-approvals' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="user-approvals"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-user-users' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          ageGroups={dashboard.ageGroups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="user-users"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-user-teachers' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="user-teachers"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-user-ppg' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="user-ppg"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-user-pjp-village' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="user-pjp-village"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-user-pjp-group' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="user-pjp-group"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'superadmin-age-groups' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          ageGroups={dashboard.ageGroups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="age-groups"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-locations' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="locations"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-attendance' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          admins={dashboard.admins}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          studyAttendanceSessions={dashboard.studyAttendanceSessions}
          studyAttendanceEntries={dashboard.studyAttendanceEntries}
          villages={dashboard.villages}
          groups={dashboard.groups}
          ageGroups={dashboard.ageGroups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          currentUser={user}
          currentUserProfile={profile}
          section="study-attendance"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-landing-page-home' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="landing-home"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-landing-page-header' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="landing-header"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-landing-page-vision' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="landing-vision"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-landing-page-mission' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="landing-mission"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-landing-page-activities' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="landing-activities"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-landing-page-contact' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="landing-contact"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-study-schedules' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          ageGroups={dashboard.ageGroups}
          schedules={dashboard.schedules}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="study-schedules"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'admin-study-roster' && dashboard.landingPage ? (
        <AdminPanel
          users={dashboard.users}
          teachers={dashboard.teachers}
          ppgs={dashboard.ppgs}
          pjps={dashboard.pjps}
          registrations={dashboard.registrations}
          attendances={dashboard.attendances}
          villages={dashboard.villages}
          groups={dashboard.groups}
          ageGroups={dashboard.ageGroups}
          schedules={dashboard.schedules}
          studyAttendanceSessions={dashboard.studyAttendanceSessions}
          landingPage={dashboard.landingPage}
          refresh={fetchDashboard}
          section="study-roster"
        />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'superadmin' ? (
        <SuperAdminPanel admins={dashboard.admins} refresh={fetchDashboard} />
      ) : null}

      {!loading && user.role === 'superadmin' && activeTab === 'superadmin-owner-biography' ? <OwnerBiographyPanel /> : null}

      {!loading && ['admin', 'superadmin'].includes(user.role) && activeTab === 'overview' ? (
        <div className="rounded-[24px] border border-stone-200 bg-white/85 p-5 text-sm leading-7 text-slate-600">
          Gunakan panel ini untuk menjaga alur registrasi, absensi, dan publikasi informasi lembaga tetap tertib dan konsisten.
        </div>
      ) : null}
    </DashboardShell>
  )
}
