import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { User, AuthSession } from '@/types'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production'

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

export function signToken(user: User): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, household_id: user.household_id },
    JWT_SECRET,
    { expiresIn: '30d' }
  )
}

export function verifyToken(token: string): User | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as User
    return decoded
  } catch {
    return null
  }
}

export function getSessionFromCookie(cookieHeader: string | null): User | null {
  if (!cookieHeader) return null
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=')
      return [k, v.join('=')]
    })
  )
  const token = cookies['gm_token']
  if (!token) return null
  return verifyToken(token)
}
