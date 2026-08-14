import { Router, type Response } from 'express'
import { authenticate, authorize, sanitizeAccount, type AuthenticatedRequest } from '../middleware/auth.js'
import { memoryStore } from '../data/store.js'
import { buildStudyAttendanceRecords, enrichUser } from '../utils/dashboard.js'

const router = Router()

router.use(authenticate, authorize(['teacher', 'admin', 'superadmin']))

router.get('/dashboard', (req: AuthenticatedRequest, res: Response): void => {
  const data = memoryStore.getData()
  const users = data.accounts.filter((item) => item.role === 'user')
  const studyAttendanceRecords = buildStudyAttendanceRecords(data)
  const teacherId = req.user?.id
  const totalCatatan = teacherId ? data.studyAttendanceSessions.filter((session) => session.teacherId === teacherId).length : 0

  res.json({
    success: true,
    stats: [
      {
        label: 'Total Catatan',
        value: String(totalCatatan),
        tone: 'neutral',
      },
    ],
    users: users.map((item) => enrichUser(sanitizeAccount(item), data.profiles)),
    recentAttendances: studyAttendanceRecords.slice(0, 8),
    villages: data.villages,
    groups: data.groups,
    ageGroups: data.ageGroups,
    schedules: data.schedules,
  })
})

router.get('/users', (_req: AuthenticatedRequest, res: Response): void => {
  const data = memoryStore.getData()
  const users = data.accounts.filter((item) => item.role === 'user')
  res.json({
    success: true,
    users: users.map((item) => enrichUser(sanitizeAccount(item), data.profiles)),
  })
})

router.get('/users/:id', (req: AuthenticatedRequest, res: Response): void => {
  const id = Number(req.params.id)
  const data = memoryStore.getData()
  const account = data.accounts.find((item) => item.id === id && item.role === 'user')

  if (!account) {
    res.status(404).json({ success: false, message: 'User tidak ditemukan.' })
    return
  }

  res.json({
    success: true,
    user: enrichUser(sanitizeAccount(account), data.profiles),
    attendances: buildStudyAttendanceRecords(data).filter((item) => item.userId === id),
  })
})

router.post('/attendance', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    message: 'Input absensi lama sudah dihapus. Gunakan fitur Absensi Pengajian untuk mengelola kehadiran.',
  })
})

router.get('/reports/attendance', (req: AuthenticatedRequest, res: Response): void => {
  const { status, userId } = req.query as { status?: string; userId?: string }
  const data = memoryStore.getData()
  const studyAttendanceRecords = buildStudyAttendanceRecords(data)

  const filtered = studyAttendanceRecords.filter((item) => {
    if (status && item.status !== status) return false
    if (userId && item.userId !== Number(userId)) return false
    return true
  })

  res.json({
    success: true,
    total: filtered.length,
    reports: filtered.map((item) => ({
      ...item,
      user: sanitizeAccount(memoryStore.findAccountById(item.userId)!),
      markedByUser: sanitizeAccount(memoryStore.findAccountById(item.markedBy)!),
    })),
  })
})

export default router
