import { Router, type Request, type Response } from 'express'
import { memoryStore } from '../data/store.js'
import { buildPublicHighlights } from '../utils/dashboard.js'

const router = Router()

router.get('/landing-page', (_req: Request, res: Response): void => {
  const data = memoryStore.getData()

  res.json({
    success: true,
    content: data.landingPage,
    highlights: buildPublicHighlights(data.landingPage),
  })
})

export default router
