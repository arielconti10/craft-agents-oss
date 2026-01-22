/**
 * Workspace routes
 *
 * CRUD operations for workspaces, sources, skills, and statuses.
 */

import { Hono } from 'hono'
import { getSessionManager } from '../services/session-manager'
import type { FolderSourceConfig } from '@craft-agent/shared/sources/types'

export const workspacesRoutes = new Hono()

/**
 * List all workspaces for the current user
 *
 * GET /api/workspaces
 */
workspacesRoutes.get('/', async (c) => {
  const user = c.get('user')
  const manager = getSessionManager()

  const workspaces = await manager.getWorkspaces(user.id)
  return c.json(workspaces)
})

/**
 * Create a new workspace
 *
 * POST /api/workspaces
 * Body: { folderPath: string, name: string }
 */
workspacesRoutes.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ folderPath: string; name: string }>()
  const manager = getSessionManager()

  if (!body.name) {
    return c.json({ error: 'name is required' }, 400)
  }

  const workspace = await manager.createWorkspace(user.id, body.folderPath, body.name)
  return c.json(workspace, 201)
})

/**
 * Get workspace settings
 *
 * GET /api/workspaces/:id/settings
 */
workspacesRoutes.get('/:id/settings', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.param('id')
  const manager = getSessionManager()

  const settings = await manager.getWorkspaceSettings(user.id, workspaceId)
  return c.json(settings)
})

/**
 * Update workspace settings
 *
 * PATCH /api/workspaces/:id/settings
 * Body: Partial<WorkspaceSettings>
 */
workspacesRoutes.patch('/:id/settings', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.param('id')
  const updates = await c.req.json<Record<string, unknown>>()
  const manager = getSessionManager()

  for (const [key, value] of Object.entries(updates)) {
    await manager.updateWorkspaceSetting(user.id, workspaceId, key, value)
  }

  return c.json({ success: true })
})

/**
 * Get workspace permissions config
 *
 * GET /api/workspaces/:id/permissions
 */
workspacesRoutes.get('/:id/permissions', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.param('id')
  const manager = getSessionManager()

  const config = await manager.getWorkspacePermissionsConfig(user.id, workspaceId)
  return c.json(config)
})

// ==========================================
// Sources (nested under workspaces)
// ==========================================

/**
 * List sources for a workspace
 *
 * GET /api/workspaces/:id/sources
 */
workspacesRoutes.get('/:id/sources', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.param('id')
  const manager = getSessionManager()

  const sources = await manager.getSources(user.id, workspaceId)
  return c.json(sources)
})

/**
 * Create a source
 *
 * POST /api/workspaces/:id/sources
 * Body: Partial<FolderSourceConfig>
 */
workspacesRoutes.post('/:id/sources', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.param('id')
  const config = await c.req.json<Partial<FolderSourceConfig>>()
  const manager = getSessionManager()

  const source = await manager.createSource(user.id, workspaceId, config)
  return c.json(source, 201)
})

/**
 * Delete a source
 *
 * DELETE /api/workspaces/:id/sources/:slug
 */
workspacesRoutes.delete('/:id/sources/:slug', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.param('id')
  const sourceSlug = c.req.param('slug')
  const manager = getSessionManager()

  await manager.deleteSource(user.id, workspaceId, sourceSlug)
  return c.json({ success: true })
})

/**
 * Start OAuth for a source
 *
 * POST /api/workspaces/:id/sources/:slug/oauth
 */
workspacesRoutes.post('/:id/sources/:slug/oauth', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.param('id')
  const sourceSlug = c.req.param('slug')
  const manager = getSessionManager()

  const result = await manager.startSourceOAuth(user.id, workspaceId, sourceSlug)
  return c.json(result)
})

/**
 * Save source credentials
 *
 * PUT /api/workspaces/:id/sources/:slug/credentials
 * Body: { credential: string }
 */
workspacesRoutes.put('/:id/sources/:slug/credentials', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.param('id')
  const sourceSlug = c.req.param('slug')
  const body = await c.req.json<{ credential: string }>()
  const manager = getSessionManager()

  await manager.saveSourceCredentials(user.id, workspaceId, sourceSlug, body.credential)
  return c.json({ success: true })
})

/**
 * Get MCP tools for a source
 *
 * GET /api/workspaces/:id/sources/:slug/tools
 */
workspacesRoutes.get('/:id/sources/:slug/tools', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.param('id')
  const sourceSlug = c.req.param('slug')
  const manager = getSessionManager()

  const result = await manager.getMcpTools(user.id, workspaceId, sourceSlug)
  return c.json(result)
})

/**
 * Get source permissions config
 *
 * GET /api/workspaces/:id/sources/:slug/permissions
 */
workspacesRoutes.get('/:id/sources/:slug/permissions', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.param('id')
  const sourceSlug = c.req.param('slug')
  const manager = getSessionManager()

  const config = await manager.getSourcePermissionsConfig(user.id, workspaceId, sourceSlug)
  return c.json(config)
})

// ==========================================
// Skills (nested under workspaces)
// ==========================================

/**
 * List skills for a workspace
 *
 * GET /api/workspaces/:id/skills
 */
workspacesRoutes.get('/:id/skills', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.param('id')
  const manager = getSessionManager()

  const skills = await manager.getSkills(user.id, workspaceId)
  return c.json(skills)
})

/**
 * Delete a skill
 *
 * DELETE /api/workspaces/:id/skills/:slug
 */
workspacesRoutes.delete('/:id/skills/:slug', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.param('id')
  const skillSlug = c.req.param('slug')
  const manager = getSessionManager()

  await manager.deleteSkill(user.id, workspaceId, skillSlug)
  return c.json({ success: true })
})

// ==========================================
// Statuses (nested under workspaces)
// ==========================================

/**
 * List statuses for a workspace
 *
 * GET /api/workspaces/:id/statuses
 */
workspacesRoutes.get('/:id/statuses', async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.param('id')
  const manager = getSessionManager()

  const statuses = await manager.listStatuses(user.id, workspaceId)
  return c.json(statuses)
})
