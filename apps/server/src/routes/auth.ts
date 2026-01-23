/**
 * Authentication routes
 *
 * Handles login, logout, and auth state.
 */

import { Hono } from 'hono'
import { generateToken, authMiddleware } from '../middleware/auth'
import type { AuthState } from '@craft-agent/shared/auth/types'

export const authRoutes = new Hono()

/**
 * Login with API key
 *
 * POST /api/auth/login
 * Body: { apiKey: string }
 */
authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ apiKey?: string; email?: string }>()

  if (!body.apiKey) {
    return c.json({ error: 'API key is required' }, 400)
  }

  // TODO: Validate API key with Anthropic
  // For now, create a user session based on the API key

  // Generate user ID from API key hash (simple approach)
  const userId = `user_${Buffer.from(body.apiKey.slice(0, 16)).toString('base64url')}`

  const token = await generateToken({
    id: userId,
    email: body.email,
  })

  return c.json({
    success: true,
    token,
    user: { id: userId, email: body.email },
  })
})

/**
 * Get auth state (requires auth)
 *
 * GET /api/auth/state
 */
authRoutes.get('/state', authMiddleware, async (c) => {
  const user = c.get('user')

  // Build auth state
  const authState: AuthState = {
    billing: {
      type: 'api_key',
      hasCredentials: true,
      apiKey: null, // Don't expose the actual key
      claudeOAuthToken: null,
    },
    workspace: {
      hasWorkspace: false,
      active: null,
    },
  }

  return c.json(authState)
})

/**
 * Logout
 *
 * POST /api/auth/logout
 */
authRoutes.post('/logout', authMiddleware, async (c) => {
  // For JWT-based auth, client just discards the token
  // Could implement token blacklisting for extra security
  return c.json({ success: true })
})

/**
 * Start OAuth flow (Claude OAuth)
 *
 * POST /api/auth/oauth/start
 */
authRoutes.post('/oauth/start', async (c) => {
  // TODO: Implement Claude OAuth flow
  // For now, return not implemented
  return c.json({ error: 'OAuth not yet implemented' }, 501)
})

/**
 * OAuth callback
 *
 * GET /api/auth/oauth/callback
 */
authRoutes.get('/oauth/callback', async (c) => {
  // TODO: Handle OAuth callback
  return c.json({ error: 'OAuth not yet implemented' }, 501)
})
