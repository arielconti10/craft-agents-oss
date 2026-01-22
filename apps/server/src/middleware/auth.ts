/**
 * Authentication middleware
 *
 * Verifies JWT tokens and attaches user info to context.
 */

import { createMiddleware } from 'hono/factory'
import * as jose from 'jose'

// JWT secret (in production, use env var)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'craft-agents-dev-secret-change-in-production'
)

/**
 * User info attached to authenticated requests
 */
export interface AuthUser {
  id: string
  email?: string
  workspaceId?: string
}

/**
 * Extended context with auth user
 */
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
  }
}

/**
 * Auth middleware - verifies JWT and attaches user to context
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401)
  }

  const token = authHeader.slice(7)

  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET)

    // Attach user to context
    c.set('user', {
      id: payload.sub as string,
      email: payload.email as string | undefined,
      workspaceId: payload.workspaceId as string | undefined,
    })

    await next()
  } catch (err) {
    console.error('Auth error:', err)
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
})

/**
 * Generate a JWT token for a user
 */
export async function generateToken(user: AuthUser): Promise<string> {
  const token = await new jose.SignJWT({
    sub: user.id,
    email: user.email,
    workspaceId: user.workspaceId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)

  return token
}

/**
 * Verify a token and return the user
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET)
    return {
      id: payload.sub as string,
      email: payload.email as string | undefined,
      workspaceId: payload.workspaceId as string | undefined,
    }
  } catch {
    return null
  }
}
