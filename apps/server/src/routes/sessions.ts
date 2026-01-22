/**
 * Session routes
 *
 * CRUD operations for sessions and message handling.
 */

import { Hono } from 'hono'
import { getSessionManager } from '../services/session-manager'
import type { CreateSessionOptions, SessionCommand } from '@craft-agent/shared/platform/types'

export const sessionsRoutes = new Hono()

/**
 * List all sessions for the current user
 *
 * GET /api/sessions
 */
sessionsRoutes.get('/', async (c) => {
  const user = c.get('user')
  const manager = getSessionManager()

  const sessions = await manager.getSessions(user.id)
  return c.json(sessions)
})

/**
 * Get a session with messages
 *
 * GET /api/sessions/:id
 */
sessionsRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  const sessionId = c.req.param('id')
  const manager = getSessionManager()

  const session = await manager.getSessionMessages(user.id, sessionId)
  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  return c.json(session)
})

/**
 * Create a new session
 *
 * POST /api/sessions
 * Body: { workspaceId: string, options?: CreateSessionOptions }
 */
sessionsRoutes.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ workspaceId: string; options?: CreateSessionOptions }>()
  const manager = getSessionManager()

  if (!body.workspaceId) {
    return c.json({ error: 'workspaceId is required' }, 400)
  }

  const session = await manager.createSession(user.id, body.workspaceId, body.options)
  return c.json(session, 201)
})

/**
 * Delete a session
 *
 * DELETE /api/sessions/:id
 */
sessionsRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const sessionId = c.req.param('id')
  const manager = getSessionManager()

  await manager.deleteSession(user.id, sessionId)
  return c.json({ success: true })
})

/**
 * Send a message to a session
 *
 * POST /api/sessions/:id/message
 * Body: { message: string, attachments?: FileAttachment[], ... }
 *
 * Response streams via WebSocket, not this endpoint.
 */
sessionsRoutes.post('/:id/message', async (c) => {
  const user = c.get('user')
  const sessionId = c.req.param('id')
  const body = await c.req.json<{
    message: string
    attachments?: unknown[]
    storedAttachments?: unknown[]
    options?: unknown
  }>()
  const manager = getSessionManager()

  if (!body.message) {
    return c.json({ error: 'message is required' }, 400)
  }

  // Start processing (async - results stream via WebSocket)
  await manager.sendMessage(
    user.id,
    sessionId,
    body.message,
    body.attachments,
    body.storedAttachments,
    body.options
  )

  return c.json({ success: true, status: 'processing' })
})

/**
 * Cancel processing for a session
 *
 * POST /api/sessions/:id/cancel
 */
sessionsRoutes.post('/:id/cancel', async (c) => {
  const user = c.get('user')
  const sessionId = c.req.param('id')
  const body = await c.req.json<{ silent?: boolean }>().catch(() => ({}))
  const manager = getSessionManager()

  await manager.cancelProcessing(user.id, sessionId, body.silent)
  return c.json({ success: true })
})

/**
 * Kill a background shell
 *
 * DELETE /api/sessions/:id/shells/:shellId
 */
sessionsRoutes.delete('/:id/shells/:shellId', async (c) => {
  const user = c.get('user')
  const sessionId = c.req.param('id')
  const shellId = c.req.param('shellId')
  const manager = getSessionManager()

  const result = await manager.killShell(user.id, sessionId, shellId)
  return c.json(result)
})

/**
 * Respond to a permission request
 *
 * POST /api/sessions/:id/permission
 * Body: { requestId: string, allowed: boolean, alwaysAllow: boolean }
 */
sessionsRoutes.post('/:id/permission', async (c) => {
  const user = c.get('user')
  const sessionId = c.req.param('id')
  const body = await c.req.json<{
    requestId: string
    allowed: boolean
    alwaysAllow: boolean
  }>()
  const manager = getSessionManager()

  const success = await manager.respondToPermission(
    user.id,
    sessionId,
    body.requestId,
    body.allowed,
    body.alwaysAllow
  )

  return c.json({ success })
})

/**
 * Respond to a credential request
 *
 * POST /api/sessions/:id/credential
 * Body: { requestId: string, response: CredentialResponse }
 */
sessionsRoutes.post('/:id/credential', async (c) => {
  const user = c.get('user')
  const sessionId = c.req.param('id')
  const body = await c.req.json<{
    requestId: string
    response: unknown
  }>()
  const manager = getSessionManager()

  const success = await manager.respondToCredential(
    user.id,
    sessionId,
    body.requestId,
    body.response
  )

  return c.json({ success })
})

/**
 * Execute a session command
 *
 * POST /api/sessions/:id/command
 * Body: SessionCommand
 */
sessionsRoutes.post('/:id/command', async (c) => {
  const user = c.get('user')
  const sessionId = c.req.param('id')
  const command = await c.req.json<SessionCommand>()
  const manager = getSessionManager()

  const result = await manager.sessionCommand(user.id, sessionId, command)
  return c.json(result ?? { success: true })
})

/**
 * Get draft for a session
 *
 * GET /api/sessions/:id/draft
 */
sessionsRoutes.get('/:id/draft', async (c) => {
  const user = c.get('user')
  const sessionId = c.req.param('id')
  const manager = getSessionManager()

  const draft = await manager.getDraft(user.id, sessionId)
  return c.json({ draft })
})

/**
 * Set draft for a session
 *
 * PUT /api/sessions/:id/draft
 * Body: { text: string }
 */
sessionsRoutes.put('/:id/draft', async (c) => {
  const user = c.get('user')
  const sessionId = c.req.param('id')
  const body = await c.req.json<{ text: string }>()
  const manager = getSessionManager()

  await manager.setDraft(user.id, sessionId, body.text)
  return c.json({ success: true })
})

/**
 * Delete draft for a session
 *
 * DELETE /api/sessions/:id/draft
 */
sessionsRoutes.delete('/:id/draft', async (c) => {
  const user = c.get('user')
  const sessionId = c.req.param('id')
  const manager = getSessionManager()

  await manager.deleteDraft(user.id, sessionId)
  return c.json({ success: true })
})

/**
 * Get all drafts
 *
 * GET /api/drafts
 */
sessionsRoutes.get('/drafts', async (c) => {
  const user = c.get('user')
  const manager = getSessionManager()

  const drafts = await manager.getAllDrafts(user.id)
  return c.json(drafts)
})

/**
 * Get task output
 *
 * GET /api/tasks/:taskId/output
 */
sessionsRoutes.get('/tasks/:taskId/output', async (c) => {
  const user = c.get('user')
  const taskId = c.req.param('taskId')
  const manager = getSessionManager()

  const output = await manager.getTaskOutput(user.id, taskId)
  return c.json({ output })
})
