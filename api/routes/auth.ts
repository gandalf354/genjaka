import bcrypt from 'bcryptjs'
import { Router, type Request, type Response } from 'express'
import { authenticate, createToken, sanitizeAccount, type AuthenticatedRequest } from '../middleware/auth.js'
import { memoryStore } from '../data/store.js'
import { persistStoreToDatabase } from '../data/mysqlStore.js'
import { getJakartaTimestamp } from '../utils/time.js'

const router = Router()

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { fullName, email, password } = req.body as {
    fullName?: string
    email?: string
    password?: string
  }

  if (!fullName || !email || !password) {
    res.status(400).json({ success: false, message: 'Nama lengkap, email, dan password wajib diisi.' })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ success: false, message: 'Password minimal 8 karakter.' })
    return
  }

  if (memoryStore.findAccountByEmail(email)) {
    res.status(409).json({ success: false, message: 'Email sudah terdaftar.' })
    return
  }

  const data = memoryStore.getData()
  const timestamp = getJakartaTimestamp()
  const account = {
    id: memoryStore.nextId(data.accounts),
    fullName,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'user' as const,
    approvalStatus: 'pending' as const,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  memoryStore.saveAccount(account)
  await persistStoreToDatabase()

  res.status(201).json({
    success: true,
    message: 'Registrasi berhasil. Akun Anda menunggu approval Admin.',
    user: sanitizeAccount(account),
  })
})

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' })
    return
  }

  const account = memoryStore.findAccountByEmail(email)

  if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
    res.status(401).json({ success: false, message: 'Email atau password tidak sesuai.' })
    return
  }

  if (!account.isActive) {
    res.status(403).json({ success: false, message: 'Akun Anda sedang nonaktif.' })
    return
  }

  if (account.approvalStatus === 'pending') {
    res.status(403).json({ success: false, message: 'Akun Anda masih menunggu approval Admin.' })
    return
  }

  if (account.approvalStatus === 'rejected') {
    res.status(403).json({ success: false, message: 'Registrasi Anda ditolak. Hubungi Admin untuk informasi lanjut.' })
    return
  }

  const token = createToken({ id: account.id, role: account.role, email: account.email })

  res.json({
    success: true,
    message: 'Login berhasil.',
    token,
    user: sanitizeAccount(account),
  })
})

router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = req.user ? memoryStore.findAccountById(req.user.id) : undefined

  if (!account) {
    res.status(404).json({ success: false, message: 'Data akun tidak ditemukan.' })
    return
  }

  const profile = memoryStore.getData().profiles.find((item) => item.userId === account.id) || null

  res.json({
    success: true,
    user: sanitizeAccount(account),
    profile,
  })
})

router.put('/change-password', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const account = req.user ? memoryStore.findAccountById(req.user.id) : undefined

  if (!account) {
    res.status(404).json({ success: false, message: 'Data akun tidak ditemukan.' })
    return
  }

  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string
    newPassword?: string
  }

  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, message: 'Password saat ini dan password baru wajib diisi.' })
    return
  }

  if (!(await bcrypt.compare(currentPassword, account.passwordHash))) {
    res.status(400).json({ success: false, message: 'Password saat ini tidak sesuai.' })
    return
  }

  if (newPassword.length < 8) {
    res.status(400).json({ success: false, message: 'Password baru minimal 8 karakter.' })
    return
  }

  account.passwordHash = await bcrypt.hash(newPassword, 10)
  account.updatedAt = getJakartaTimestamp()
  memoryStore.saveAccount(account)
  await persistStoreToDatabase()

  res.json({
    success: true,
    message: 'Password berhasil diperbarui.',
  })
})

router.post('/logout', async (_req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: 'Logout berhasil.',
  })
})

export default router
