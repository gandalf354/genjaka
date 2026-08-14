import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { Router, type Response } from 'express'
import { authenticate, authorize, sanitizeAccount, type AuthenticatedRequest } from '../middleware/auth.js'
import { memoryStore } from '../data/store.js'
import { persistStoreToDatabase } from '../data/mysqlStore.js'
import { buildAdminStats, buildStudyAttendanceRecords, enrichUser } from '../utils/dashboard.js'
import { getJakartaTimestamp } from '../utils/time.js'
import type { AgeGroup, ApprovalStatus, AttendanceStatus, LandingPageUiTexts, Role, StudySchedule } from '../types.js'

const router = Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const profileUploadDir = path.resolve(__dirname, '../../uploads/profiles')
const activityUploadDir = path.resolve(__dirname, '../../uploads/activities')
const homeUploadDir = path.resolve(__dirname, '../../uploads/home')
fs.mkdirSync(profileUploadDir, { recursive: true })
fs.mkdirSync(activityUploadDir, { recursive: true })
fs.mkdirSync(homeUploadDir, { recursive: true })

const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, profileUploadDir),
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${suffix}${path.extname(file.originalname) || '.jpg'}`)
  },
})

const activityStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, activityUploadDir),
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${suffix}${path.extname(file.originalname) || '.jpg'}`)
  },
})

const homeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, homeUploadDir),
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${suffix}${path.extname(file.originalname) || '.jpg'}`)
  },
})

const uploadProfileImage = multer({ storage: profileStorage })
const uploadActivityImage = multer({ storage: activityStorage })
const uploadHomeImage = multer({ storage: homeStorage })

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

router.use(authenticate, authorize(['admin', 'superadmin']))

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

const getMatchedAgeGroupId = (birthDate: string | null | undefined, referenceDateKey: string, ageGroups: AgeGroup[]) => {
  const age = getAgeFromBirthDate(birthDate, referenceDateKey)
  if (age === null) return null

  return ageGroups.find((item) => age >= item.minAge && (item.maxAge === null || age <= item.maxAge))?.id ?? null
}

const getScheduleParticipants = (schedule: StudySchedule) => {
  const data = memoryStore.getData()
  const group = data.groups.find((item) => item.id === schedule.groupId)
  if (!group) return []

  return data.accounts
    .filter((item) => item.role === 'user' && item.approvalStatus === 'approved' && item.isActive)
    .map((item) => enrichUser(sanitizeAccount(item), data.profiles))
    .filter((user) => {
      const profile = user.profile
      if (!profile) return false

      const matchesScope = profile.groupId === group.id || (!profile.groupId && profile.villageId === group.villageId)
      const matchesAgeGroup = getMatchedAgeGroupId(profile.birthDate, schedule.studyDate, data.ageGroups) === schedule.ageGroupId

      return matchesScope && matchesAgeGroup
    })
}

router.get('/dashboard', (_req: AuthenticatedRequest, res: Response): void => {
  const data = memoryStore.getData()
  const users = data.accounts.filter((item) => item.role === 'user' && item.isActive)
  const teachers = data.accounts.filter((item) => item.role === 'teacher' && item.isActive)
  const pendingUsers = users.filter((item) => item.approvalStatus === 'pending')
  const studyAttendanceRecords = buildStudyAttendanceRecords(data)

  res.json({
    success: true,
    stats: buildAdminStats(users, teachers, pendingUsers, studyAttendanceRecords.length),
    pendingUsers: pendingUsers.map((item) => enrichUser(sanitizeAccount(item), data.profiles)),
    recentAttendances: studyAttendanceRecords.slice(0, 6),
    studyAttendanceSessions: data.studyAttendanceSessions,
    studyAttendanceEntries: data.studyAttendanceEntries,
  })
})

router.post('/study-attendance-sessions', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { scheduleId, teacherId, supervisor1Id, supervisor2Id, supervisor3Id, entries } = req.body as {
    scheduleId?: number
    teacherId?: number | null
    supervisor1Id?: number | null
    supervisor2Id?: number | null
    supervisor3Id?: number | null
    entries?: Array<{ userId: number; status: AttendanceStatus }>
  }

  if (!scheduleId || !Array.isArray(entries)) {
    res.status(400).json({ success: false, message: 'Jadwal dan data absensi wajib diisi.' })
    return
  }

  const data = memoryStore.getData()
  const schedule = data.schedules.find((item) => item.id === Number(scheduleId))
  if (!schedule) {
    res.status(404).json({ success: false, message: 'Jadwal pengajian tidak ditemukan.' })
    return
  }

  const group = data.groups.find((item) => item.id === schedule.groupId)
  const village = group ? data.villages.find((item) => item.id === group.villageId) || null : null

  const normalizeOptionalId = (value: number | null | undefined) => {
    if (value === null || value === undefined) return null
    if (String(value).trim() === '') return null
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue) || numericValue <= 0) return null
    return numericValue
  }

  const normalizedTeacherId = normalizeOptionalId(teacherId)
  const normalizedSupervisor1Id = normalizeOptionalId(supervisor1Id)
  const normalizedSupervisor2Id = normalizeOptionalId(supervisor2Id)
  const normalizedSupervisor3Id = normalizeOptionalId(supervisor3Id)

  const existingSession = data.studyAttendanceSessions.find((item) => item.scheduleId === schedule.id) || null
  const resolvedSupervisor1Id =
    req.user?.role === 'superadmin'
      ? normalizedSupervisor1Id || existingSession?.supervisor1Id || null
      : existingSession?.supervisor1Id || null

  if (resolvedSupervisor1Id) {
    const supervisor1 = data.accounts.find((item) => item.id === resolvedSupervisor1Id && item.role === 'pjp' && item.approvalStatus === 'approved' && item.isActive)
    const supervisor1Profile = data.profiles.find((item) => item.userId === resolvedSupervisor1Id) || null
    if (!supervisor1 || !supervisor1Profile?.groupId || supervisor1Profile.groupId !== schedule.groupId) {
      res.status(400).json({ success: false, message: 'Pengawas 1 harus berasal dari PJP Kelompok yang sesuai.' })
      return
    }
  }

  if (normalizedTeacherId) {
    const teacher = data.accounts.find((item) => item.id === normalizedTeacherId && item.role === 'teacher' && item.approvalStatus === 'approved')
    if (!teacher) {
      res.status(400).json({ success: false, message: 'Pemateri tidak valid.' })
      return
    }
  }

  if (normalizedSupervisor2Id) {
    const supervisor2 = data.accounts.find((item) => item.id === normalizedSupervisor2Id && item.role === 'pjp' && item.approvalStatus === 'approved')
    const profile = data.profiles.find((item) => item.userId === normalizedSupervisor2Id) || null
    if (!supervisor2 || !profile?.villageId || profile.groupId || (village && profile.villageId !== village.id)) {
      res.status(400).json({ success: false, message: 'Pengawas 2 tidak valid.' })
      return
    }
  }

  if (normalizedSupervisor3Id) {
    const supervisor3 = data.accounts.find((item) => item.id === normalizedSupervisor3Id && item.role === 'ppg' && item.approvalStatus === 'approved')
    if (!supervisor3) {
      res.status(400).json({ success: false, message: 'Pengawas 3 tidak valid.' })
      return
    }
  }

  const participants = getScheduleParticipants(schedule)
  if (participants.length === 0) {
    res.status(400).json({ success: false, message: 'Peserta untuk jadwal ini belum tersedia.' })
    return
  }

  const participantIdSet = new Set(participants.map((participant) => participant.id))
  const submittedStatusByUserId = entries.reduce<Map<number, AttendanceStatus>>((mapped, entry) => {
    if (!participantIdSet.has(entry.userId)) return mapped
    mapped.set(entry.userId, entry.status)
    return mapped
  }, new Map())

  const timestamp = getJakartaTimestamp()

  const resolveSupervisor1OrFail = () => {
    if (resolvedSupervisor1Id) return resolvedSupervisor1Id

    const pjpCandidates = data.accounts.filter((item) => item.role === 'pjp' && item.approvalStatus === 'approved' && item.isActive)
    const matchedPjp = pjpCandidates.find((candidate) => {
      const profile = data.profiles.find((item) => item.userId === candidate.id) || null
      return profile?.groupId === schedule.groupId
    })

    return matchedPjp ? matchedPjp.id : null
  }

  const supervisor1FinalId = resolveSupervisor1OrFail()
  if (!supervisor1FinalId) {
    res.status(400).json({ success: false, message: 'Pengawas 1 (PJP Kelompok) untuk kelompok ini belum tersedia.' })
    return
  }

  const session = memoryStore.saveStudyAttendanceSession({
    id: existingSession?.id || memoryStore.nextId(data.studyAttendanceSessions),
    scheduleId: schedule.id,
    teacherId: normalizedTeacherId,
    supervisor1Id: supervisor1FinalId,
    supervisor2Id: normalizedSupervisor2Id,
    supervisor3Id: normalizedSupervisor3Id,
    createdBy: existingSession?.createdBy || req.user!.id,
    createdAt: existingSession?.createdAt || timestamp,
    updatedAt: timestamp,
  })

  data.studyAttendanceEntries = data.studyAttendanceEntries.filter((item) => item.sessionId !== session.id)

  let nextEntryId = memoryStore.nextId(data.studyAttendanceEntries)
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

router.get('/locations', (_req: AuthenticatedRequest, res: Response): void => {
  const data = memoryStore.getData()
  const villages = [...data.villages]
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
    .map((village) => ({
      ...village,
      groups: data.groups
        .filter((group) => group.villageId === village.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    }))

  res.json({
    success: true,
    villages,
    groups: [...data.groups].sort((a, b) => a.name.localeCompare(b.name, 'id')),
  })
})

router.post('/villages', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name } = req.body as { name?: string }
  const trimmedName = name?.trim()

  if (!trimmedName) {
    res.status(400).json({ success: false, message: 'Nama desa wajib diisi.' })
    return
  }

  const existing = memoryStore.getData().villages.find((item) => item.name.toLowerCase() === trimmedName.toLowerCase())
  if (existing) {
    res.status(409).json({ success: false, message: 'Nama desa sudah digunakan.' })
    return
  }

  const timestamp = getJakartaTimestamp()
  const village = memoryStore.saveVillage({
    id: memoryStore.nextId(memoryStore.getData().villages),
    name: trimmedName,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  await persistStoreToDatabase()
  res.status(201).json({ success: true, message: 'Desa berhasil ditambahkan.', village })
})

router.put('/villages/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const villageId = Number(req.params.id)
  const { name } = req.body as { name?: string }
  const trimmedName = name?.trim()
  const village = memoryStore.getData().villages.find((item) => item.id === villageId)

  if (!village) {
    res.status(404).json({ success: false, message: 'Desa tidak ditemukan.' })
    return
  }

  if (!trimmedName) {
    res.status(400).json({ success: false, message: 'Nama desa wajib diisi.' })
    return
  }

  const duplicated = memoryStore.getData().villages.find(
    (item) => item.id !== villageId && item.name.toLowerCase() === trimmedName.toLowerCase(),
  )

  if (duplicated) {
    res.status(409).json({ success: false, message: 'Nama desa sudah digunakan.' })
    return
  }

  village.name = trimmedName
  village.updatedAt = getJakartaTimestamp()
  memoryStore.saveVillage(village)
  await persistStoreToDatabase()

  res.json({ success: true, message: 'Desa berhasil diperbarui.', village })
})

router.delete('/villages/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const villageId = Number(req.params.id)
  const data = memoryStore.getData()
  const village = data.villages.find((item) => item.id === villageId)

  if (!village) {
    res.status(404).json({ success: false, message: 'Desa tidak ditemukan.' })
    return
  }

  data.villages = data.villages.filter((item) => item.id !== villageId)
  data.groups = data.groups.filter((item) => item.villageId !== villageId)
  await persistStoreToDatabase()

  res.json({ success: true, message: 'Desa dan kelompok terkait berhasil dihapus.' })
})

router.post('/groups', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { villageId, name } = req.body as { villageId?: number; name?: string }
  const normalizedVillageId = Number(villageId)
  const trimmedName = name?.trim()
  const village = memoryStore.getData().villages.find((item) => item.id === normalizedVillageId)

  if (!village) {
    res.status(400).json({ success: false, message: 'Desa untuk kelompok wajib dipilih.' })
    return
  }

  if (!trimmedName) {
    res.status(400).json({ success: false, message: 'Nama kelompok wajib diisi.' })
    return
  }

  const existing = memoryStore.getData().groups.find(
    (item) => item.villageId === normalizedVillageId && item.name.toLowerCase() === trimmedName.toLowerCase(),
  )

  if (existing) {
    res.status(409).json({ success: false, message: 'Nama kelompok pada desa ini sudah digunakan.' })
    return
  }

  const timestamp = getJakartaTimestamp()
  const group = memoryStore.saveGroup({
    id: memoryStore.nextId(memoryStore.getData().groups),
    villageId: normalizedVillageId,
    name: trimmedName,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  await persistStoreToDatabase()
  res.status(201).json({ success: true, message: 'Kelompok berhasil ditambahkan.', group })
})

router.put('/groups/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const groupId = Number(req.params.id)
  const { villageId, name } = req.body as { villageId?: number; name?: string }
  const normalizedVillageId = Number(villageId)
  const trimmedName = name?.trim()
  const data = memoryStore.getData()
  const group = data.groups.find((item) => item.id === groupId)

  if (!group) {
    res.status(404).json({ success: false, message: 'Kelompok tidak ditemukan.' })
    return
  }

  const village = data.villages.find((item) => item.id === normalizedVillageId)
  if (!village) {
    res.status(400).json({ success: false, message: 'Desa untuk kelompok wajib dipilih.' })
    return
  }

  if (!trimmedName) {
    res.status(400).json({ success: false, message: 'Nama kelompok wajib diisi.' })
    return
  }

  const duplicated = data.groups.find(
    (item) => item.id !== groupId && item.villageId === normalizedVillageId && item.name.toLowerCase() === trimmedName.toLowerCase(),
  )

  if (duplicated) {
    res.status(409).json({ success: false, message: 'Nama kelompok pada desa ini sudah digunakan.' })
    return
  }

  group.villageId = normalizedVillageId
  group.name = trimmedName
  group.updatedAt = getJakartaTimestamp()
  memoryStore.saveGroup(group)
  await persistStoreToDatabase()

  res.json({ success: true, message: 'Kelompok berhasil diperbarui.', group })
})

router.delete('/groups/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const groupId = Number(req.params.id)
  const data = memoryStore.getData()
  const group = data.groups.find((item) => item.id === groupId)

  if (!group) {
    res.status(404).json({ success: false, message: 'Kelompok tidak ditemukan.' })
    return
  }

  data.groups = data.groups.filter((item) => item.id !== groupId)
  await persistStoreToDatabase()

  res.json({ success: true, message: 'Kelompok berhasil dihapus.' })
})

const sortAgeGroups = (ageGroups: AgeGroup[]) =>
  [...ageGroups].sort((a, b) => a.minAge - b.minAge || (a.maxAge ?? Number.MAX_SAFE_INTEGER) - (b.maxAge ?? Number.MAX_SAFE_INTEGER) || a.id - b.id)

router.get('/age-groups', (_req: AuthenticatedRequest, res: Response): void => {
  res.json({
    success: true,
    ageGroups: sortAgeGroups(memoryStore.getData().ageGroups),
  })
})

const normalizeAgeGroupPayload = (payload: Partial<AgeGroup> & { name?: string; minAge?: number; maxAge?: number | null }) => {
  const name = payload.name?.trim()
  const minAge = Number(payload.minAge)
  const rawMaxAge = payload.maxAge
  const maxAge =
    rawMaxAge === null || rawMaxAge === undefined || String(rawMaxAge).trim() === '' ? null : Number(rawMaxAge)

  return { name, minAge, maxAge }
}

router.post('/age-groups', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, minAge, maxAge } = normalizeAgeGroupPayload(req.body)

  if (!name) {
    res.status(400).json({ success: false, message: 'Nama kelompok usia wajib diisi.' })
    return
  }

  if (!Number.isFinite(minAge) || minAge < 0) {
    res.status(400).json({ success: false, message: 'Usia minimal wajib berupa angka 0 atau lebih.' })
    return
  }

  if (maxAge !== null && (!Number.isFinite(maxAge) || maxAge < minAge)) {
    res.status(400).json({ success: false, message: 'Usia maksimal harus kosong atau lebih besar dari usia minimal.' })
    return
  }

  const duplicated = memoryStore.getData().ageGroups.find((item) => item.name.toLowerCase() === name.toLowerCase())
  if (duplicated) {
    res.status(409).json({ success: false, message: 'Nama kelompok usia sudah digunakan.' })
    return
  }

  const timestamp = getJakartaTimestamp()
  const ageGroup = memoryStore.saveAgeGroup({
    id: memoryStore.nextId(memoryStore.getData().ageGroups),
    name,
    minAge,
    maxAge,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  await persistStoreToDatabase()
  res.status(201).json({ success: true, message: 'Kelompok usia berhasil ditambahkan.', ageGroup })
})

router.put('/age-groups/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const ageGroupId = Number(req.params.id)
  const ageGroup = memoryStore.getData().ageGroups.find((item) => item.id === ageGroupId)

  if (!ageGroup) {
    res.status(404).json({ success: false, message: 'Kelompok usia tidak ditemukan.' })
    return
  }

  const { name, minAge, maxAge } = normalizeAgeGroupPayload(req.body)

  if (!name) {
    res.status(400).json({ success: false, message: 'Nama kelompok usia wajib diisi.' })
    return
  }

  if (!Number.isFinite(minAge) || minAge < 0) {
    res.status(400).json({ success: false, message: 'Usia minimal wajib berupa angka 0 atau lebih.' })
    return
  }

  if (maxAge !== null && (!Number.isFinite(maxAge) || maxAge < minAge)) {
    res.status(400).json({ success: false, message: 'Usia maksimal harus kosong atau lebih besar dari usia minimal.' })
    return
  }

  const duplicated = memoryStore.getData().ageGroups.find((item) => item.id !== ageGroupId && item.name.toLowerCase() === name.toLowerCase())
  if (duplicated) {
    res.status(409).json({ success: false, message: 'Nama kelompok usia sudah digunakan.' })
    return
  }

  ageGroup.name = name
  ageGroup.minAge = minAge
  ageGroup.maxAge = maxAge
  ageGroup.updatedAt = getJakartaTimestamp()
  memoryStore.saveAgeGroup(ageGroup)

  await persistStoreToDatabase()
  res.json({ success: true, message: 'Kelompok usia berhasil diperbarui.', ageGroup })
})

router.delete('/age-groups/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const ageGroupId = Number(req.params.id)
  const data = memoryStore.getData()
  const ageGroup = data.ageGroups.find((item) => item.id === ageGroupId)

  if (!ageGroup) {
    res.status(404).json({ success: false, message: 'Kelompok usia tidak ditemukan.' })
    return
  }

  data.ageGroups = data.ageGroups.filter((item) => item.id !== ageGroupId)
  await persistStoreToDatabase()

  res.json({ success: true, message: 'Kelompok usia berhasil dihapus.' })
})

router.get('/study-schedules', (_req: AuthenticatedRequest, res: Response): void => {
  const schedules = [...memoryStore.getData().schedules].sort(
    (a, b) => a.studyDate.localeCompare(b.studyDate) || a.startTime.localeCompare(b.startTime) || a.id - b.id,
  )

  res.json({ success: true, schedules })
})

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

router.post('/study-schedules', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { normalizedGroupId, normalizedAgeGroupId, studyName, studyDate, startTime, endTime } = normalizeSchedulePayload(req.body)
  const groupExists = memoryStore.getData().groups.some((item) => item.id === normalizedGroupId)
  const ageGroupExists = normalizedAgeGroupId !== null && memoryStore.getData().ageGroups.some((item) => item.id === normalizedAgeGroupId)

  if (!groupExists) {
    res.status(400).json({ success: false, message: 'Kelompok jadwal pengajian wajib dipilih.' })
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

router.put('/study-schedules/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const scheduleId = Number(req.params.id)
  const schedule = memoryStore.getData().schedules.find((item) => item.id === scheduleId)

  if (!schedule) {
    res.status(404).json({ success: false, message: 'Jadwal pengajian tidak ditemukan.' })
    return
  }

  const { normalizedGroupId, normalizedAgeGroupId, studyName, studyDate, startTime, endTime } = normalizeSchedulePayload(req.body)
  const groupExists = memoryStore.getData().groups.some((item) => item.id === normalizedGroupId)
  const ageGroupExists = normalizedAgeGroupId !== null && memoryStore.getData().ageGroups.some((item) => item.id === normalizedAgeGroupId)

  if (!groupExists) {
    res.status(400).json({ success: false, message: 'Kelompok jadwal pengajian wajib dipilih.' })
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
  const scheduleId = Number(req.params.id)
  const data = memoryStore.getData()
  const schedule = data.schedules.find((item) => item.id === scheduleId)

  if (!schedule) {
    res.status(404).json({ success: false, message: 'Jadwal pengajian tidak ditemukan.' })
    return
  }

  data.schedules = data.schedules.filter((item) => item.id !== scheduleId)
  await persistStoreToDatabase()

  res.json({ success: true, message: 'Jadwal pengajian berhasil dihapus.' })
})

router.get('/users', (_req: AuthenticatedRequest, res: Response): void => {
  const data = memoryStore.getData()
  const users = data.accounts.filter((item) => item.role === 'user')
  res.json({
    success: true,
    users: users.map((item) => enrichUser(sanitizeAccount(item), data.profiles)),
  })
})

router.post('/users', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    message: 'User berhasil ditambahkan.',
    user: sanitizeAccount(account),
  })
})

router.put('/users/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id)
  const {
    fullName,
    email,
    approvalStatus,
    isActive,
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
    approvalStatus?: ApprovalStatus
    isActive?: boolean
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

  const account = memoryStore.getData().accounts.find((item) => item.id === id && item.role === 'user')

  if (!account) {
    res.status(404).json({ success: false, message: 'User tidak ditemukan.' })
    return
  }

  if (typeof groupId === 'number' && Number.isFinite(groupId)) {
    const groupExists = memoryStore.getData().groups.some((item) => item.id === groupId)

    if (!groupExists) {
      res.status(400).json({ success: false, message: 'Kelompok yang dipilih tidak ditemukan.' })
      return
    }
  }

  if (fullName) account.fullName = fullName
  if (email) account.email = email
  if (approvalStatus) account.approvalStatus = approvalStatus
  if (typeof isActive === 'boolean') account.isActive = isActive
  account.updatedAt = getJakartaTimestamp()

  const existingProfile = memoryStore.getData().profiles.find((item) => item.userId === account.id)
  const profile = memoryStore.upsertProfile({
    userId: account.id,
    groupId: groupId === null ? null : typeof groupId === 'number' && Number.isFinite(groupId) ? groupId : existingProfile?.groupId || null,
    villageId: villageId === null ? null : typeof villageId === 'number' && Number.isFinite(villageId) ? villageId : existingProfile?.villageId || null,
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
  res.json({ success: true, message: 'Data user berhasil diperbarui.', user: sanitizeAccount(account), profile })
})

router.post('/users/:id/photo', uploadProfileImage.single('photo'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = memoryStore.getData().accounts.find((item) => item.id === Number(req.params.id) && item.role === 'user')

  if (!account) {
    res.status(404).json({ success: false, message: 'User tidak ditemukan.' })
    return
  }

  if (!req.file) {
    res.status(400).json({ success: false, message: 'File foto wajib diunggah.' })
    return
  }

  const existing = memoryStore.getData().profiles.find((item) => item.userId === account.id)
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
  const account = memoryStore.getData().accounts.find((item) => item.id === Number(req.params.id) && item.role === 'user')
  const { password } = req.body as { password?: string }

  if (!account) {
    res.status(404).json({ success: false, message: 'User tidak ditemukan.' })
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
  const data = memoryStore.getData()
  const userId = Number(req.params.id)
  const account = data.accounts.find((item) => item.id === userId && item.role === 'user')

  if (!account) {
    res.status(404).json({ success: false, message: 'User tidak ditemukan.' })
    return
  }

  data.accounts = data.accounts.filter((item) => item.id !== userId)
  data.profiles = data.profiles.filter((item) => item.userId !== userId)
  data.attendances = data.attendances.filter((item) => item.userId !== userId)
  data.studyAttendanceEntries = data.studyAttendanceEntries.filter((item) => item.userId !== userId)
  data.registrationReviews = data.registrationReviews.filter((item) => item.userId !== userId)
  await persistStoreToDatabase()
  res.json({ success: true, message: 'Data generus berhasil dihapus.' })
})

router.get('/ppg', (_req: AuthenticatedRequest, res: Response): void => {
  const data = memoryStore.getData()
  const ppgs = data.accounts.filter((item) => item.role === 'ppg')
  res.json({
    success: true,
    ppgs: ppgs.map((item) => enrichUser(sanitizeAccount(item), data.profiles)),
  })
})

router.post('/ppg', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { fullName, email, password = 'ppg12345' } = req.body as Record<string, string>

  if (!fullName || !email) {
    res.status(400).json({ success: false, message: 'Nama lengkap dan email wajib diisi.' })
    return
  }

  if (memoryStore.findAccountByEmail(email)) {
    res.status(409).json({ success: false, message: 'Email sudah digunakan.' })
    return
  }

  const account = await createAccount({ fullName, email, role: 'ppg', password })
  await persistStoreToDatabase()

  res.status(201).json({
    success: true,
    message: 'Data PPG berhasil ditambahkan.',
    ppg: sanitizeAccount(account),
  })
})

router.put('/ppg/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id)
  const {
    fullName,
    email,
    approvalStatus,
    isActive,
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
    approvalStatus?: ApprovalStatus
    isActive?: boolean
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

  const account = memoryStore.getData().accounts.find((item) => item.id === id && item.role === 'ppg')

  if (!account) {
    res.status(404).json({ success: false, message: 'Data PPG tidak ditemukan.' })
    return
  }

  if (typeof villageId === 'number' && Number.isFinite(villageId)) {
    const villageExists = memoryStore.getData().villages.some((item) => item.id === villageId)

    if (!villageExists) {
      res.status(400).json({ success: false, message: 'Desa yang dipilih tidak ditemukan.' })
      return
    }
  }

  if (fullName) account.fullName = fullName
  if (email) account.email = email
  if (approvalStatus) account.approvalStatus = approvalStatus
  if (typeof isActive === 'boolean') account.isActive = isActive
  account.updatedAt = getJakartaTimestamp()

  const existingProfile = memoryStore.getData().profiles.find((item) => item.userId === account.id)
  const profile = memoryStore.upsertProfile({
    userId: account.id,
    groupId: existingProfile?.groupId || null,
    villageId: villageId === null ? null : typeof villageId === 'number' && Number.isFinite(villageId) ? villageId : existingProfile?.villageId || null,
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
  res.json({ success: true, message: 'Data PPG berhasil diperbarui.', ppg: sanitizeAccount(account), profile })
})

router.post('/ppg/:id/photo', uploadProfileImage.single('photo'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = memoryStore.getData().accounts.find((item) => item.id === Number(req.params.id) && item.role === 'ppg')

  if (!account) {
    res.status(404).json({ success: false, message: 'Data PPG tidak ditemukan.' })
    return
  }

  if (!req.file) {
    res.status(400).json({ success: false, message: 'File foto wajib diunggah.' })
    return
  }

  const existing = memoryStore.getData().profiles.find((item) => item.userId === account.id)
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
    message: 'Foto profil PPG berhasil diperbarui.',
    profile,
  })
})

router.put('/ppg/:id/password', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = memoryStore.getData().accounts.find((item) => item.id === Number(req.params.id) && item.role === 'ppg')
  const { password } = req.body as { password?: string }

  if (!account) {
    res.status(404).json({ success: false, message: 'Data PPG tidak ditemukan.' })
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
    message: 'Password PPG berhasil diperbarui.',
  })
})

router.delete('/ppg/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = memoryStore.getData()
  const ppgId = Number(req.params.id)
  const account = data.accounts.find((item) => item.id === ppgId && item.role === 'ppg')

  if (!account) {
    res.status(404).json({ success: false, message: 'Data PPG tidak ditemukan.' })
    return
  }

  data.accounts = data.accounts.filter((item) => item.id !== ppgId)
  data.profiles = data.profiles.filter((item) => item.userId !== ppgId)
  data.attendances = data.attendances.filter((item) => item.userId !== ppgId)
  data.studyAttendanceSessions = data.studyAttendanceSessions.map((item) =>
    item.supervisor3Id === ppgId ? { ...item, supervisor3Id: null } : item,
  )
  await persistStoreToDatabase()
  res.json({ success: true, message: 'Data PPG berhasil dihapus.' })
})

router.get('/pjp', (_req: AuthenticatedRequest, res: Response): void => {
  const data = memoryStore.getData()
  const pjps = data.accounts.filter((item) => item.role === 'pjp')
  res.json({
    success: true,
    pjps: pjps.map((item) => enrichUser(sanitizeAccount(item), data.profiles)),
  })
})

router.post('/pjp', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { fullName, email, password = 'pjp12345' } = req.body as Record<string, string>

  if (!fullName || !email) {
    res.status(400).json({ success: false, message: 'Nama lengkap dan email wajib diisi.' })
    return
  }

  if (memoryStore.findAccountByEmail(email)) {
    res.status(409).json({ success: false, message: 'Email sudah digunakan.' })
    return
  }

  const account = await createAccount({ fullName, email, role: 'pjp', password })
  await persistStoreToDatabase()

  res.status(201).json({
    success: true,
    message: 'Data PJP Kelompok berhasil ditambahkan.',
    pjp: sanitizeAccount(account),
  })
})

router.put('/pjp/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id)
  const {
    fullName,
    email,
    approvalStatus,
    isActive,
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
    approvalStatus?: ApprovalStatus
    isActive?: boolean
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

  const account = memoryStore.getData().accounts.find((item) => item.id === id && item.role === 'pjp')

  if (!account) {
    res.status(404).json({ success: false, message: 'Data PJP tidak ditemukan.' })
    return
  }

  if (typeof groupId === 'number' && Number.isFinite(groupId)) {
    const groupExists = memoryStore.getData().groups.some((item) => item.id === groupId)

    if (!groupExists) {
      res.status(400).json({ success: false, message: 'Kelompok yang dipilih tidak ditemukan.' })
      return
    }
  }

  if (typeof villageId === 'number' && Number.isFinite(villageId)) {
    const villageExists = memoryStore.getData().villages.some((item) => item.id === villageId)

    if (!villageExists) {
      res.status(400).json({ success: false, message: 'Desa yang dipilih tidak ditemukan.' })
      return
    }
  }

  if (fullName) account.fullName = fullName
  if (email) account.email = email
  if (approvalStatus) account.approvalStatus = approvalStatus
  if (typeof isActive === 'boolean') account.isActive = isActive
  account.updatedAt = getJakartaTimestamp()

  const existingProfile = memoryStore.getData().profiles.find((item) => item.userId === account.id)
  const profile = memoryStore.upsertProfile({
    userId: account.id,
    groupId: groupId === null ? null : typeof groupId === 'number' && Number.isFinite(groupId) ? groupId : existingProfile?.groupId || null,
      villageId: villageId === null ? null : typeof villageId === 'number' && Number.isFinite(villageId) ? villageId : existingProfile?.villageId || null,
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
  res.json({ success: true, message: 'Data PJP berhasil diperbarui.', pjp: sanitizeAccount(account), profile })
})

router.post('/pjp/:id/photo', uploadProfileImage.single('photo'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = memoryStore.getData().accounts.find((item) => item.id === Number(req.params.id) && item.role === 'pjp')

  if (!account) {
    res.status(404).json({ success: false, message: 'Data PJP tidak ditemukan.' })
    return
  }

  if (!req.file) {
    res.status(400).json({ success: false, message: 'File foto wajib diunggah.' })
    return
  }

  const existing = memoryStore.getData().profiles.find((item) => item.userId === account.id)
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
    message: 'Foto profil PJP berhasil diperbarui.',
    profile,
  })
})

router.put('/pjp/:id/password', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = memoryStore.getData().accounts.find((item) => item.id === Number(req.params.id) && item.role === 'pjp')
  const { password } = req.body as { password?: string }

  if (!account) {
    res.status(404).json({ success: false, message: 'Data PJP tidak ditemukan.' })
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
    message: 'Password PJP berhasil diperbarui.',
  })
})

router.delete('/pjp/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = memoryStore.getData()
  const pjpId = Number(req.params.id)
  const account = data.accounts.find((item) => item.id === pjpId && item.role === 'pjp')

  if (!account) {
    res.status(404).json({ success: false, message: 'Data PJP tidak ditemukan.' })
    return
  }

  data.accounts = data.accounts.filter((item) => item.id !== pjpId)
  data.profiles = data.profiles.filter((item) => item.userId !== pjpId)
  data.attendances = data.attendances.filter((item) => item.userId !== pjpId)
  data.studyAttendanceSessions = data.studyAttendanceSessions.map((item) => ({
    ...item,
    supervisor1Id: item.supervisor1Id === pjpId ? req.user!.id : item.supervisor1Id,
    supervisor2Id: item.supervisor2Id === pjpId ? null : item.supervisor2Id,
  }))
  await persistStoreToDatabase()
  res.json({ success: true, message: 'Data PJP Kelompok berhasil dihapus.' })
})

router.get('/teachers', (_req: AuthenticatedRequest, res: Response): void => {
  const teachers = memoryStore.getData().accounts.filter((item) => item.role === 'teacher')
  res.json({ success: true, teachers: teachers.map((item) => enrichUser(sanitizeAccount(item), memoryStore.getData().profiles)) })
})

router.post('/teachers', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { fullName, email, password = 'guru12345' } = req.body as Record<string, string>

  if (!fullName || !email) {
    res.status(400).json({ success: false, message: 'Nama lengkap dan email wajib diisi.' })
    return
  }

  if (memoryStore.findAccountByEmail(email)) {
    res.status(409).json({ success: false, message: 'Email sudah digunakan.' })
    return
  }

  const account = await createAccount({ fullName, email, role: 'teacher', password })
  await persistStoreToDatabase()
  res.status(201).json({ success: true, message: 'Dewan Guru berhasil ditambahkan.', teacher: sanitizeAccount(account) })
})

router.put('/teachers/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = memoryStore.getData().accounts.find((item) => item.id === Number(req.params.id) && item.role === 'teacher')

  if (!account) {
    res.status(404).json({ success: false, message: 'Dewan Guru tidak ditemukan.' })
    return
  }

  const {
    fullName,
    email,
    isActive,
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
    isActive?: boolean
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
  if (fullName) account.fullName = fullName
  if (email) account.email = email
  if (typeof isActive === 'boolean') account.isActive = isActive
  account.updatedAt = getJakartaTimestamp()

  const existingProfile = memoryStore.getData().profiles.find((item) => item.userId === account.id)
  const profile = memoryStore.upsertProfile({
    userId: account.id,
    groupId: groupId === null ? null : typeof groupId === 'number' && Number.isFinite(groupId) ? groupId : existingProfile?.groupId || null,
    villageId: villageId === null ? null : typeof villageId === 'number' && Number.isFinite(villageId) ? villageId : existingProfile?.villageId || null,
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

  res.json({ success: true, message: 'Data Dewan Guru berhasil diperbarui.', teacher: sanitizeAccount(account), profile })
})

router.post('/teachers/:id/photo', uploadProfileImage.single('photo'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = memoryStore.getData().accounts.find((item) => item.id === Number(req.params.id) && item.role === 'teacher')

  if (!account) {
    res.status(404).json({ success: false, message: 'Dewan Guru tidak ditemukan.' })
    return
  }

  if (!req.file) {
    res.status(400).json({ success: false, message: 'File foto wajib diunggah.' })
    return
  }

  const existing = memoryStore.getData().profiles.find((item) => item.userId === account.id)
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
    message: 'Foto profil dewan guru berhasil diperbarui.',
    profile,
  })
})

router.put('/teachers/:id/password', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = memoryStore.getData().accounts.find((item) => item.id === Number(req.params.id) && item.role === 'teacher')
  const { password } = req.body as { password?: string }

  if (!account) {
    res.status(404).json({ success: false, message: 'Dewan Guru tidak ditemukan.' })
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
    message: 'Password dewan guru berhasil diperbarui.',
  })
})

router.delete('/teachers/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = memoryStore.getData().accounts.find((item) => item.id === Number(req.params.id) && item.role === 'teacher')

  if (!account) {
    res.status(404).json({ success: false, message: 'Dewan Guru tidak ditemukan.' })
    return
  }

  const data = memoryStore.getData()
  data.attendances = data.attendances.map((item) => (item.markedBy === account.id ? { ...item, markedBy: req.user!.id } : item))
  data.studyAttendanceSessions = data.studyAttendanceSessions.map((item) =>
    item.teacherId === account.id ? { ...item, teacherId: null } : item,
  )
  data.accounts = data.accounts.filter((item) => item.id !== account.id)
  data.profiles = data.profiles.filter((item) => item.userId !== account.id)
  await persistStoreToDatabase()
  res.json({ success: true, message: 'Data dewan guru berhasil dihapus.' })
})

router.get('/registrations', (_req: AuthenticatedRequest, res: Response): void => {
  const data = memoryStore.getData()
  const pendingUsers = data.accounts.filter((item) => item.role === 'user' && item.approvalStatus === 'pending')
  res.json({ success: true, registrations: pendingUsers.map((item) => enrichUser(sanitizeAccount(item), data.profiles)) })
})

router.post('/registrations/:id/:decision', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = memoryStore.getData().accounts.find((item) => item.id === Number(req.params.id) && item.role === 'user')
  const decision = req.params.decision as 'approve' | 'reject'
  const note = (req.body as { note?: string }).note || null

  if (!account) {
    res.status(404).json({ success: false, message: 'Registrasi tidak ditemukan.' })
    return
  }

  account.approvalStatus = decision === 'approve' ? 'approved' : 'rejected'
  account.updatedAt = getJakartaTimestamp()
  memoryStore.saveAccount(account)
  memoryStore.saveRegistrationReview({
    id: memoryStore.nextId(memoryStore.getData().registrationReviews),
    userId: account.id,
    reviewedBy: req.user!.id,
    decision: decision === 'approve' ? 'approved' : 'rejected',
    note,
    reviewedAt: getJakartaTimestamp(),
  })
  await persistStoreToDatabase()

  res.json({
    success: true,
    message: decision === 'approve' ? 'Registrasi berhasil disetujui.' : 'Registrasi berhasil ditolak.',
    user: sanitizeAccount(account),
  })
})

router.get('/attendance', (_req: AuthenticatedRequest, res: Response): void => {
  const data = memoryStore.getData()
  const records = buildStudyAttendanceRecords(data).map((item) => ({
    ...item,
    user: sanitizeAccount(memoryStore.findAccountById(item.userId)!),
  }))
  res.json({ success: true, attendances: records })
})

router.put('/attendance/:id', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    message: 'Manajemen absensi lama sudah dihapus. Gunakan fitur Absensi Pengajian untuk memperbarui data.',
  })
})

router.delete('/attendance/:id', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    message: 'Manajemen absensi lama sudah dihapus. Gunakan fitur Absensi Pengajian untuk mengelola data.',
  })
})

router.get('/landing-page', (_req: AuthenticatedRequest, res: Response): void => {
  res.json({ success: true, content: memoryStore.getData().landingPage })
})

const getPeriodYearStart = (value: string) => {
  const matches = String(value || '').match(/\b(19|20)\d{2}\b/g)
  if (!matches || matches.length === 0) return null
  const numeric = Number(matches[0])
  return Number.isFinite(numeric) ? numeric : null
}

router.get('/owner-biography', (_req: AuthenticatedRequest, res: Response): void => {
  const data = memoryStore.getData()
  if (!data.ownerBiography.visibleToAdmin) {
    res.status(404).json({ success: false, message: 'Biografi Owner tidak tersedia untuk Admin.' })
    return
  }
  res.json({
    success: true,
    biography: data.ownerBiography,
    histories: [...data.ownerWorkHistories].sort((a, b) => {
      const leftYear = getPeriodYearStart(a.periodYear)
      const rightYear = getPeriodYearStart(b.periodYear)
      if (leftYear !== null && rightYear !== null && leftYear !== rightYear) return rightYear - leftYear
      if (leftYear !== null && rightYear === null) return -1
      if (leftYear === null && rightYear !== null) return 1
      const periodCompare = String(b.periodYear || '').localeCompare(String(a.periodYear || ''), 'id-ID')
      if (periodCompare !== 0) return periodCompare
      return a.id - b.id
    }),
  })
})

router.post(
  '/landing-page/home/upload',
  uploadHomeImage.single('photo'),
  (req: AuthenticatedRequest, res: Response): void => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'File foto home wajib diunggah.' })
      return
    }

    res.json({
      success: true,
      message: 'Foto home berhasil diunggah.',
      fileUrl: `/uploads/home/${req.file.filename}`,
    })
  },
)

router.post(
  '/landing-page/activities/upload',
  uploadActivityImage.single('photo'),
  (req: AuthenticatedRequest, res: Response): void => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'File foto kegiatan wajib diunggah.' })
      return
    }

    res.json({
      success: true,
      message: 'Foto kegiatan berhasil diunggah.',
      fileUrl: `/uploads/activities/${req.file.filename}`,
    })
  },
)

const normalizeLandingPageUiTexts = (payload: unknown, current: LandingPageUiTexts): LandingPageUiTexts => {
  if (!payload || typeof payload !== 'object') return current

  const record = payload as Record<string, unknown>
  const next = { ...current } as LandingPageUiTexts
  const keys: Array<keyof LandingPageUiTexts> = [
    'headerBrandName',
    'headerTagline',
    'headerLogoAlt',
    'navHomeLabel',
    'navVisionLabel',
    'navMissionLabel',
    'navActivitiesLabel',
    'navContactLabel',
    'headerLoginLabel',
    'headerRegisterLabel',
    'heroPrimaryButtonLabel',
    'heroSecondaryButtonLabel',
    'heroImageAlt',
    'heroImagePlaceholderText',
    'visionHeadingTitle',
    'visionHeadingDescription',
    'missionHeadingTitle',
    'missionHeadingDescription',
    'activitiesHeadingTitle',
    'activitiesHeadingDescription',
    'contactHeadingTitle',
    'contactHeadingDescription',
    'socialMediaTitle',
  ]

  for (const key of keys) {
    const value = record[key as string]
    if (typeof value === 'string') {
      next[key] = value as never
    }
  }

  if (Array.isArray(record.highlights)) {
    next.highlights = record.highlights.map((item) => ({
      label: String((item as { label?: unknown }).label || ''),
      value: String((item as { value?: unknown }).value || ''),
    }))
  }

  return next
}

router.put('/landing-page', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = memoryStore.getData()
  const {
    heroTitle,
    heroSubtitle,
    heroBadge,
    heroImageUrl,
    visionText,
    missionItems,
    contactAddress,
    contactPhone,
    contactEmail,
    instagramUrl,
    facebookUrl,
    tiktokUrl,
    activities,
    ui,
  } =
    req.body as Record<string, unknown>

  data.landingPage = {
    heroTitle: typeof heroTitle === 'string' ? heroTitle : data.landingPage.heroTitle,
    heroSubtitle: typeof heroSubtitle === 'string' ? heroSubtitle : data.landingPage.heroSubtitle,
    heroBadge: typeof heroBadge === 'string' ? heroBadge : data.landingPage.heroBadge,
    heroImageUrl: typeof heroImageUrl === 'string' ? heroImageUrl : data.landingPage.heroImageUrl,
    visionText: typeof visionText === 'string' ? visionText : data.landingPage.visionText,
    missionItems: Array.isArray(missionItems)
      ? missionItems.map((item) => String(item)).filter(Boolean)
      : data.landingPage.missionItems,
    contactAddress: typeof contactAddress === 'string' ? contactAddress : data.landingPage.contactAddress,
    contactPhone: typeof contactPhone === 'string' ? contactPhone : data.landingPage.contactPhone,
    contactEmail: typeof contactEmail === 'string' ? contactEmail : data.landingPage.contactEmail,
    instagramUrl: typeof instagramUrl === 'string' ? instagramUrl : data.landingPage.instagramUrl,
    facebookUrl: typeof facebookUrl === 'string' ? facebookUrl : data.landingPage.facebookUrl,
    tiktokUrl: typeof tiktokUrl === 'string' ? tiktokUrl : data.landingPage.tiktokUrl,
    ui: normalizeLandingPageUiTexts(ui, data.landingPage.ui),
    activities: Array.isArray(activities)
      ? activities.map((item, index) => ({
          id: Number((item as { id?: number }).id) || index + 1,
          title: String((item as { title?: string }).title || ''),
          description: String((item as { description?: string }).description || ''),
          imageUrl: String((item as { imageUrl?: string }).imageUrl || ''),
          sortOrder: Number((item as { sortOrder?: number }).sortOrder) || index + 1,
        }))
      : data.landingPage.activities,
  }
  await persistStoreToDatabase()

  res.json({ success: true, message: 'Konten landing page berhasil diperbarui.', content: data.landingPage })
})

export default router
