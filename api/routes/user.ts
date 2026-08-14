import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { Router, type Response } from 'express'
import { authenticate, authorize, sanitizeAccount, type AuthenticatedRequest } from '../middleware/auth.js'
import { memoryStore } from '../data/store.js'
import { persistStoreToDatabase } from '../data/mysqlStore.js'
import { buildStudyAttendanceRecords, buildUserStats } from '../utils/dashboard.js'
import { getJakartaDateKey, getJakartaTimestamp } from '../utils/time.js'
import type { AppData, AttendanceStatus, Group, Role, StudySchedule, UserProfile, Village } from '../types.js'
import { enrichUser } from '../utils/dashboard.js'

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadDir = path.resolve(__dirname, '../../uploads/profiles')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${suffix}${path.extname(file.originalname) || '.jpg'}`)
  },
})

const upload = multer({ storage })

router.use(authenticate, authorize(['user', 'ppg', 'pjp']))

const createAccount = async ({
  fullName,
  email,
  role,
  password,
}: {
  fullName: string
  email: string
  role: Role
  password: string
}) => {
  const data = memoryStore.getData()
  const timestamp = getJakartaTimestamp()

  return memoryStore.saveAccount({
    id: memoryStore.nextId(data.accounts),
    fullName,
    email,
    role,
    passwordHash: await bcrypt.hash(password, 10),
    approvalStatus: 'approved',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

const authorizeStudyManagement = (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['ppg', 'pjp'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: 'Fitur ini hanya dapat digunakan oleh PPG atau PJP.' })
    return false
  }

  return true
}

const authorizeGenerusManagement = (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || !['ppg', 'pjp'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: 'Fitur Data Generus hanya dapat digunakan oleh PPG atau PJP.' })
    return false
  }

  return true
}

const authorizeStudyAttendanceManagement = (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'pjp') {
    res.status(403).json({ success: false, message: 'Fitur Absensi Pengajian hanya dapat digunakan oleh PJP.' })
    return false
  }

  return true
}

const normalizeSchedulePayload = (
  payload: Partial<StudySchedule> & {
    groupId?: number
    ageGroupId?: number | null
    studyName?: string
    studyDate?: string
    startTime?: string
    endTime?: string
  },
) => {
  const normalizedGroupId = Number(payload.groupId)
  const normalizedAgeGroupId =
    payload.ageGroupId === null || payload.ageGroupId === undefined || String(payload.ageGroupId).trim() === '' ? null : Number(payload.ageGroupId)
  const studyName = payload.studyName?.trim()
  const studyDate = payload.studyDate?.trim()
  const startTime = payload.startTime?.trim()
  const endTime = payload.endTime?.trim()

  return {
    normalizedGroupId,
    normalizedAgeGroupId,
    studyName,
    studyDate,
    startTime,
    endTime,
  }
}

const getManagementScope = (
  role: string | undefined,
  profile: UserProfile | null,
  data: AppData,
): {
  villages: Village[]
  groups: Group[]
  users: ReturnType<typeof enrichUser>[]
  schedules: StudySchedule[]
  allowedGroupIds: Set<number>
  allowedVillageIds: Set<number>
} => {
  const generusAccounts = data.accounts.filter((item) => item.role === 'user')

  const mapUsers = (accounts: typeof generusAccounts) => accounts.map((item) => enrichUser(sanitizeAccount(item), data.profiles))

  const filterUsersByScope = (allowedGroupIds: Set<number>, allowedVillageIds: Set<number>) =>
    generusAccounts.filter((item) => {
      const generusProfile = data.profiles.find((profileItem) => profileItem.userId === item.id)

      if (!generusProfile) return false
      if (generusProfile.groupId && allowedGroupIds.has(generusProfile.groupId)) return true
      if (generusProfile.villageId && allowedVillageIds.has(generusProfile.villageId)) return true

      return false
    })

  if (!['ppg', 'pjp'].includes(role || '')) {
    const allowedGroupIds = new Set(data.groups.map((group) => group.id))
    const allowedVillageIds = new Set(data.villages.map((village) => village.id))

    return {
      villages: data.villages,
      groups: data.groups,
      users: mapUsers(generusAccounts),
      schedules: data.schedules,
      allowedGroupIds,
      allowedVillageIds,
    }
  }

  if (profile?.groupId) {
    const group = data.groups.find((item) => item.id === profile.groupId) || null
    const village = group ? data.villages.find((item) => item.id === group.villageId) || null : null
    const groups = group ? [group] : []
    const villages = village ? [village] : []
    const allowedGroupIds = new Set(groups.map((item) => item.id))
    const allowedVillageIds = new Set(villages.map((item) => item.id))

    return {
      villages,
      groups,
      users: mapUsers(filterUsersByScope(allowedGroupIds, allowedVillageIds)),
      schedules: data.schedules.filter((schedule) => allowedGroupIds.has(schedule.groupId)),
      allowedGroupIds,
      allowedVillageIds,
    }
  }

  if (profile?.villageId) {
    const villages = data.villages.filter((item) => item.id === profile.villageId)
    const groups = data.groups.filter((item) => item.villageId === profile.villageId)
    const allowedGroupIds = new Set(groups.map((item) => item.id))
    const allowedVillageIds = new Set(villages.map((item) => item.id))

    return {
      villages,
      groups,
      users: mapUsers(filterUsersByScope(allowedGroupIds, allowedVillageIds)),
      schedules: data.schedules.filter((schedule) => allowedGroupIds.has(schedule.groupId)),
      allowedGroupIds,
      allowedVillageIds,
    }
  }

  return {
    villages: [],
    groups: [],
    users: [],
    schedules: [],
    allowedGroupIds: new Set<number>(),
    allowedVillageIds: new Set<number>(),
  }
}

const getAgeFromBirthDate = (birthDate: string | null | undefined, referenceDateKey: string) => {
  if (!birthDate) return null

  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number)
  const [currentYear, currentMonth, currentDay] = referenceDateKey.split('-').map(Number)

  if (![birthYear, birthMonth, birthDay, currentYear, currentMonth, currentDay].every(Number.isFinite)) {
    return null
  }

  let age = currentYear - birthYear
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age -= 1
  }

  return age >= 0 ? age : null
}

const getMatchedAgeGroupId = (data: AppData, birthDate: string | null | undefined, referenceDateKey: string) => {
  const age = getAgeFromBirthDate(birthDate, referenceDateKey)
  if (age === null) return null

  return data.ageGroups.find((item) => age >= item.minAge && (item.maxAge === null || age <= item.maxAge))?.id ?? null
}

const getScheduleParticipants = (
  schedule: StudySchedule,
  data: AppData,
  scope: ReturnType<typeof getManagementScope>,
) =>
  scope.users.filter((user) => {
    if (user.approvalStatus !== 'approved') return false
    const profile = user.profile
    const group = data.groups.find((item) => item.id === schedule.groupId)
    if (!profile || !group) return false

    const matchesScope = profile.groupId === group.id || (!profile.groupId && profile.villageId === group.villageId)
    const matchesAgeGroup = getMatchedAgeGroupId(data, profile.birthDate, schedule.studyDate) === schedule.ageGroupId

    return matchesScope && matchesAgeGroup
  })

const getUserAttendanceRecords = (accountId: number, data: AppData) => buildStudyAttendanceRecords(data).filter((item) => item.userId === accountId)

const getAuthorizedManagementScope = (req: AuthenticatedRequest, res: Response) => {
  const data = memoryStore.getData()
  const profile = data.profiles.find((item) => item.userId === req.user?.id) || null
  const scope = getManagementScope(req.user?.role, profile, data)

  if (['ppg', 'pjp'].includes(req.user?.role || '') && scope.allowedGroupIds.size === 0) {
    res.status(403).json({
      success: false,
      message: 'Akun ini belum memiliki akses Desa atau Kelompok untuk mengelola data.',
    })
    return null
  }

  return { data, profile, scope }
}

router.get('/dashboard', (req: AuthenticatedRequest, res: Response): void => {
  const data = memoryStore.getData()
  const account = req.user ? memoryStore.findAccountById(req.user.id) : undefined

  if (!account) {
    res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' })
    return
  }

  const studyAttendanceRecords = buildStudyAttendanceRecords(data)
  const records = studyAttendanceRecords.filter((item) => item.userId === account.id)
  const profile = data.profiles.find((item) => item.userId === account.id) || null
  const managementScope = getManagementScope(account.role, profile, data)
  const allGenerus = data.accounts
    .filter((item) => item.role === 'user')
    .map((item) => enrichUser(sanitizeAccount(item), data.profiles))
  const teachers = data.accounts
    .filter((item) => item.role === 'teacher' && item.approvalStatus === 'approved')
    .map((item) => enrichUser(sanitizeAccount(item), data.profiles))
  const scopedPpgs = data.accounts
    .filter((item) => item.role === 'ppg' && item.approvalStatus === 'approved')
    .map((item) => enrichUser(sanitizeAccount(item), data.profiles))
  const scopedPjpVillages = data.accounts
    .filter((item) => item.role === 'pjp' && item.approvalStatus === 'approved')
    .map((item) => enrichUser(sanitizeAccount(item), data.profiles))
    .filter((item) => {
      const profileItem = item.profile
      if (!profileItem) return false
      if (profileItem.groupId && managementScope.allowedGroupIds.has(profileItem.groupId)) return true
      if (profileItem.villageId && managementScope.allowedVillageIds.has(profileItem.villageId)) return true

      const scopedGroup = profileItem.groupId ? data.groups.find((group) => group.id === profileItem.groupId) : null
      return Boolean(scopedGroup && managementScope.allowedVillageIds.has(scopedGroup.villageId))
    })
  const scopedStudyAttendanceSessionIds = new Set(
    data.studyAttendanceSessions
      .filter((item) => {
        const schedule = data.schedules.find((scheduleItem) => scheduleItem.id === item.scheduleId)
        return Boolean(schedule && managementScope.allowedGroupIds.has(schedule.groupId))
      })
      .map((item) => item.id),
  )
  const scopeAttendances =
    account.role === 'pjp'
      ? (() => {
          const allowedUserIds = new Set(managementScope.users.map((item) => item.id))
          const todayKey = getJakartaDateKey()
          return studyAttendanceRecords.filter((item) => allowedUserIds.has(item.userId) && item.attendanceDate <= todayKey)
        })()
      : undefined

  const staffStudyAttendanceMentionCount = (() => {
    if (account.role !== 'pjp' && account.role !== 'ppg') return null

    const allowedScheduleIds =
      account.role === 'pjp'
        ? new Set(
            data.schedules
              .filter((scheduleItem) => managementScope.allowedGroupIds.has(scheduleItem.groupId))
              .map((scheduleItem) => scheduleItem.id),
          )
        : null

    return data.studyAttendanceSessions.filter((session) => {
      if (allowedScheduleIds && !allowedScheduleIds.has(session.scheduleId)) return false

      return (
        session.teacherId === account.id ||
        session.supervisor1Id === account.id ||
        session.supervisor2Id === account.id ||
        session.supervisor3Id === account.id
      )
    }).length
  })()

  const stats =
    account.role === 'pjp' || account.role === 'ppg'
      ? [
          {
            label: 'Total Catatan',
            value: String(staffStudyAttendanceMentionCount || 0),
            tone: 'neutral' as const,
          },
        ]
      : buildUserStats(records)

  res.json({
    success: true,
    user: sanitizeAccount(account),
    profile,
    stats,
    attendances: records,
    scopeAttendances,
    users: managementScope.users,
    teachers,
    ppgs: account.role === 'pjp' ? scopedPpgs : [],
    pjpVillages: account.role === 'pjp' ? scopedPjpVillages : [],
    studyAttendanceSessions:
      account.role === 'pjp' ? data.studyAttendanceSessions.filter((item) => scopedStudyAttendanceSessionIds.has(item.id)) : [],
    studyAttendanceEntries:
      account.role === 'pjp' ? data.studyAttendanceEntries.filter((item) => scopedStudyAttendanceSessionIds.has(item.sessionId)) : [],
    directoryUsers: account.role === 'ppg' ? allGenerus : managementScope.users,
    directoryVillages: account.role === 'ppg' ? data.villages : managementScope.villages,
    directoryGroups: account.role === 'ppg' ? data.groups : managementScope.groups,
    directorySchedules: account.role === 'ppg' ? data.schedules : managementScope.schedules,
    ageGroups: data.ageGroups,
    villages: managementScope.villages,
    groups: managementScope.groups,
    schedules: managementScope.schedules,
  })
})

router.get('/profile', (req: AuthenticatedRequest, res: Response): void => {
  const profile = memoryStore.getData().profiles.find((item) => item.userId === req.user?.id) || null
  res.json({ success: true, profile })
})

router.put('/profile', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = req.user ? memoryStore.findAccountById(req.user.id) : undefined

  if (!account) {
    res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' })
    return
  }

  const {
    fullName,
    groupId,
    villageId,
    gender,
    birthPlace,
    birthDate,
    address,
    phoneNumber,
    guardianName,
    motherName,
    biography,
  } = req.body as {
    fullName?: string
    groupId?: number | null
    villageId?: number | null
    gender?: string
    birthPlace?: string
    birthDate?: string
    address?: string
    phoneNumber?: string
    guardianName?: string
    motherName?: string
    biography?: string
  }

  if (fullName) {
    account.fullName = fullName
    account.updatedAt = getJakartaTimestamp()
    memoryStore.saveAccount(account)
  }

  const profile = memoryStore.upsertProfile({
    userId: account.id,
    groupId: groupId === null ? null : typeof groupId === 'number' && Number.isFinite(groupId) ? groupId : memoryStore.getData().profiles.find((item) => item.userId === account.id)?.groupId || null,
    villageId:
      villageId === null
        ? null
        : typeof villageId === 'number' && Number.isFinite(villageId)
          ? villageId
          : memoryStore.getData().profiles.find((item) => item.userId === account.id)?.villageId || null,
    photoUrl: memoryStore.getData().profiles.find((item) => item.userId === account.id)?.photoUrl || null,
    gender: gender || null,
    birthPlace: birthPlace || null,
    birthDate: birthDate || null,
    address: address || null,
    phoneNumber: phoneNumber || null,
    guardianName: guardianName || null,
    motherName: motherName || null,
    biography: biography || null,
  })
  await persistStoreToDatabase()

  res.json({
    success: true,
    message: 'Biodata berhasil diperbarui.',
    user: sanitizeAccount(account),
    profile,
  })
})

router.post('/profile/photo', upload.single('photo'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = req.user ? memoryStore.findAccountById(req.user.id) : undefined

  if (!account) {
    res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' })
    return
  }

  const filePath = req.file ? `/uploads/profiles/${req.file.filename}` : null
  const existing = memoryStore.getData().profiles.find((item) => item.userId === account.id)

  const profile = memoryStore.upsertProfile({
    userId: account.id,
    groupId: existing?.groupId || null,
    villageId: existing?.villageId || null,
    photoUrl: filePath || existing?.photoUrl || null,
    gender: existing?.gender || null,
    birthPlace: existing?.birthPlace || null,
    birthDate: existing?.birthDate || null,
    address: existing?.address || null,
    phoneNumber: existing?.phoneNumber || null,
    guardianName: existing?.guardianName || null,
    motherName: existing?.motherName || null,
    biography: existing?.biography || null,
  })
  await persistStoreToDatabase()

  res.json({
    success: true,
    message: 'Foto profil berhasil diunggah.',
    profile,
  })
})

router.post('/study-schedules', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!authorizeStudyManagement(req, res)) return
  const authorizedScope = getAuthorizedManagementScope(req, res)
  if (!authorizedScope) return

  const { normalizedGroupId, normalizedAgeGroupId, studyName, studyDate, startTime, endTime } = normalizeSchedulePayload(req.body)
  const groupExists = authorizedScope.scope.allowedGroupIds.has(normalizedGroupId)
  const ageGroupExists = normalizedAgeGroupId !== null && authorizedScope.data.ageGroups.some((item) => item.id === normalizedAgeGroupId)

  if (!groupExists) {
    res.status(400).json({ success: false, message: 'Kelompok jadwal pengajian wajib dipilih sesuai akses akun Anda.' })
    return
  }

  if (!ageGroupExists) {
    res.status(400).json({ success: false, message: 'Kelompok usia jadwal pengajian wajib dipilih.' })
    return
  }

  if (!studyName || !studyDate || !startTime || !endTime) {
    res.status(400).json({ success: false, message: 'Nama pengajian, tanggal, jam mulai, dan jam selesai wajib diisi.' })
    return
  }

  const timestamp = getJakartaTimestamp()
  const schedule = memoryStore.saveSchedule({
    id: memoryStore.nextId(memoryStore.getData().schedules),
    groupId: normalizedGroupId,
    ageGroupId: normalizedAgeGroupId,
    studyName,
    studyDate,
    startTime,
    endTime,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  await persistStoreToDatabase()
  res.status(201).json({ success: true, message: 'Jadwal pengajian berhasil ditambahkan.', schedule })
})

router.post('/study-attendance-sessions', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!authorizeStudyAttendanceManagement(req, res)) return
  const authorizedScope = getAuthorizedManagementScope(req, res)
  if (!authorizedScope) return

  const { scheduleId, teacherId, supervisor2Id, supervisor3Id, entries } = req.body as {
    scheduleId?: number
    teacherId?: number | null
    supervisor2Id?: number | null
    supervisor3Id?: number | null
    entries?: Array<{ userId: number; status: AttendanceStatus }>
  }

  const normalizedScheduleId = Number(scheduleId)
  const schedule = authorizedScope.data.schedules.find((item) => item.id === normalizedScheduleId)

  if (!schedule || !authorizedScope.scope.allowedGroupIds.has(schedule.groupId)) {
    res.status(404).json({ success: false, message: 'Jadwal pengajian tidak ditemukan atau di luar akses Anda.' })
    return
  }

  if (schedule.studyDate > getJakartaDateKey()) {
    res.status(400).json({ success: false, message: 'Absensi pengajian hanya dapat diisi untuk hari ini atau tanggal sebelumnya.' })
    return
  }

  const participants = getScheduleParticipants(schedule, authorizedScope.data, authorizedScope.scope)
  const allowedUserIds = new Set(participants.map((item) => item.id))
  const submittedEntries = Array.isArray(entries) ? entries : []

  if (submittedEntries.some((item) => !allowedUserIds.has(Number(item.userId)))) {
    res.status(400).json({ success: false, message: 'Terdapat peserta yang tidak sesuai dengan kelompok, desa, atau kelompok usia jadwal.' })
    return
  }

  const timestamp = getJakartaTimestamp()
  const existingSession = authorizedScope.data.studyAttendanceSessions.find((item) => item.scheduleId === schedule.id)
  const normalizedTeacherId = teacherId === null || teacherId === undefined || teacherId === 0 ? null : Number(teacherId)
  const normalizedSupervisor2Id = supervisor2Id === null || supervisor2Id === undefined || supervisor2Id === 0 ? null : Number(supervisor2Id)
  const normalizedSupervisor3Id = supervisor3Id === null || supervisor3Id === undefined || supervisor3Id === 0 ? null : Number(supervisor3Id)

  if (
    normalizedTeacherId !== null &&
    !authorizedScope.data.accounts.some((item) => item.id === normalizedTeacherId && item.role === 'teacher' && item.approvalStatus === 'approved')
  ) {
    res.status(400).json({ success: false, message: 'Pemateri yang dipilih tidak ditemukan.' })
    return
  }

  if (
    normalizedSupervisor2Id !== null &&
    !authorizedScope.data.accounts.some((item) => {
      const profileItem = authorizedScope.data.profiles.find((profile) => profile.userId === item.id)
      return (
        item.id === normalizedSupervisor2Id &&
        item.role === 'pjp' &&
        Boolean(profileItem?.villageId && !profileItem.groupId && authorizedScope.scope.allowedVillageIds.has(profileItem.villageId))
      )
    })
  ) {
    res.status(400).json({ success: false, message: 'Pengawas 2 yang dipilih tidak ditemukan.' })
    return
  }

  if (
    normalizedSupervisor3Id !== null &&
    !authorizedScope.data.accounts.some((item) => item.id === normalizedSupervisor3Id && item.role === 'ppg' && item.approvalStatus === 'approved')
  ) {
    res.status(400).json({ success: false, message: 'Pengawas 3 yang dipilih tidak ditemukan.' })
    return
  }

  const session = memoryStore.saveStudyAttendanceSession({
    id: existingSession?.id || memoryStore.nextId(authorizedScope.data.studyAttendanceSessions),
    scheduleId: schedule.id,
    teacherId: normalizedTeacherId,
    supervisor1Id: req.user!.id,
    supervisor2Id: normalizedSupervisor2Id,
    supervisor3Id: normalizedSupervisor3Id,
    createdBy: existingSession?.createdBy || req.user!.id,
    createdAt: existingSession?.createdAt || timestamp,
    updatedAt: timestamp,
  })

  const submittedStatusByUserId = new Map(submittedEntries.map((item) => [Number(item.userId), item.status]))
  authorizedScope.data.studyAttendanceEntries = authorizedScope.data.studyAttendanceEntries.filter((item) => item.sessionId !== session.id)

  let nextEntryId = memoryStore.nextId(authorizedScope.data.studyAttendanceEntries)
  const savedEntries = participants.map((participant) =>
    memoryStore.saveStudyAttendanceEntry({
      id: nextEntryId++,
      sessionId: session.id,
      userId: participant.id,
      status: submittedStatusByUserId.get(participant.id) || 'alpa',
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  )

  await persistStoreToDatabase()
  res.json({
    success: true,
    message: existingSession ? 'Absensi pengajian berhasil diperbarui.' : 'Absensi pengajian berhasil disimpan.',
    session,
    entries: savedEntries,
  })
})

router.put('/study-schedules/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!authorizeStudyManagement(req, res)) return
  const authorizedScope = getAuthorizedManagementScope(req, res)
  if (!authorizedScope) return

  const scheduleId = Number(req.params.id)
  const schedule = authorizedScope.data.schedules.find((item) => item.id === scheduleId)

  if (!schedule) {
    res.status(404).json({ success: false, message: 'Jadwal pengajian tidak ditemukan.' })
    return
  }

  if (!authorizedScope.scope.allowedGroupIds.has(schedule.groupId)) {
    res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke jadwal pengajian ini.' })
    return
  }

  const { normalizedGroupId, normalizedAgeGroupId, studyName, studyDate, startTime, endTime } = normalizeSchedulePayload(req.body)
  const groupExists = authorizedScope.scope.allowedGroupIds.has(normalizedGroupId)
  const ageGroupExists = normalizedAgeGroupId !== null && authorizedScope.data.ageGroups.some((item) => item.id === normalizedAgeGroupId)

  if (!groupExists) {
    res.status(400).json({ success: false, message: 'Kelompok jadwal pengajian wajib dipilih sesuai akses akun Anda.' })
    return
  }

  if (!ageGroupExists) {
    res.status(400).json({ success: false, message: 'Kelompok usia jadwal pengajian wajib dipilih.' })
    return
  }

  if (!studyName || !studyDate || !startTime || !endTime) {
    res.status(400).json({ success: false, message: 'Nama pengajian, tanggal, jam mulai, dan jam selesai wajib diisi.' })
    return
  }

  schedule.groupId = normalizedGroupId
  schedule.ageGroupId = normalizedAgeGroupId
  schedule.studyName = studyName
  schedule.studyDate = studyDate
  schedule.startTime = startTime
  schedule.endTime = endTime
  schedule.updatedAt = getJakartaTimestamp()
  memoryStore.saveSchedule(schedule)

  await persistStoreToDatabase()
  res.json({ success: true, message: 'Jadwal pengajian berhasil diperbarui.', schedule })
})

router.delete('/study-schedules/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!authorizeStudyManagement(req, res)) return
  const authorizedScope = getAuthorizedManagementScope(req, res)
  if (!authorizedScope) return
  const scheduleId = Number(req.params.id)
  const schedule = authorizedScope.data.schedules.find((item) => item.id === scheduleId)

  if (!schedule) {
    res.status(404).json({ success: false, message: 'Jadwal pengajian tidak ditemukan.' })
    return
  }

  if (!authorizedScope.scope.allowedGroupIds.has(schedule.groupId)) {
    res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke jadwal pengajian ini.' })
    return
  }

  authorizedScope.data.schedules = authorizedScope.data.schedules.filter((item) => item.id !== scheduleId)
  await persistStoreToDatabase()

  res.json({ success: true, message: 'Jadwal pengajian berhasil dihapus.' })
})

router.post('/users', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!authorizeGenerusManagement(req, res)) return
  const authorizedScope = getAuthorizedManagementScope(req, res)
  if (!authorizedScope) return

  const { fullName, email, password = 'user12345' } = req.body as Record<string, string>

  if (!fullName || !email) {
    res.status(400).json({ success: false, message: 'Nama lengkap dan email wajib diisi.' })
    return
  }

  if (memoryStore.findAccountByEmail(email)) {
    res.status(409).json({ success: false, message: 'Email sudah digunakan.' })
    return
  }

  const account = await createAccount({ fullName, email, role: 'user', password })
  await persistStoreToDatabase()

  res.status(201).json({
    success: true,
    message: 'Generus berhasil ditambahkan.',
    user: sanitizeAccount(account),
  })
})

router.put('/users/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!authorizeGenerusManagement(req, res)) return
  const authorizedScope = getAuthorizedManagementScope(req, res)
  if (!authorizedScope) return

  const id = Number(req.params.id)
  const {
    fullName,
    email,
    groupId,
    villageId,
    gender,
    birthPlace,
    birthDate,
    address,
    phoneNumber,
    guardianName,
    motherName,
    biography,
  } = req.body as {
    fullName?: string
    email?: string
    groupId?: number | null
    villageId?: number | null
    gender?: string
    birthPlace?: string
    birthDate?: string
    address?: string
    phoneNumber?: string
    guardianName?: string
    motherName?: string
    biography?: string
  }

  const account = authorizedScope.data.accounts.find((item) => item.id === id && item.role === 'user')

  if (!account) {
    res.status(404).json({ success: false, message: 'Generus tidak ditemukan.' })
    return
  }

  const existingProfile = authorizedScope.data.profiles.find((item) => item.userId === account.id) || null
  const currentGroupId = existingProfile?.groupId || null
  const currentVillageId = existingProfile?.villageId || null

  if (currentGroupId && !authorizedScope.scope.allowedGroupIds.has(currentGroupId)) {
    res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data generus ini.' })
    return
  }

  if (!currentGroupId && currentVillageId && !authorizedScope.scope.allowedVillageIds.has(currentVillageId)) {
    res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data generus ini.' })
    return
  }

  let nextGroupId =
    groupId === null ? null : typeof groupId === 'number' && Number.isFinite(groupId) ? groupId : existingProfile?.groupId || null
  let nextVillageId =
    villageId === null ? null : typeof villageId === 'number' && Number.isFinite(villageId) ? villageId : existingProfile?.villageId || null

  if (typeof nextGroupId === 'number') {
    const group = authorizedScope.data.groups.find((item) => item.id === nextGroupId)

    if (!group || !authorizedScope.scope.allowedGroupIds.has(group.id)) {
      res.status(400).json({ success: false, message: 'Kelompok yang dipilih tidak sesuai dengan akses Anda.' })
      return
    }

    nextVillageId = group.villageId
  } else if (typeof nextVillageId === 'number' && !authorizedScope.scope.allowedVillageIds.has(nextVillageId)) {
    res.status(400).json({ success: false, message: 'Desa yang dipilih tidak sesuai dengan akses Anda.' })
    return
  }

  if (email) {
    const duplicated = authorizedScope.data.accounts.find(
      (item) => item.id !== id && item.email.toLowerCase() === email.toLowerCase(),
    )

    if (duplicated) {
      res.status(409).json({ success: false, message: 'Email sudah digunakan.' })
      return
    }
  }

  if (fullName) account.fullName = fullName
  if (email) account.email = email
  account.updatedAt = getJakartaTimestamp()

  const profile = memoryStore.upsertProfile({
    userId: account.id,
    groupId: nextGroupId,
    villageId: nextVillageId,
    photoUrl: existingProfile?.photoUrl || null,
    gender: typeof gender === 'string' ? gender || null : existingProfile?.gender || null,
    birthPlace: typeof birthPlace === 'string' ? birthPlace || null : existingProfile?.birthPlace || null,
    birthDate: typeof birthDate === 'string' ? birthDate || null : existingProfile?.birthDate || null,
    address: typeof address === 'string' ? address || null : existingProfile?.address || null,
    phoneNumber: typeof phoneNumber === 'string' ? phoneNumber || null : existingProfile?.phoneNumber || null,
    guardianName: typeof guardianName === 'string' ? guardianName || null : existingProfile?.guardianName || null,
    motherName: typeof motherName === 'string' ? motherName || null : existingProfile?.motherName || null,
    biography: typeof biography === 'string' ? biography || null : existingProfile?.biography || null,
  })

  memoryStore.saveAccount(account)
  await persistStoreToDatabase()

  res.json({ success: true, message: 'Data generus berhasil diperbarui.', user: sanitizeAccount(account), profile })
})

router.post('/users/:id/photo', upload.single('photo'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!authorizeGenerusManagement(req, res)) return
  const authorizedScope = getAuthorizedManagementScope(req, res)
  if (!authorizedScope) return

  const account = authorizedScope.data.accounts.find((item) => item.id === Number(req.params.id) && item.role === 'user')

  if (!account) {
    res.status(404).json({ success: false, message: 'Generus tidak ditemukan.' })
    return
  }

  const existing = authorizedScope.data.profiles.find((item) => item.userId === account.id) || null
  const currentGroupId = existing?.groupId || null
  const currentVillageId = existing?.villageId || null

  if (currentGroupId && !authorizedScope.scope.allowedGroupIds.has(currentGroupId)) {
    res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data generus ini.' })
    return
  }

  if (!currentGroupId && currentVillageId && !authorizedScope.scope.allowedVillageIds.has(currentVillageId)) {
    res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data generus ini.' })
    return
  }

  if (!req.file) {
    res.status(400).json({ success: false, message: 'File foto wajib diunggah.' })
    return
  }

  const profile = memoryStore.upsertProfile({
    userId: account.id,
    groupId: existing?.groupId || null,
    villageId: existing?.villageId || null,
    photoUrl: `/uploads/profiles/${req.file.filename}`,
    gender: existing?.gender || null,
    birthPlace: existing?.birthPlace || null,
    birthDate: existing?.birthDate || null,
    address: existing?.address || null,
    phoneNumber: existing?.phoneNumber || null,
    guardianName: existing?.guardianName || null,
    motherName: existing?.motherName || null,
    biography: existing?.biography || null,
  })
  await persistStoreToDatabase()

  res.json({
    success: true,
    message: 'Foto profil generus berhasil diperbarui.',
    profile,
  })
})

router.put('/users/:id/password', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!authorizeGenerusManagement(req, res)) return
  const authorizedScope = getAuthorizedManagementScope(req, res)
  if (!authorizedScope) return

  const account = authorizedScope.data.accounts.find((item) => item.id === Number(req.params.id) && item.role === 'user')
  const { password } = req.body as { password?: string }

  if (!account) {
    res.status(404).json({ success: false, message: 'Generus tidak ditemukan.' })
    return
  }

  const existing = authorizedScope.data.profiles.find((item) => item.userId === account.id) || null
  const currentGroupId = existing?.groupId || null
  const currentVillageId = existing?.villageId || null

  if (currentGroupId && !authorizedScope.scope.allowedGroupIds.has(currentGroupId)) {
    res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data generus ini.' })
    return
  }

  if (!currentGroupId && currentVillageId && !authorizedScope.scope.allowedVillageIds.has(currentVillageId)) {
    res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data generus ini.' })
    return
  }

  if (!password || password.length < 8) {
    res.status(400).json({ success: false, message: 'Password baru minimal 8 karakter.' })
    return
  }

  account.passwordHash = await bcrypt.hash(password, 10)
  account.updatedAt = getJakartaTimestamp()
  memoryStore.saveAccount(account)
  await persistStoreToDatabase()

  res.json({
    success: true,
    message: 'Password generus berhasil diperbarui.',
  })
})

router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!authorizeGenerusManagement(req, res)) return
  const authorizedScope = getAuthorizedManagementScope(req, res)
  if (!authorizedScope) return

  const userId = Number(req.params.id)
  const account = authorizedScope.data.accounts.find((item) => item.id === userId && item.role === 'user')

  if (!account) {
    res.status(404).json({ success: false, message: 'Generus tidak ditemukan.' })
    return
  }

  const existing = authorizedScope.data.profiles.find((item) => item.userId === account.id) || null
  const currentGroupId = existing?.groupId || null
  const currentVillageId = existing?.villageId || null

  if (currentGroupId && !authorizedScope.scope.allowedGroupIds.has(currentGroupId)) {
    res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data generus ini.' })
    return
  }

  if (!currentGroupId && currentVillageId && !authorizedScope.scope.allowedVillageIds.has(currentVillageId)) {
    res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data generus ini.' })
    return
  }

  authorizedScope.data.accounts = authorizedScope.data.accounts.filter((item) => item.id !== userId)
  authorizedScope.data.profiles = authorizedScope.data.profiles.filter((item) => item.userId !== userId)
  authorizedScope.data.attendances = authorizedScope.data.attendances.filter((item) => item.userId !== userId)
  authorizedScope.data.studyAttendanceEntries = authorizedScope.data.studyAttendanceEntries.filter((item) => item.userId !== userId)
  authorizedScope.data.registrationReviews = authorizedScope.data.registrationReviews.filter((item) => item.userId !== userId)
  await persistStoreToDatabase()

  res.json({ success: true, message: 'Data generus berhasil dihapus.' })
})

router.get('/attendance', (req: AuthenticatedRequest, res: Response): void => {
  const attendances = getUserAttendanceRecords(req.user!.id, memoryStore.getData())
  res.json({ success: true, attendances })
})

export default router
