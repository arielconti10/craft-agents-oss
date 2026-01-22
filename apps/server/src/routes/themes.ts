/**
 * Theme routes
 *
 * Preset themes and theme management.
 */

import { Hono } from 'hono'
import { getSessionManager } from '../services/session-manager'

export const themesRoutes = new Hono()

/**
 * Get all preset themes
 *
 * GET /api/themes/presets
 */
themesRoutes.get('/presets', async (c) => {
  const manager = getSessionManager()
  const presets = await manager.loadPresetThemes()
  return c.json(presets)
})

/**
 * Get a specific preset theme
 *
 * GET /api/themes/presets/:id
 */
themesRoutes.get('/presets/:id', async (c) => {
  const themeId = c.req.param('id')
  const manager = getSessionManager()

  const preset = await manager.loadPresetTheme(themeId)
  if (!preset) {
    return c.json({ error: 'Theme not found' }, 404)
  }

  return c.json(preset)
})
