/**
 * Craft Agents Web App
 *
 * Main application component with layout matching the Electron app.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth, usePlatformAPI, usePlatformCapabilities } from './contexts/PlatformContext'
import { LoginPage } from './pages/LoginPage'
import { ChatPage } from './pages/ChatPage'
import type { Session } from '@craft-agent/shared/platform'
import { Spinner } from '@craft-agent/ui'

export function App() {
  const { isAuthenticated, isLoading } = useAuth()

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner className="text-4xl text-foreground-50 mx-auto mb-4" />
          <p className="text-foreground-50">Loading...</p>
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
          const fullSession = await api.getSessionMessages(loadedSessions[0].id)
          setSelectedSession(fullSession)
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

  // Update session in list after changes
  const handleSessionUpdate = useCallback((updatedSession: Session) => {
    setSessions(prev => prev.map(s =>
      s.id === updatedSession.id ? { ...s, name: updatedSession.name } : s
    ))
    setSelectedSession(updatedSession)
  }, [])

  return (
    <div className="h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-72 flex flex-col bg-foreground-2 shadow-middle">
        {/* Header */}
        <div className="p-4 border-b border-foreground/5">
          <div className="flex items-center gap-3">
            <CraftAgentLogo className="w-8 h-8 text-accent" />
            <div>
              <h1 className="text-base font-semibold text-foreground">Craft Agents</h1>
              <p className="text-xs text-foreground-50">Web Edition</p>
            </div>
          </div>
        </div>

        {/* New chat button */}
        <div className="p-3">
          <button
            onClick={handleNewSession}
            className="w-full px-4 py-2.5 bg-accent text-white rounded-lg shadow-minimal hover:opacity-90 transition-opacity font-medium"
          >
            New Chat
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2">
          {isLoadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="text-2xl text-foreground-30" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-foreground-40 py-8 text-sm">No sessions yet</p>
          ) : (
            <ul className="space-y-0.5 py-1">
              {sessions.map((session) => (
                <li key={session.id} className="session-item">
                  <button
                    onClick={() => handleSelectSession(session)}
                    data-selected={selectedSession?.id === session.id || undefined}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors relative ${
                      selectedSession?.id === session.id
                        ? 'bg-accent text-white'
                        : 'text-foreground hover:bg-foreground/5'
                    }`}
                  >
                    <div className="font-medium truncate text-sm">
                      {session.name || 'New Chat'}
                    </div>
                    {session.preview && (
                      <div className={`text-xs truncate mt-0.5 ${
                        selectedSession?.id === session.id
                          ? 'text-white/70'
                          : 'text-foreground-50'
                      }`}>
                        {session.preview}
                      </div>
                    )}
                  </button>
                  <div className="session-separator h-px bg-foreground/5 mx-3" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Platform info & logout */}
        <div className="p-4 border-t border-foreground/5">
          <div className="text-foreground-40 text-xs mb-2">
            {capabilities.canRunLocalMcp ? 'Local MCP' : 'Remote MCP'} •
            {capabilities.hasMultiWindow ? ' Multi-window' : ' Single-window'}
          </div>
          <button
            onClick={logout}
            className="text-destructive hover:underline text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedSession ? (
          <ChatPage
            session={selectedSession}
            onSessionUpdate={handleSessionUpdate}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-foreground-1.5">
            <div className="text-center">
              <CraftAgentLogo className="w-16 h-16 text-foreground-10 mx-auto mb-4" />
              <p className="text-foreground-50 text-lg mb-1">Welcome to Craft Agents</p>
              <p className="text-foreground-30 text-sm">Select a chat or create a new one to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Craft Agent Logo - The "C" logo
 */
function CraftAgentLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(3.4502, 3)" fill="currentColor">
        <path
          d="M3.17890888,3.6 L3.17890888,0 L16,0 L16,3.6 L3.17890888,3.6 Z M9.642,7.2 L9.64218223,10.8 L0,10.8 L0,3.6 L16,3.6 L16,7.2 L9.642,7.2 Z M3.17890888,18 L3.178,14.4 L0,14.4 L0,10.8 L16,10.8 L16,18 L3.17890888,18 Z"
          fillRule="nonzero"
        />
      </g>
    </svg>
  )
}
