import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import publicRoutes from './routes/public.js'
import userRoutes from './routes/user.js'
import teacherRoutes from './routes/teacher.js'
import adminRoutes from './routes/admin.js'
import superadminRoutes from './routes/superadmin.js'
import { env } from './config/env.js'
import { syncStoreFromDatabase } from './data/mysqlStore.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.resolve(__dirname, '../uploads')
try {
  fs.mkdirSync(uploadsDir, { recursive: true })
} catch (err) {
  console.error('Failed to create uploads directory:', err)
  process.exit(1)
}

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use('/uploads', express.static(uploadsDir))
let syncPromise: Promise<void> | null = null
let lastSyncedAt = 0
const SYNC_COOLDOWN_MS = 1500

app.use(async (_req, _res, next) => {
  try {
    const now = Date.now()

    if (syncPromise) {
      await syncPromise
      next()
      return
    }

    if (now - lastSyncedAt < SYNC_COOLDOWN_MS) {
      next()
      return
    }

    syncPromise = syncStoreFromDatabase()
      .then(() => {
        lastSyncedAt = Date.now()
      })
      .finally(() => {
        syncPromise = null
      })

    await syncPromise
    next()
  } catch (error) {
    next(error)
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/user', userRoutes)
app.use('/api/teacher', teacherRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/superadmin', superadminRoutes)

app.use(
  '/api/health',
  (_req: Request, res: Response, _next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
      dataMode: env.dataMode,
      database: env.mysql.database,
    })
  },
)

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (env.nodeEnv !== 'test') {
    console.error(error)
  }

  res.status(500).json({
    success: false,
    error: error.message || 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
