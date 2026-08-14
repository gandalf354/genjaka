import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { Router, type Response } from 'express'
import { authenticate, authorize, sanitizeAccount, type AuthenticatedRequest } from '../middleware/auth.js'
import { memoryStore } from '../data/store.js'
import { persistStoreToDatabase } from '../data/mysqlStore.js'
import { getJakartaTimestamp } from '../utils/time.js'

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ownerUploadDir = path.resolve(__dirname, '../../uploads/owner')
fs.mkdirSync(ownerUploadDir, { recursive: true })

const ownerPhotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ownerUploadDir),
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${suffix}${path.extname(file.originalname) || '.jpg'}`)
  },
})

const uploadOwnerPhoto = multer({ storage: ownerPhotoStorage })

router.use(authenticate, authorize(['superadmin']))

const getPeriodYearStart = (value: string) => {
  const matches = String(value || '').match(/\b(19|20)\d{2}\b/g)
  if (!matches || matches.length === 0) return null
  const numeric = Number(matches[0])
  return Number.isFinite(numeric) ? numeric : null
}

router.get('/dashboard', (_req: AuthenticatedRequest, res: Response): void => {
  const admins = memoryStore.getData().accounts.filter((item) => item.role === 'admin')
  res.json({
    success: true,
    stats: [
      { label: 'Admin Aktif', value: String(admins.filter((item) => item.isActive).length), tone: 'success' },
      { label: 'Total Admin', value: String(admins.length), tone: 'neutral' },
    ],
    admins: admins.map((item) => sanitizeAccount(item)),
  })
})

router.get('/admins', (_req: AuthenticatedRequest, res: Response): void => {
  const admins = memoryStore.getData().accounts.filter((item) => item.role === 'admin')
  res.json({ success: true, admins: admins.map((item) => sanitizeAccount(item)) })
})

router.post('/admins', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { fullName, email, password = 'admin12345' } = req.body as Record<string, string>

  if (!fullName || !email) {
    res.status(400).json({ success: false, message: 'Nama lengkap dan email wajib diisi.' })
    return
  }

  if (memoryStore.findAccountByEmail(email)) {
    res.status(409).json({ success: false, message: 'Email sudah digunakan.' })
    return
  }

  const data = memoryStore.getData()
  const timestamp = getJakartaTimestamp()
  const account = memoryStore.saveAccount({
    id: memoryStore.nextId(data.accounts),
    fullName,
    email,
    role: 'admin',
    passwordHash: await bcrypt.hash(password, 10),
    approvalStatus: 'approved',
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await persistStoreToDatabase()

  res.status(201).json({ success: true, message: 'Admin berhasil ditambahkan.', admin: sanitizeAccount(account) })
})

router.put('/admins/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = memoryStore.getData().accounts.find((item) => item.id === Number(req.params.id) && item.role === 'admin')

  if (!account) {
    res.status(404).json({ success: false, message: 'Admin tidak ditemukan.' })
    return
  }

  const { fullName, email, isActive } = req.body as { fullName?: string; email?: string; isActive?: boolean }
  if (fullName) account.fullName = fullName
  if (email) account.email = email
  if (typeof isActive === 'boolean') account.isActive = isActive
  account.updatedAt = getJakartaTimestamp()
  memoryStore.saveAccount(account)
  await persistStoreToDatabase()

  res.json({ success: true, message: 'Data admin berhasil diperbarui.', admin: sanitizeAccount(account) })
})

router.delete('/admins/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = memoryStore.getData().accounts.find((item) => item.id === Number(req.params.id) && item.role === 'admin')

  if (!account) {
    res.status(404).json({ success: false, message: 'Admin tidak ditemukan.' })
    return
  }

  account.isActive = false
  account.updatedAt = getJakartaTimestamp()
  memoryStore.saveAccount(account)
  await persistStoreToDatabase()

  res.json({ success: true, message: 'Admin berhasil dinonaktifkan.' })
})

router.get('/owner-biography', (_req: AuthenticatedRequest, res: Response): void => {
  const data = memoryStore.getData()
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

router.put('/owner-biography', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { fullName, birthPlace, birthDate, address, phoneNumber, visibleToAdmin } = req.body as Record<string, unknown>

  const data = memoryStore.getData()
  const updated = memoryStore.saveOwnerBiography({
    id: 1,
    fullName: String(fullName || '').trim(),
    birthPlace: String(birthPlace || '').trim(),
    birthDate: String(birthDate || '').trim(),
    address: String(address || '').trim(),
    phoneNumber: String(phoneNumber || '').trim(),
    photoUrl: data.ownerBiography.photoUrl,
    visibleToAdmin: typeof visibleToAdmin === 'boolean' ? visibleToAdmin : data.ownerBiography.visibleToAdmin,
    updatedAt: getJakartaTimestamp(),
  })
  await persistStoreToDatabase()

  res.json({ success: true, message: 'Biografi Owner berhasil disimpan.', biography: updated })
})

router.post(
  '/owner-biography/photo',
  uploadOwnerPhoto.single('photo'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'File foto owner wajib diunggah.' })
      return
    }

    const fileUrl = `/uploads/owner/${req.file.filename}`
    const data = memoryStore.getData()
    const updated = memoryStore.saveOwnerBiography({
      ...data.ownerBiography,
      photoUrl: fileUrl,
      updatedAt: getJakartaTimestamp(),
    })
    await persistStoreToDatabase()

    res.json({ success: true, message: 'Foto owner berhasil diunggah.', fileUrl, biography: updated })
  },
)

router.post('/owner-work-histories', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { periodYear, positionTitle, jobTitle } = req.body as Record<string, string>

  if (!String(periodYear || '').trim() || !String(positionTitle || '').trim() || !String(jobTitle || '').trim()) {
    res.status(400).json({ success: false, message: 'Periode Tahun, Jabatan, dan Pekerjaan wajib diisi.' })
    return
  }

  const data = memoryStore.getData()
  const sortOrder = data.ownerWorkHistories.length > 0 ? Math.max(...data.ownerWorkHistories.map((item) => item.sortOrder || 0)) + 1 : 1
  const saved = memoryStore.saveOwnerWorkHistory({
    id: memoryStore.nextId(data.ownerWorkHistories),
    periodYear: String(periodYear).trim(),
    positionTitle: String(positionTitle).trim(),
    jobTitle: String(jobTitle).trim(),
    sortOrder,
    updatedAt: getJakartaTimestamp(),
  })
  await persistStoreToDatabase()

  res.status(201).json({ success: true, message: 'History Pekerjaan berhasil ditambahkan.', history: saved })
})

router.put('/owner-work-histories/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id)
  const data = memoryStore.getData()
  const existing = data.ownerWorkHistories.find((item) => item.id === id)

  if (!existing) {
    res.status(404).json({ success: false, message: 'History Pekerjaan tidak ditemukan.' })
    return
  }

  const { periodYear, positionTitle, jobTitle } = req.body as Record<string, string>
  if (!String(periodYear || '').trim() || !String(positionTitle || '').trim() || !String(jobTitle || '').trim()) {
    res.status(400).json({ success: false, message: 'Periode Tahun, Jabatan, dan Pekerjaan wajib diisi.' })
    return
  }

  const saved = memoryStore.saveOwnerWorkHistory({
    ...existing,
    periodYear: String(periodYear).trim(),
    positionTitle: String(positionTitle).trim(),
    jobTitle: String(jobTitle).trim(),
    updatedAt: getJakartaTimestamp(),
  })
  await persistStoreToDatabase()

  res.json({ success: true, message: 'History Pekerjaan berhasil diperbarui.', history: saved })
})

router.delete('/owner-work-histories/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id)
  const data = memoryStore.getData()
  const existing = data.ownerWorkHistories.find((item) => item.id === id)

  if (!existing) {
    res.status(404).json({ success: false, message: 'History Pekerjaan tidak ditemukan.' })
    return
  }

  memoryStore.deleteOwnerWorkHistory(id)
  await persistStoreToDatabase()

  res.json({ success: true, message: 'History Pekerjaan berhasil dihapus.' })
})

export default router
