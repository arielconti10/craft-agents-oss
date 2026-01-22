/**
 * WebSocket handler for real-time session events
 *
 * Manages WebSocket connections and broadcasts session events
 * to subscribed clients.
 *
 * Uses Bun's native WebSocket support.
 */

import { verifyToken, type AuthUser } from '../middleware/auth'
import type { SessionEvent } from '@craft-agent/shared/platform/types'
import type { ServerWebSocket } from 'bun'

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
 * WebSocket data attached to connection
 */
interface WebSocketData {
  token: string | null
  user: AuthUser | null
  subscribedSessions: Set<string>
}

/**
 * Connected WebSocket clients by session ID
 */
const sessionSubscribers = new Map<string, Set<ServerWebSocket<WebSocketData>>>()

/**
 * Send a message to a WebSocket client
 */
function sendMessage(ws: ServerWebSocket<WebSocketData>, message: ServerMessage): void {
  try {
    ws.send(JSON.stringify(message))
  } catch (err) {
    console.error('Error sending WebSocket message:', err)
  }
}

/**
 * Subscribe a client to a session's events
 */
function subscribeToSession(ws: ServerWebSocket<WebSocketData>, sessionId: string): void {
  ws.data.subscribedSessions.add(sessionId)

  if (!sessionSubscribers.has(sessionId)) {
    sessionSubscribers.set(sessionId, new Set())
  }
  sessionSubscribers.get(sessionId)!.add(ws)
}

/**
 * Unsubscribe a client from a session
 */
function unsubscribeFromSession(ws: ServerWebSocket<WebSocketData>, sessionId: string): void {
  ws.data.subscribedSessions.delete(sessionId)

  const subscribers = sessionSubscribers.get(sessionId)
  if (subscribers) {
    subscribers.delete(ws)
    if (subscribers.size === 0) {
      sessionSubscribers.delete(sessionId)
    }
  }
}

/**
 * Clean up all subscriptions for a client
 */
function cleanupClient(ws: ServerWebSocket<WebSocketData>): void {
  for (const sessionId of ws.data.subscribedSessions) {
    unsubscribeFromSession(ws, sessionId)
  }
}

/**
 * Broadcast a session event to all subscribers
 * Called by SessionManager when events occur
 */
export function broadcastSessionEvent(sessionId: string, event: SessionEvent): void {
  const subscribers = sessionSubscribers.get(sessionId)
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
      console.error('Error broadcasting to WebSocket:', err)
    }
  }
}

/**
 * Create Bun WebSocket handler
 */
export function createWebSocketHandler() {
  return {
    async open(ws: ServerWebSocket<WebSocketData>) {
      // Initialize data
      ws.data.subscribedSessions = new Set()

      // Verify token
      const token = ws.data.token
      if (!token) {
        sendMessage(ws, { type: 'error', message: 'Missing authentication token' })
        ws.close(4001, 'Missing authentication token')
        return
      }

      const user = await verifyToken(token)
      if (!user) {
        sendMessage(ws, { type: 'error', message: 'Invalid or expired token' })
        ws.close(4002, 'Invalid or expired token')
        return
      }

      ws.data.user = user

      // Send connected confirmation
      sendMessage(ws, { type: 'connected' })
      console.log(`WebSocket connected: user=${user.id}`)
    },

    message(ws: ServerWebSocket<WebSocketData>, rawMessage: string | Buffer) {
      if (!ws.data.user) return

      try {
        const message = JSON.parse(rawMessage.toString()) as ClientMessage

        switch (message.type) {
          case 'subscribe':
            if (message.sessionId) {
              subscribeToSession(ws, message.sessionId)
            }
            break

          case 'unsubscribe':
            if (message.sessionId) {
              unsubscribeFromSession(ws, message.sessionId)
            }
            break

          case 'ping':
            sendMessage(ws, { type: 'pong' })
            break

          default:
            console.warn('Unknown WebSocket message type:', message)
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err)
        sendMessage(ws, { type: 'error', message: 'Invalid message format' })
      }
    },

    close(ws: ServerWebSocket<WebSocketData>) {
      if (ws.data.user) {
        console.log(`WebSocket disconnected: user=${ws.data.user.id}`)
      }
      cleanupClient(ws)
    },

    error(ws: ServerWebSocket<WebSocketData>, error: Error) {
      console.error('WebSocket error:', error)
      cleanupClient(ws)
    },
  }
}
