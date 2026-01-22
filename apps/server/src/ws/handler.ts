/**
 * WebSocket handler for real-time session events
 *
 * Manages WebSocket connections and broadcasts session events
 * to subscribed clients.
 */

import type { WSContext } from 'hono/ws'
import { verifyToken, type AuthUser } from '../middleware/auth'
import { getSessionManager } from '../services/session-manager'
import type { SessionEvent } from '@craft-agent/shared/platform/types'

/**
 * Client message types
 */
interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping'
  sessionId?: string
}

/**
 * Server message types
 */
interface ServerMessage {
  type: 'session_event' | 'pong' | 'error' | 'connected'
  sessionId?: string
  event?: SessionEvent
  message?: string
}

/**
 * Connected WebSocket client
 */
interface WebSocketClient {
  ws: WSContext
  user: AuthUser
  subscribedSessions: Set<string>
}

/**
 * WebSocket connection manager
 */
class WebSocketManager {
  private clients = new Map<WSContext, WebSocketClient>()
  private sessionSubscribers = new Map<string, Set<WSContext>>()

  /**
   * Register a new client
   */
  addClient(ws: WSContext, user: AuthUser): void {
    this.clients.set(ws, {
      ws,
      user,
      subscribedSessions: new Set(),
    })
  }

  /**
   * Remove a client
   */
  removeClient(ws: WSContext): void {
    const client = this.clients.get(ws)
    if (client) {
      // Unsubscribe from all sessions
      for (const sessionId of client.subscribedSessions) {
        this.unsubscribeFromSession(ws, sessionId)
      }
      this.clients.delete(ws)
    }
  }

  /**
   * Subscribe a client to a session's events
   */
  subscribeToSession(ws: WSContext, sessionId: string): void {
    const client = this.clients.get(ws)
    if (!client) return

    client.subscribedSessions.add(sessionId)

    if (!this.sessionSubscribers.has(sessionId)) {
      this.sessionSubscribers.set(sessionId, new Set())
    }
    this.sessionSubscribers.get(sessionId)!.add(ws)
  }

  /**
   * Unsubscribe a client from a session
   */
  unsubscribeFromSession(ws: WSContext, sessionId: string): void {
    const client = this.clients.get(ws)
    if (client) {
      client.subscribedSessions.delete(sessionId)
    }

    const subscribers = this.sessionSubscribers.get(sessionId)
    if (subscribers) {
      subscribers.delete(ws)
      if (subscribers.size === 0) {
        this.sessionSubscribers.delete(sessionId)
      }
    }
  }

  /**
   * Broadcast an event to all subscribers of a session
   */
  broadcastSessionEvent(sessionId: string, event: SessionEvent): void {
    const subscribers = this.sessionSubscribers.get(sessionId)
    if (!subscribers) return

    const message: ServerMessage = {
      type: 'session_event',
      sessionId,
      event,
    }

    const data = JSON.stringify(message)

    for (const ws of subscribers) {
      try {
        ws.send(data)
      } catch (err) {
        console.error('Error sending WebSocket message:', err)
        this.removeClient(ws)
      }
    }
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(ws: WSContext, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message))
    } catch (err) {
      console.error('Error sending WebSocket message:', err)
      this.removeClient(ws)
    }
  }

  /**
   * Get client for a WebSocket
   */
  getClient(ws: WSContext): WebSocketClient | undefined {
    return this.clients.get(ws)
  }
}

// Global WebSocket manager instance
export const wsManager = new WebSocketManager()

/**
 * WebSocket upgrade handler
 *
 * Authenticates the connection and sets up event handlers.
 */
export const wsHandler = (c: { req: { query: (key: string) => string | undefined } }) => {
  // Get token from query string
  const token = c.req.query('token')

  return {
    async onOpen(_event: Event, ws: WSContext) {
      // Verify token
      if (!token) {
        wsManager.sendToClient(ws, {
          type: 'error',
          message: 'Missing authentication token',
        })
        ws.close(4001, 'Missing authentication token')
        return
      }

      const user = await verifyToken(token)
      if (!user) {
        wsManager.sendToClient(ws, {
          type: 'error',
          message: 'Invalid or expired token',
        })
        ws.close(4002, 'Invalid or expired token')
        return
      }

      // Register client
      wsManager.addClient(ws, user)

      // Send connected confirmation
      wsManager.sendToClient(ws, { type: 'connected' })

      console.log(`WebSocket connected: user=${user.id}`)
    },

    onMessage(event: MessageEvent, ws: WSContext) {
      const client = wsManager.getClient(ws)
      if (!client) return

      try {
        const message = JSON.parse(event.data as string) as ClientMessage

        switch (message.type) {
          case 'subscribe':
            if (message.sessionId) {
              wsManager.subscribeToSession(ws, message.sessionId)
            }
            break

          case 'unsubscribe':
            if (message.sessionId) {
              wsManager.unsubscribeFromSession(ws, message.sessionId)
            }
            break

          case 'ping':
            wsManager.sendToClient(ws, { type: 'pong' })
            break

          default:
            console.warn('Unknown WebSocket message type:', message)
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err)
        wsManager.sendToClient(ws, {
          type: 'error',
          message: 'Invalid message format',
        })
      }
    },

    onClose(_event: CloseEvent, ws: WSContext) {
      const client = wsManager.getClient(ws)
      if (client) {
        console.log(`WebSocket disconnected: user=${client.user.id}`)
      }
      wsManager.removeClient(ws)
    },

    onError(event: Event, ws: WSContext) {
      console.error('WebSocket error:', event)
      wsManager.removeClient(ws)
    },
  }
}

/**
 * Broadcast a session event to all subscribers
 * Called by SessionManager when events occur
 */
export function broadcastSessionEvent(sessionId: string, event: SessionEvent): void {
  wsManager.broadcastSessionEvent(sessionId, event)
}
