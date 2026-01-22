/**
 * Settings routes
 *
 * User settings, billing, and preferences.
 */

import { Hono } from 'hono'
import { getSessionManager } from '../services/session-manager'
import type { AuthType } from '@craft-agent/shared/config/types'

export const settingsRoutes = new Hono()

/**
 * Get billing method info
 *
 * GET /api/settings/billing
 */
settingsRoutes.get('/billing', async (c) => {
  const user = c.get('user')
  const manager = getSessionManager()

  const billing = await manager.getBillingMethod(user.id)
  return c.json(billing)
})

/**
 * Update billing method
 *
 * PUT /api/settings/billing
 * Body: { authType: AuthType, credential?: string, ... }
 */
settingsRoutes.put('/billing', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{
    authType: AuthType
    credential?: string
    anthropicBaseUrl?: string | null
    customModelNames?: { opus?: string; sonnet?: string; haiku?: string } | null
  }>()
  const manager = getSessionManager()

  await manager.updateBillingMethod(
    user.id,
    body.authType,
    body.credential,
    body.anthropicBaseUrl,
    body.customModelNames
  )

  return c.json({ success: true })
})

/**
 * Test API connection
 *
 * POST /api/settings/test-api
 * Body: { apiKey: string, baseUrl?: string, modelName?: string }
 */
settingsRoutes.post('/test-api', async (c) => {
  const body = await c.req.json<{
    apiKey: string
    baseUrl?: string
    modelName?: string
  }>()
  const manager = getSessionManager()

  const result = await manager.testApiConnection(
    body.apiKey,
    body.baseUrl,
    body.modelName
  )

  return c.json(result)
})

/**
 * Get global model setting
 *
 * GET /api/settings/model
 */
settingsRoutes.get('/model', async (c) => {
  const user = c.get('user')
  const manager = getSessionManager()

  const model = await manager.getModel(user.id)
  return c.json({ model })
})

/**
 * Set global model
 *
 * PUT /api/settings/model
 * Body: { model: string }
 */
settingsRoutes.put('/model', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ model: string }>()
  const manager = getSessionManager()

  await manager.setModel(user.id, body.model)
  return c.json({ success: true })
})

/**
 * Get app theme
 *
 * GET /api/settings/theme
 */
settingsRoutes.get('/theme', async (c) => {
  const user = c.get('user')
  const manager = getSessionManager()

  const theme = await manager.getAppTheme(user.id)
  return c.json(theme)
})

/**
 * Get color theme ID
 *
 * GET /api/settings/color-theme
 */
settingsRoutes.get('/color-theme', async (c) => {
  const user = c.get('user')
  const manager = getSessionManager()

  const themeId = await manager.getColorTheme(user.id)
  return c.json({ themeId })
})

/**
 * Set color theme
 *
 * PUT /api/settings/color-theme
 * Body: { themeId: string }
 */
settingsRoutes.put('/color-theme', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ themeId: string }>()
  const manager = getSessionManager()

  await manager.setColorTheme(user.id, body.themeId)
  return c.json({ success: true })
})

/**
 * Get user preferences
 *
 * GET /api/settings/preferences
 */
settingsRoutes.get('/preferences', async (c) => {
  const user = c.get('user')
  const manager = getSessionManager()

  const prefs = await manager.readPreferences(user.id)
  return c.json(prefs)
})

/**
 * Write user preferences
 *
 * PUT /api/settings/preferences
 * Body: { content: string }
 */
settingsRoutes.put('/preferences', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ content: string }>()
  const manager = getSessionManager()

  const result = await manager.writePreferences(user.id, body.content)
  return c.json(result)
})
