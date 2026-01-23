/**
 * Craft Agents Backend Server
 *
 * Provides REST API and WebSocket endpoints for the web app.
 * Runs MCP servers and manages sessions on behalf of web users.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { join } from 'path'
import { existsSync } from 'fs'

import { authRoutes } from './routes/auth'
import { sessionsRoutes } from './routes/sessions'
import { workspacesRoutes } from './routes/workspaces'
import { settingsRoutes } from './routes/settings'
import { themesRoutes } from './routes/themes'
import { createWebSocketHandler } from './ws/handler'
import { authMiddleware } from './middleware/auth'
import { getSessionManager } from './services/session-manager'
import { setPathToClaudeCodeExecutable } from '@craft-agent/shared/agent'

// ==========================================
// Configure Claude Agent SDK Path
// ==========================================

// Find the Claude Agent SDK CLI path
const possiblePaths = [
  // Development: in node_modules
  join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js'),
  // Alternative: relative to this file
  join(__dirname, '..', '..', '..', '..', 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js'),
  // Docker/production: might be in a different location
  '/app/node_modules/@anthropic-ai/claude-agent-sdk/cli.js',
]

let cliPath: string | null = null
for (const path of possiblePaths) {
  if (existsSync(path)) {
    cliPath = path
    break
  }
}

if (cliPath) {
  console.log(`Found Claude Agent SDK CLI at: ${cliPath}`)
  setPathToClaudeCodeExecutable(cliPath)
} else {
  console.warn('Claude Agent SDK CLI not found. Agent functionality may not work.')
  console.warn('Searched paths:', possiblePaths)
}

// Create Hono app
const app = new Hono()

// ==========================================
// Middleware
// ==========================================

// CORS for web app
const corsOrigins = [
  'http://localhost:5175',      // Local web dev
  'http://localhost:3000',      // Alternative local
  'https://agents.craft.do',    // Production
]

// Add custom origin from environment variable
if (process.env.WEB_URL) {
  corsOrigins.push(process.env.WEB_URL.replace(/\/$/, ''))
}

app.use('*', cors({
  origin: corsOrigins,
  credentials: true,
}))

// Request logging
app.use('*', logger())

// ==========================================
// Health Check (no auth required)
// ==========================================

app.get('/health', (c) => {
  return c.json({ status: 'ok', version: '0.2.25' })
})

// ==========================================
// Public Share Route (no auth required)
// ==========================================

app.get('/api/share/:shareId', (c) => {
  const shareId = c.req.param('shareId')
  const sessionManager = getSessionManager()
  const sharedSession = sessionManager.getSharedSession(shareId)

  if (!sharedSession) {
    return c.json({ error: 'Shared session not found or has been revoked' }, 404)
  }

  return c.json({
    id: sharedSession.id,
    name: sharedSession.name,
    workspaceName: sharedSession.workspaceName,
    messages: sharedSession.messages,
    sharedAt: sharedSession.sharedAt,
    updatedAt: sharedSession.updatedAt,
  })
})

// ==========================================
// API Routes (auth required)
// ==========================================

const api = new Hono()

// Auth routes (some don't require auth)
api.route('/auth', authRoutes)

// Protected routes
api.use('*', authMiddleware)
api.route('/sessions', sessionsRoutes)
api.route('/workspaces', workspacesRoutes)
api.route('/settings', settingsRoutes)
api.route('/themes', themesRoutes)

// Mount API
app.route('/api', api)

// ==========================================
// Error Handling
// ==========================================

app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json(
    { error: err.message || 'Internal server error' },
    500
  )
})

// ==========================================
// Start Server
// ==========================================

const port = parseInt(process.env.PORT || '3001', 10)

console.log(`
╔═══════════════════════════════════════════════════╗
║           Craft Agents Server v0.2.25             ║
╠═══════════════════════════════════════════════════╣
║  REST API:    http://localhost:${port}/api          ║
║  WebSocket:   ws://localhost:${port}/ws             ║
║  Health:      http://localhost:${port}/health       ║
╚═══════════════════════════════════════════════════╝
`)

// Create WebSocket handler for Bun
const wsHandler = createWebSocketHandler()

// Export for Bun.serve()
export default {
  port,
  fetch(req: Request, server: unknown) {
    const url = new URL(req.url)

    // Handle WebSocket upgrade for /ws or /api/ws endpoint
    if (url.pathname === '/ws' || url.pathname === '/api/ws') {
      // Get token from query string
      const token = url.searchParams.get('token')

      // @ts-expect-error - Bun server type
      const success = server.upgrade(req, { data: { token } })
      if (success) {
        return undefined // Bun handles the response
      }
      return new Response('WebSocket upgrade failed', { status: 400 })
    }

    // Handle regular HTTP requests with Hono
    return app.fetch(req)
  },
  websocket: wsHandler,
}
