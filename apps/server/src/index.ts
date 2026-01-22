/**
 * Craft Agents Backend Server
 *
 * Provides REST API and WebSocket endpoints for the web app.
 * Runs MCP servers and manages sessions on behalf of web users.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createNodeWebSocket } from '@hono/node-ws'

import { authRoutes } from './routes/auth'
import { sessionsRoutes } from './routes/sessions'
import { workspacesRoutes } from './routes/workspaces'
import { settingsRoutes } from './routes/settings'
import { themesRoutes } from './routes/themes'
import { wsHandler } from './ws/handler'
import { authMiddleware } from './middleware/auth'

// Create Hono app
const app = new Hono()

// Create WebSocket handler
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

// ==========================================
// Middleware
// ==========================================

// CORS for web app
app.use('*', cors({
  origin: [
    'http://localhost:5175',      // Local web dev
    'http://localhost:3000',      // Alternative local
    'https://agents.craft.do',    // Production
  ],
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
// WebSocket Endpoint
// ==========================================

app.get('/ws', upgradeWebSocket(wsHandler))

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

// Export for Bun
export default {
  port,
  fetch: app.fetch,
  websocket: injectWebSocket,
}
