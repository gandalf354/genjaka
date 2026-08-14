import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { memoryStore } from '../data/store.js'
import type { Role } from '../types.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number
    role: Role
    email: string
  }
}

export const createToken = (payload: { id: number; role: Role; email: string }) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: '12h' })

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined

  if (!token) {
    res.status(401).json({ success: false, message: 'Token tidak ditemukan.' })
    return
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { id: number; role: Role; email: string }
    const account = memoryStore.findAccountById(decoded.id)

    if (!account || !account.isActive) {
      res.status(401).json({ success: false, message: 'Akun tidak aktif.' })
      return
    }

    req.user = decoded
    next()
  } catch (_error) {
    res.status(401).json({ success: false, message: 'Token tidak valid.' })
  }
}

export const authorize = (roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke fitur ini.' })
      return
    }
    next()
  }
}

export const sanitizeAccount = (account: {
  id: number
  fullName: string
  email: string
  role: Role
  approvalStatus: string
  isActive: boolean
}) => ({
  id: account.id,
  fullName: account.fullName,
  email: account.email,
  role: account.role,
  approvalStatus: account.approvalStatus,
  isActive: account.isActive,
})
