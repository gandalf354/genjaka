import bcrypt from 'bcryptjs'
import { getJakartaTimestamp } from '../utils/time.js'
import type { AppData } from '../types.js'

const heroImagePrompt =
  'modern educational institution facade at sunrise, elegant academic atmosphere, cinematic editorial photography, warm gold and deep blue palette, realistic, ultra detailed'
const activityPromptA =
  'students in a collaborative classroom workshop, academic uniforms, bright natural light, documentary photography, realistic, welcoming institution'
const activityPromptB =
  'school assembly and mentoring activity in a modern campus hall, structured formation, elegant lighting, realistic photography'
const activityPromptC =
  'teachers guiding students during community service event, outdoor courtyard, professional candid photography, realistic'

const toImage = (prompt: string, imageSize: string) =>
  `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${imageSize}`

const now = getJakartaTimestamp()
const superAdminPassword = bcrypt.hashSync('superadmin123', 10)
const adminPassword = bcrypt.hashSync('admin12345', 10)
const teacherPassword = bcrypt.hashSync('guru12345', 10)
const userPassword = bcrypt.hashSync('user12345', 10)

export const createSeedData = (): AppData => ({
  accounts: [
    {
      id: 1,
      fullName: 'Super Admin Genjaka',
      email: 'superadmin@genjaka.local',
      passwordHash: superAdminPassword,
      role: 'superadmin',
      approvalStatus: 'approved',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      fullName: 'Admin Operasional',
      email: 'admin@genjaka.local',
      passwordHash: adminPassword,
      role: 'admin',
      approvalStatus: 'approved',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 3,
      fullName: 'Dewan Guru Utama',
      email: 'guru@genjaka.local',
      passwordHash: teacherPassword,
      role: 'teacher',
      approvalStatus: 'approved',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 4,
      fullName: 'Ahmad Fadli',
      email: 'user@genjaka.local',
      passwordHash: userPassword,
      role: 'user',
      approvalStatus: 'approved',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 5,
      fullName: 'Calon Peserta Baru',
      email: 'pending@genjaka.local',
      passwordHash: userPassword,
      role: 'user',
      approvalStatus: 'pending',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ],
  profiles: [
    {
      id: 1,
      userId: 4,
      groupId: 1,
      villageId: 1,
      photoUrl: toImage(heroImagePrompt, 'portrait_4_3'),
      gender: 'Laki-laki',
      birthPlace: 'Yogyakarta',
      birthDate: '2007-09-11',
      address: 'Jl. Pendidikan No. 45, Yogyakarta',
      phoneNumber: '081234567890',
      guardianName: 'Bapak Fadlan',
      motherName: 'Ibu Fadlan',
      biography: 'Peserta aktif dengan minat pada kepemimpinan dan kegiatan sosial.',
      createdAt: now,
      updatedAt: now,
    },
  ],
  attendances: [
    {
      id: 1,
      userId: 4,
      attendanceDate: '2026-07-20',
      status: 'hadir',
      note: 'Tepat waktu',
      markedBy: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      userId: 4,
      attendanceDate: '2026-07-21',
      status: 'izin',
      note: 'Ada keperluan keluarga',
      markedBy: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 3,
      userId: 4,
      attendanceDate: '2026-07-22',
      status: 'hadir',
      note: 'Mengikuti kegiatan penuh',
      markedBy: 3,
      createdAt: now,
      updatedAt: now,
    },
  ],
  studyAttendanceSessions: [],
  studyAttendanceEntries: [],
  registrationReviews: [],
  villages: [
    {
      id: 1,
      name: 'Desa Karangrejo',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      name: 'Desa Sukamaju',
      createdAt: now,
      updatedAt: now,
    },
  ],
  groups: [
    {
      id: 1,
      villageId: 1,
      name: 'Kelompok An-Nur',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      villageId: 1,
      name: 'Kelompok Al-Falah',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 3,
      villageId: 2,
      name: 'Kelompok Ar-Rahmah',
      createdAt: now,
      updatedAt: now,
    },
  ],
  ageGroups: [
    {
      id: 1,
      name: 'Paud',
      minAge: 0,
      maxAge: 6,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      name: 'Cabe Rawit',
      minAge: 6,
      maxAge: 12,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 3,
      name: 'Pra Remaja',
      minAge: 12,
      maxAge: 15,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 4,
      name: 'Remaja',
      minAge: 15,
      maxAge: 18,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 5,
      name: 'Usia Mandiri',
      minAge: 18,
      maxAge: null,
      createdAt: now,
      updatedAt: now,
    },
  ],
  schedules: [
    {
      id: 1,
      groupId: 1,
      ageGroupId: 4,
      studyName: 'Pengajian Tafsir Pekanan',
      studyDate: '2026-07-30',
      startTime: '19:30',
      endTime: '21:00',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      groupId: 2,
      ageGroupId: 3,
      studyName: 'Pengajian Hadits Malam Jumat',
      studyDate: '2026-08-01',
      startTime: '19:00',
      endTime: '20:30',
      createdAt: now,
      updatedAt: now,
    },
  ],
  landingPage: {
    heroTitle: 'Portal Genjaka untuk Profil Lembaga dan Administrasi Terpadu',
    heroSubtitle:
      'Landing page publik yang berkarakter, dipadukan dengan dashboard multi-role untuk registrasi, biodata, absensi, dan pengelolaan konten.',
    heroBadge: 'Akademik Modern • Administrasi Terintegrasi',
    heroImageUrl: toImage(heroImagePrompt, 'landscape_16_9'),
    visionText:
      'Menjadi lembaga yang tertib, unggul, dan hangat dalam membina generasi yang berakhlak, disiplin, dan siap berkembang.',
    missionItems: [
      'Menyediakan sistem registrasi dan pembinaan yang rapi, mudah dipantau, dan transparan.',
      'Mendorong budaya disiplin melalui pengelolaan absensi dan pelaporan yang terstruktur.',
      'Membangun komunikasi yang kuat antara peserta, guru, dan pengelola lembaga.',
    ],
    contactAddress: 'Jl. Cendekia Utama No. 88, Yogyakarta',
    contactPhone: '0812-0000-1234',
    contactEmail: 'info@genjaka.local',
    instagramUrl: 'https://instagram.com/genjaka.official',
    facebookUrl: 'https://facebook.com/genjaka.official',
    tiktokUrl: 'https://tiktok.com/@genjaka.official',
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
        { label: 'Program Aktif', value: '0' },
        { label: 'Sistem', value: 'Multi-role' },
        { label: 'Layanan', value: 'Registrasi & Absensi' },
      ],
    },
    activities: [
      {
        id: 1,
        title: 'Pembinaan Karakter Pekanan',
        description: 'Sesi terjadwal untuk memperkuat disiplin, adab, dan keteladanan peserta.',
        imageUrl: toImage(activityPromptA, 'landscape_16_9'),
        sortOrder: 1,
      },
      {
        id: 2,
        title: 'Pendampingan Dewan Guru',
        description: 'Pendekatan personal untuk memantau perkembangan akademik dan perilaku peserta.',
        imageUrl: toImage(activityPromptB, 'landscape_16_9'),
        sortOrder: 2,
      },
      {
        id: 3,
        title: 'Kegiatan Sosial dan Kepemimpinan',
        description: 'Ruang praktik nyata untuk melatih kolaborasi, tanggung jawab, dan kepedulian.',
        imageUrl: toImage(activityPromptC, 'landscape_16_9'),
        sortOrder: 3,
      },
    ],
  },
  ownerBiography: {
    id: 1,
    fullName: '',
    birthPlace: '',
    birthDate: '',
    address: '',
    phoneNumber: '',
    photoUrl: '',
    visibleToAdmin: true,
    updatedAt: now,
  },
  ownerWorkHistories: [],
})
