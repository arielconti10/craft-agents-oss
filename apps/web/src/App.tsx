/**
 * Craft Agents Web App
 *
 * Main application component that handles routing and layout.
 */

import React, { useEffect, useState } from 'react'
import { useAuth, usePlatformAPI, usePlatformCapabilities } from './contexts/PlatformContext'
import { LoginPage } from './pages/LoginPage'
import { ChatPage } from './pages/ChatPage'
import type { Session } from '@craft-agent/shared/platform'

export function App() {
  const { isAuthenticated, isLoading } = useAuth()

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />
  }

  // Show main app
  return <MainApp />
}

/**
 * Main app layout after authentication
 */
function MainApp() {
  const api = usePlatformAPI()
  const capabilities = usePlatformCapabilities()
  const { logout } = useAuth()

  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)

  // Load sessions on mount
  useEffect(() => {
    async function loadSessions() {
      try {
        const loadedSessions = await api.getSessions()
        setSessions(loadedSessions)
        if (loadedSessions.length > 0) {
          setSelectedSession(loadedSessions[0])
        }
      } catch (error) {
        console.error('Failed to load sessions:', error)
      } finally {
        setIsLoadingSessions(false)
      }
    }
    loadSessions()
  }, [api])

  // Subscribe to session events
  useEffect(() => {
    const cleanup = api.onSessionEvent((event) => {
      // Handle session events
      if (event.type === 'session_deleted') {
        setSessions(prev => prev.filter(s => s.id !== event.sessionId))
        if (selectedSession?.id === event.sessionId) {
          setSelectedSession(null)
        }
      }
      // Update session state based on events
      if ('sessionId' in event && selectedSession?.id === event.sessionId) {
        // Trigger refresh of selected session
        api.getSessionMessages(event.sessionId).then(session => {
          if (session) {
            setSelectedSession(session)
          }
        })
      }
    })

    return cleanup
  }, [api, selectedSession])

  // Create new session
  const handleNewSession = async () => {
    try {
      // Get default workspace
      const workspaces = await api.getWorkspaces()
      if (workspaces.length === 0) {
        console.error('No workspaces available')
        return
      }

      const session = await api.createSession(workspaces[0].id)
      setSessions(prev => [session, ...prev])
      setSelectedSession(session)
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  // Select a session
  const handleSelectSession = async (session: Session) => {
    const fullSession = await api.getSessionMessages(session.id)
    setSelectedSession(fullSession)
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 border-r border-[var(--color-border)] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--color-border)]">
          <h1 className="text-lg font-semibold">Craft Agents</h1>
          <p className="text-sm text-[var(--color-muted)]">Web Edition</p>
        </div>

        {/* New chat button */}
        <div className="p-2">
          <button
            onClick={handleNewSession}
            className="w-full px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            New Chat
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingSessions ? (
            <p className="text-center text-[var(--color-muted)] py-4">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="text-center text-[var(--color-muted)] py-4">No sessions yet</p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    onClick={() => handleSelectSession(session)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedSession?.id === session.id
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'hover:bg-[var(--color-border)]'
                    }`}
                  >
                    <div className="font-medium truncate">
                      {session.name || 'New Chat'}
                    </div>
                    <div className="text-xs opacity-70 truncate">
                      {session.preview || 'No messages'}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Platform info & logout */}
        <div className="p-4 border-t border-[var(--color-border)] text-sm">
          <div className="text-[var(--color-muted)] mb-2">
            {capabilities.canRunLocalMcp ? 'Local MCP' : 'Remote MCP'} |
            {capabilities.hasMultiWindow ? ' Multi-window' : ' Single-window'}
          </div>
          <button
            onClick={logout}
            className="text-[var(--color-destructive)] hover:underline"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {selectedSession ? (
          <ChatPage session={selectedSession} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-[var(--color-muted)]">
              <p className="text-xl mb-2">Welcome to Craft Agents</p>
              <p>Select a chat or create a new one to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
