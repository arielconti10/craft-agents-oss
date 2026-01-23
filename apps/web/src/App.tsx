/**
 * Craft Agents Web App
 *
 * Main application component with responsive layout using shadcn/ui sidebar:
 * - Desktop: Sidebar + Navigator Panel + Main Content
 * - Mobile: Sheet-based sidebar with bottom navigation
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth, usePlatformAPI, usePlatformCapabilities } from './contexts/PlatformContext'
import { LoginPage } from './pages/LoginPage'
import { ChatPage } from './pages/ChatPage'
import { SettingsPage } from './pages/SettingsPage'
import type { Session } from '@craft-agent/shared/platform'
import type { LoadedSource } from '@craft-agent/shared/sources/types'
import type { LoadedSkill } from '@craft-agent/shared/skills/types'
import { Spinner } from '@craft-agent/ui'
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from './components/ui/sidebar'
import {
  AppSidebar,
  type NavSection,
  type SessionStatus,
  STATUS_CONFIG,
  STATUS_ORDER,
} from './components/app-sidebar'
import { SessionMenu, RightSidebar } from './components/app-shell'
import {
  Plug,
  Wand2,
  Plus,
  ChevronRight,
  ChevronLeft,
  Menu,
  Flag,
  Circle,
  CircleDot,
  CheckCircle,
  XCircle,
  Inbox,
  PanelRight,
} from 'lucide-react'

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
  return (
    <SidebarProvider>
      <MainApp />
    </SidebarProvider>
  )
}

/**
 * Main app layout after authentication
 */
function MainApp() {
  const api = usePlatformAPI()
  const capabilities = usePlatformCapabilities()
  const { logout } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()

  // Navigation state
  const [activeSection, setActiveSection] = useState<NavSection>('chats')
  const [selectedStatus, setSelectedStatus] = useState<SessionStatus | 'all'>('all')

  // Mobile UI state
  const [showListPanel, setShowListPanel] = useState(true)

  // Right sidebar state
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false)

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)

  // Sources state
  const [sources, setSources] = useState<LoadedSource[]>([])
  const [selectedSource, setSelectedSource] = useState<LoadedSource | null>(null)
  const [isLoadingSources, setIsLoadingSources] = useState(false)

  // Skills state
  const [skills, setSkills] = useState<LoadedSkill[]>([])
  const [isLoadingSkills, setIsLoadingSkills] = useState(false)

  // Current workspace ID
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  // Load workspaces and sessions on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const workspaces = await api.getWorkspaces()
        const firstWorkspace = workspaces[0]
        if (firstWorkspace) {
          setWorkspaceId(firstWorkspace.id)
        }

        const loadedSessions = await api.getSessions()
        setSessions(loadedSessions)
        const firstSession = loadedSessions[0]
        if (firstSession) {
          const fullSession = await api.getSessionMessages(firstSession.id)
          setSelectedSession(fullSession)
        }
      } catch (error) {
        console.error('Failed to load initial data:', error)
      } finally {
        setIsLoadingSessions(false)
      }
    }
    loadInitialData()
  }, [api])

  // Load sources when section changes
  useEffect(() => {
    if (activeSection === 'sources' && workspaceId && sources.length === 0) {
      setIsLoadingSources(true)
      api.getSources(workspaceId)
        .then(setSources)
        .catch(console.error)
        .finally(() => setIsLoadingSources(false))
    }
  }, [activeSection, workspaceId, api, sources.length])

  // Load skills when section changes
  useEffect(() => {
    if (activeSection === 'skills' && workspaceId && skills.length === 0) {
      setIsLoadingSkills(true)
      api.getSkills(workspaceId)
        .then(setSkills)
        .catch(console.error)
        .finally(() => setIsLoadingSkills(false))
    }
  }, [activeSection, workspaceId, api, skills.length])

  // Subscribe to session events
  useEffect(() => {
    const cleanup = api.onSessionEvent((event) => {
      if (event.type === 'session_deleted') {
        setSessions(prev => prev.filter(s => s.id !== event.sessionId))
        if (selectedSession?.id === event.sessionId) {
          setSelectedSession(null)
        }
      }
      if ('sessionId' in event && selectedSession?.id === event.sessionId) {
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
    if (!workspaceId) return
    try {
      const session = await api.createSession(workspaceId)
      setSessions(prev => [session, ...prev])
      setSelectedSession(session)
      setActiveSection('chats')
      setShowListPanel(false) // Show chat on mobile
      setOpenMobile(false)
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  // Select a session
  const handleSelectSession = async (session: Session) => {
    const fullSession = await api.getSessionMessages(session.id)
    setSelectedSession(fullSession)
    setShowListPanel(false) // Show chat on mobile
    setOpenMobile(false)
  }

  // Update session in list after changes
  const handleSessionUpdate = useCallback((updatedSession: Session) => {
    setSessions(prev => prev.map(s =>
      s.id === updatedSession.id ? { ...s, name: updatedSession.name } : s
    ))
    setSelectedSession(updatedSession)
  }, [])

  // Session action handlers
  const handleStatusChange = useCallback(async (sessionId: string, status: SessionStatus) => {
    try {
      await api.sessionCommand(sessionId, { type: 'setTodoState', state: status })
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, todoState: status } : s
      ))
      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, todoState: status } : null)
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }, [api, selectedSession?.id])

  const handleFlagSession = useCallback(async (sessionId: string) => {
    try {
      await api.sessionCommand(sessionId, { type: 'flag' })
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, isFlagged: true } : s
      ))
      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, isFlagged: true } : null)
      }
    } catch (error) {
      console.error('Failed to flag session:', error)
    }
  }, [api, selectedSession?.id])

  const handleUnflagSession = useCallback(async (sessionId: string) => {
    try {
      await api.sessionCommand(sessionId, { type: 'unflag' })
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, isFlagged: false } : s
      ))
      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, isFlagged: false } : null)
      }
    } catch (error) {
      console.error('Failed to unflag session:', error)
    }
  }, [api, selectedSession?.id])

  const handleMarkUnread = useCallback(async (sessionId: string) => {
    try {
      await api.sessionCommand(sessionId, { type: 'markUnread' })
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, lastReadMessageId: undefined } : s
      ))
    } catch (error) {
      console.error('Failed to mark as unread:', error)
    }
  }, [api])

  const handleRenameSession = useCallback(async (sessionId: string, newName: string) => {
    try {
      await api.sessionCommand(sessionId, { type: 'rename', name: newName })
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, name: newName } : s
      ))
      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, name: newName } : null)
      }
    } catch (error) {
      console.error('Failed to rename session:', error)
    }
  }, [api, selectedSession?.id])

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      await api.deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null)
        // Navigate to first available session
        const remainingSessions = sessions.filter(s => s.id !== sessionId)
        if (remainingSessions[0]) {
          handleSelectSession(remainingSessions[0])
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }, [api, selectedSession?.id, sessions, handleSelectSession])

  // Rename session from right sidebar
  const handleRenameFromSidebar = useCallback(async (name: string) => {
    if (!selectedSession) return
    try {
      await api.sessionCommand(selectedSession.id, { type: 'rename', name })
      setSessions(prev => prev.map(s =>
        s.id === selectedSession.id ? { ...s, name } : s
      ))
      setSelectedSession(prev => prev ? { ...prev, name } : null)
    } catch (error) {
      console.error('Failed to rename session:', error)
    }
  }, [api, selectedSession])

  // Toggle flag for selected session
  const handleToggleFlagFromSidebar = useCallback(async () => {
    if (!selectedSession) return
    try {
      const newFlagState = !selectedSession.isFlagged
      await api.sessionCommand(selectedSession.id, { type: newFlagState ? 'flag' : 'unflag' })
      setSessions(prev => prev.map(s =>
        s.id === selectedSession.id ? { ...s, isFlagged: newFlagState } : s
      ))
      setSelectedSession(prev => prev ? { ...prev, isFlagged: newFlagState } : null)
    } catch (error) {
      console.error('Failed to toggle flag:', error)
    }
  }, [api, selectedSession])

  // Handle section change
  const handleSectionChange = (section: NavSection) => {
    setActiveSection(section)
    setShowListPanel(true)
    setOpenMobile(false)
  }

  // Handle back button on mobile
  const handleBackToList = () => {
    setShowListPanel(true)
  }

  // Filter flagged sessions
  const flaggedSessions = sessions.filter(s => s.isFlagged)

  // Filter sessions by status
  const filteredSessions = selectedStatus === 'all'
    ? sessions
    : sessions.filter(s => (s.todoState || 'backlog') === selectedStatus)

  // Group sessions by status for counts
  const sessionCounts = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = sessions.filter(s => (s.todoState || 'backlog') === status).length
    return acc
  }, {} as Record<SessionStatus, number>)

  // Check if we should show the detail view
  const hasDetailView = (activeSection === 'chats' || activeSection === 'flagged') && selectedSession
    || activeSection === 'sources' && selectedSource
    || activeSection === 'settings'

  // Platform info string
  const platformInfo = `${capabilities.canRunLocalMcp ? 'Local MCP' : 'Remote MCP'} • ${capabilities.hasMultiWindow ? 'Multi-window' : 'Single-window'}`

  return (
    <>
      {/* Sidebar with navigation */}
      <AppSidebar
        activeSection={activeSection}
        selectedStatus={selectedStatus}
        onSectionChange={handleSectionChange}
        onStatusChange={setSelectedStatus}
        onNewChat={handleNewSession}
        onLogout={logout}
        sessionCount={sessions.length}
        sessionCounts={sessionCounts}
        flaggedCount={flaggedSessions.length}
        sourcesCount={sources.length}
        skillsCount={skills.length}
        platformInfo={platformInfo}
      />

      {/* Main content area */}
      <SidebarInset className="flex-col">
        {/* Mobile header */}
        <MobileHeader
          activeSection={activeSection}
          selectedStatus={selectedStatus}
          showListPanel={showListPanel}
          hasDetailView={!!hasDetailView}
          onBackToList={handleBackToList}
        />

        {/* Content with navigator panel and detail */}
        <div className="flex flex-1 min-h-0">
          {/* Navigator Panel - List view */}
          <NavigatorPanel
            activeSection={activeSection}
            selectedStatus={selectedStatus}
            showListPanel={showListPanel}
            filteredSessions={filteredSessions}
            flaggedSessions={flaggedSessions}
            selectedSession={selectedSession}
            isLoadingSessions={isLoadingSessions}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            onStatusChange={setSelectedStatus}
            sessionCounts={sessionCounts}
            sources={sources}
            selectedSource={selectedSource}
            isLoadingSources={isLoadingSources}
            onSelectSource={(source) => {
              setSelectedSource(source)
              setShowListPanel(false)
            }}
            skills={skills}
            isLoadingSkills={isLoadingSkills}
            onSettingsSelect={() => setShowListPanel(false)}
            platformInfo={platformInfo}
            onSessionStatusChange={handleStatusChange}
            onFlagSession={handleFlagSession}
            onUnflagSession={handleUnflagSession}
            onMarkUnread={handleMarkUnread}
            onRenameSession={handleRenameSession}
            onDeleteSession={handleDeleteSession}
          />

          {/* Main Content Panel */}
          <div className={`flex-1 flex flex-col min-w-0 ${
            !showListPanel ? 'flex' : 'hidden md:flex'
          }`}>
            {(activeSection === 'chats' || activeSection === 'flagged') && selectedSession ? (
              <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Info button for right sidebar */}
                <button
                  onClick={() => setIsRightSidebarOpen(true)}
                  className="absolute top-3 right-3 z-10 p-2 rounded-lg text-foreground-40 hover:text-foreground hover:bg-foreground/5 transition-colors hidden md:flex"
                  title="Session details"
                >
                  <PanelRight className="w-4 h-4" />
                </button>
                <ChatPage
                  session={selectedSession}
                  onSessionUpdate={handleSessionUpdate}
                />
              </div>
            ) : activeSection === 'sources' && selectedSource ? (
              <SourceDetail source={selectedSource} workspaceId={workspaceId} />
            ) : activeSection === 'settings' ? (
              <SettingsPage workspaceId={workspaceId} />
            ) : (
              <EmptyState section={activeSection} onNewChat={handleNewSession} />
            )}
          </div>

          {/* Right Sidebar - Session Details */}
          <RightSidebar
            session={selectedSession}
            isOpen={isRightSidebarOpen}
            onClose={() => setIsRightSidebarOpen(false)}
            onRenameSession={handleRenameFromSidebar}
            onToggleFlag={handleToggleFlagFromSidebar}
          />
        </div>
      </SidebarInset>
    </>
  )
}

/**
 * Mobile header with back button and menu trigger
 */
function MobileHeader({
  activeSection,
  selectedStatus,
  showListPanel,
  hasDetailView,
  onBackToList,
}: {
  activeSection: NavSection
  selectedStatus: SessionStatus | 'all'
  showListPanel: boolean
  hasDetailView: boolean
  onBackToList: () => void
}) {
  const { toggleSidebar } = useSidebar()

  return (
    <div className="md:hidden flex items-center justify-between p-3 bg-foreground-2 border-b border-foreground/5 shrink-0">
      <div className="flex items-center gap-3">
        {!showListPanel && hasDetailView && (
          <button
            onClick={onBackToList}
            className="p-2 -ml-2 rounded-lg text-foreground-50 hover:bg-foreground/5"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <CraftAgentLogo className="w-7 h-7 text-accent" />
        <span className="font-semibold text-foreground">Craft Agents</span>
      </div>
      <SidebarTrigger className="p-2 rounded-lg text-foreground-50 hover:bg-foreground/5" />
    </div>
  )
}

/**
 * Navigator Panel - the list panel between sidebar and content
 */
function NavigatorPanel({
  activeSection,
  selectedStatus,
  showListPanel,
  filteredSessions,
  flaggedSessions,
  selectedSession,
  isLoadingSessions,
  onSelectSession,
  onNewSession,
  onStatusChange,
  sessionCounts,
  sources,
  selectedSource,
  isLoadingSources,
  onSelectSource,
  skills,
  isLoadingSkills,
  onSettingsSelect,
  platformInfo,
  onSessionStatusChange,
  onFlagSession,
  onUnflagSession,
  onMarkUnread,
  onRenameSession,
  onDeleteSession,
}: {
  activeSection: NavSection
  selectedStatus: SessionStatus | 'all'
  showListPanel: boolean
  filteredSessions: Session[]
  flaggedSessions: Session[]
  selectedSession: Session | null
  isLoadingSessions: boolean
  onSelectSession: (session: Session) => void
  onNewSession: () => void
  onStatusChange: (status: SessionStatus | 'all') => void
  sessionCounts: Record<SessionStatus, number>
  sources: LoadedSource[]
  selectedSource: LoadedSource | null
  isLoadingSources: boolean
  onSelectSource: (source: LoadedSource) => void
  skills: LoadedSkill[]
  isLoadingSkills: boolean
  onSettingsSelect: () => void
  platformInfo: string
  onSessionStatusChange?: (sessionId: string, status: SessionStatus) => void
  onFlagSession?: (sessionId: string) => void
  onUnflagSession?: (sessionId: string) => void
  onMarkUnread?: (sessionId: string) => void
  onRenameSession?: (sessionId: string, newName: string) => void
  onDeleteSession?: (sessionId: string) => void
}) {
  return (
    <div className={`${
      showListPanel ? 'flex' : 'hidden'
    } md:flex w-full md:w-72 flex-col bg-foreground-2 md:shadow-middle md:border-r md:border-foreground/5 shrink-0`}>
      {/* Section header */}
      <div className="p-4 border-b border-foreground/5">
        <h2 className="text-base font-semibold text-foreground capitalize flex items-center gap-2">
          {activeSection === 'chats' && selectedStatus !== 'all' ? (
            <>
              {React.createElement(STATUS_CONFIG[selectedStatus].icon, { className: 'w-4 h-4' })}
              {STATUS_CONFIG[selectedStatus].label}
            </>
          ) : activeSection === 'flagged' ? (
            'Flagged Chats'
          ) : (
            activeSection
          )}
        </h2>
        <p className="text-xs text-foreground-50 mt-0.5">
          {activeSection === 'chats' && (selectedStatus === 'all'
            ? `${filteredSessions.length} conversations`
            : `${filteredSessions.length} in ${STATUS_CONFIG[selectedStatus].label.toLowerCase()}`
          )}
          {activeSection === 'flagged' && `${flaggedSessions.length} flagged`}
          {activeSection === 'sources' && `${sources.length} sources`}
          {activeSection === 'skills' && `${skills.length} skills`}
          {activeSection === 'settings' && 'Workspace settings'}
        </p>
      </div>

      {/* Status filter bar - desktop only, when in chats section */}
      {activeSection === 'chats' && (
        <div className="hidden md:block px-3 py-2 border-b border-foreground/5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onStatusChange('all')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                selectedStatus === 'all'
                  ? 'bg-accent text-white'
                  : 'text-foreground-50 hover:bg-foreground/5'
              }`}
            >
              All
            </button>
            {STATUS_ORDER.map(status => (
              <button
                key={status}
                onClick={() => onStatusChange(status)}
                title={STATUS_CONFIG[status].label}
                className={`p-1.5 rounded transition-colors ${
                  selectedStatus === status
                    ? 'bg-accent text-white'
                    : `${STATUS_CONFIG[status].colorClass} hover:bg-foreground/5`
                }`}
              >
                {React.createElement(STATUS_CONFIG[status].icon, { className: 'w-3.5 h-3.5' })}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action button (for chats) */}
      {(activeSection === 'chats' || activeSection === 'flagged') && (
        <div className="p-3 border-b border-foreground/5">
          <button
            onClick={onNewSession}
            className="w-full px-4 py-3 md:py-2.5 bg-accent text-white rounded-lg shadow-minimal hover:opacity-90 active:opacity-80 transition-opacity font-medium flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>
      )}

      {/* List content */}
      <div className="flex-1 overflow-y-auto">
        {/* Chats list */}
        {activeSection === 'chats' && (
          <SessionList
            sessions={filteredSessions}
            selectedSession={selectedSession}
            isLoading={isLoadingSessions}
            onSelect={onSelectSession}
            emptyMessage={selectedStatus === 'all' ? 'No sessions yet' : `No sessions in ${STATUS_CONFIG[selectedStatus].label.toLowerCase()}`}
            onStatusChange={onSessionStatusChange}
            onFlagSession={onFlagSession}
            onUnflagSession={onUnflagSession}
            onMarkUnread={onMarkUnread}
            onRenameSession={onRenameSession}
            onDeleteSession={onDeleteSession}
          />
        )}

        {/* Flagged list */}
        {activeSection === 'flagged' && (
          <SessionList
            sessions={flaggedSessions}
            selectedSession={selectedSession}
            isLoading={isLoadingSessions}
            onSelect={onSelectSession}
            emptyMessage="No flagged chats"
            onStatusChange={onSessionStatusChange}
            onFlagSession={onFlagSession}
            onUnflagSession={onUnflagSession}
            onMarkUnread={onMarkUnread}
            onRenameSession={onRenameSession}
            onDeleteSession={onDeleteSession}
          />
        )}

        {/* Sources list */}
        {activeSection === 'sources' && (
          <SourcesList
            sources={sources}
            selectedSource={selectedSource}
            isLoading={isLoadingSources}
            onSelect={onSelectSource}
          />
        )}

        {/* Skills list */}
        {activeSection === 'skills' && (
          <SkillsList
            skills={skills}
            isLoading={isLoadingSkills}
          />
        )}

        {/* Settings list */}
        {activeSection === 'settings' && (
          <SettingsList onSelect={onSettingsSelect} />
        )}
      </div>

      {/* Platform info - desktop only */}
      <div className="hidden md:block p-3 border-t border-foreground/5">
        <div className="text-foreground-40 text-xs">
          {platformInfo}
        </div>
      </div>
    </div>
  )
}

/**
 * Session list component
 */
function SessionList({
  sessions,
  selectedSession,
  isLoading,
  onSelect,
  emptyMessage = 'No sessions yet',
  onStatusChange,
  onFlagSession,
  onUnflagSession,
  onMarkUnread,
  onRenameSession,
  onDeleteSession,
}: {
  sessions: Session[]
  selectedSession: Session | null
  isLoading: boolean
  onSelect: (session: Session) => void
  emptyMessage?: string
  onStatusChange?: (sessionId: string, status: SessionStatus) => void
  onFlagSession?: (sessionId: string) => void
  onUnflagSession?: (sessionId: string) => void
  onMarkUnread?: (sessionId: string) => void
  onRenameSession?: (sessionId: string, newName: string) => void
  onDeleteSession?: (sessionId: string) => void
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="text-2xl text-foreground-30" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return <p className="text-center text-foreground-40 py-8 text-sm">{emptyMessage}</p>
  }

  const hasSessionActions = onStatusChange || onFlagSession || onDeleteSession

  return (
    <ul className="px-2 py-1">
      {sessions.map((session) => {
        const status = (session.todoState || 'backlog') as SessionStatus
        const statusConfig = STATUS_CONFIG[status]
        const StatusIcon = statusConfig.icon
        const hasMessages = (session.messages?.length || 0) > 0
        const hasUnreadMessages = session.lastReadMessageId
          ? session.messages?.some(m => m.id && m.id > session.lastReadMessageId!) || false
          : false

        return (
          <li key={session.id}>
            <div className={`group relative flex items-center gap-1 px-3 py-3 md:py-2.5 rounded-lg transition-colors ${
              selectedSession?.id === session.id
                ? 'bg-accent text-white'
                : 'text-foreground hover:bg-foreground/5 active:bg-foreground/10'
            }`}>
              {/* Main clickable area */}
              <button
                onClick={() => onSelect(session)}
                className="flex-1 text-left min-w-0"
              >
                <div className="flex items-center gap-2">
                  {/* Status indicator */}
                  <span className={`shrink-0 ${
                    selectedSession?.id === session.id ? 'text-white' : statusConfig.colorClass
                  }`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-medium truncate text-sm flex-1">
                    {session.name || 'New Chat'}
                  </span>
                  {session.isFlagged && (
                    <Flag className={`w-3 h-3 shrink-0 ${
                      selectedSession?.id === session.id ? 'text-white' : 'text-accent'
                    }`} />
                  )}
                </div>
                {session.preview && (
                  <p className={`text-xs truncate mt-0.5 ml-5.5 ${
                    selectedSession?.id === session.id ? 'text-white/70' : 'text-foreground-50'
                  }`}>
                    {session.preview}
                  </p>
                )}
              </button>

              {/* Session menu */}
              {hasSessionActions && (
                <div className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                  selectedSession?.id === session.id ? 'opacity-100' : ''
                }`}>
                  <SessionMenu
                    sessionId={session.id}
                    sessionName={session.name || 'New Chat'}
                    isFlagged={session.isFlagged || false}
                    hasMessages={hasMessages}
                    hasUnreadMessages={hasUnreadMessages}
                    currentStatus={status}
                    onStatusChange={(newStatus) => onStatusChange?.(session.id, newStatus)}
                    onFlag={() => onFlagSession?.(session.id)}
                    onUnflag={() => onUnflagSession?.(session.id)}
                    onMarkUnread={() => onMarkUnread?.(session.id)}
                    onRename={(newName) => onRenameSession?.(session.id, newName)}
                    onDelete={() => onDeleteSession?.(session.id)}
                  />
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Sources list component
 */
function SourcesList({
  sources,
  selectedSource,
  isLoading,
  onSelect,
}: {
  sources: LoadedSource[]
  selectedSource: LoadedSource | null
  isLoading: boolean
  onSelect: (source: LoadedSource) => void
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="text-2xl text-foreground-30" />
      </div>
    )
  }

  if (sources.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <Plug className="w-8 h-8 text-foreground-30 mx-auto mb-2" />
        <p className="text-foreground-40 text-sm">No sources configured</p>
        <p className="text-foreground-30 text-xs mt-1">
          Add MCP servers or API sources to extend Claude's capabilities
        </p>
      </div>
    )
  }

  return (
    <ul className="px-2 py-1">
      {sources.map((source) => (
        <li key={source.config.slug}>
          <button
            onClick={() => onSelect(source)}
            className={`w-full text-left px-3 py-3 md:py-2.5 rounded-lg transition-colors ${
              selectedSource?.config.slug === source.config.slug
                ? 'bg-accent text-white'
                : 'text-foreground hover:bg-foreground/5 active:bg-foreground/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium truncate text-sm">{source.config.name}</span>
              <SourceStatusBadge source={source} isSelected={selectedSource?.config.slug === source.config.slug} />
            </div>
            <p className={`text-xs mt-0.5 ${
              selectedSource?.config.slug === source.config.slug ? 'text-white/70' : 'text-foreground-50'
            }`}>
              {source.config.type === 'mcp' ? 'MCP Server' : 'API Source'}
            </p>
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Source status badge
 */
function SourceStatusBadge({ source, isSelected }: { source: LoadedSource; isSelected: boolean }) {
  const status = source.config.connectionStatus || 'untested'
  const colors: Record<string, string> = {
    connected: 'bg-success/20 text-success',
    needs_auth: 'bg-warning/20 text-warning',
    failed: 'bg-destructive/20 text-destructive',
    untested: 'bg-foreground/10 text-foreground-50',
    local_disabled: 'bg-foreground/10 text-foreground-50',
  }

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
      isSelected ? 'bg-white/20 text-white' : (colors[status] || colors.untested)
    }`}>
      {status === 'connected' ? 'OK' : status.replace('_', ' ')}
    </span>
  )
}

/**
 * Skills list component
 */
function SkillsList({
  skills,
  isLoading,
}: {
  skills: LoadedSkill[]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="text-2xl text-foreground-30" />
      </div>
    )
  }

  if (skills.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <Wand2 className="w-8 h-8 text-foreground-30 mx-auto mb-2" />
        <p className="text-foreground-40 text-sm">No custom skills</p>
        <p className="text-foreground-30 text-xs mt-1">
          Create SKILL.md files in your workspace to add custom agent skills
        </p>
      </div>
    )
  }

  return (
    <ul className="px-2 py-1">
      {skills.map((skill) => (
        <li key={skill.slug}>
          <div className="px-3 py-3 md:py-2.5 rounded-lg hover:bg-foreground/5 active:bg-foreground/10 transition-colors">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-accent shrink-0" />
              <span className="font-medium text-sm text-foreground">{skill.metadata.name}</span>
            </div>
            {skill.metadata.description && (
              <p className="text-xs text-foreground-50 mt-0.5 line-clamp-2">
                {skill.metadata.description}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * Settings list component
 */
function SettingsList({ onSelect }: { onSelect?: () => void }) {
  const settingItems = [
    { id: 'app', label: 'App Settings', description: 'Theme, model, and preferences' },
    { id: 'workspace', label: 'Workspace', description: 'Name, icon, and defaults' },
    { id: 'permissions', label: 'Permissions', description: 'Tool permissions and patterns' },
  ]

  return (
    <ul className="px-2 py-1">
      {settingItems.map((item) => (
        <li key={item.id}>
          <button
            onClick={onSelect}
            className="w-full text-left px-3 py-3 md:py-2.5 rounded-lg hover:bg-foreground/5 active:bg-foreground/10 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-foreground">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-foreground-30" />
            </div>
            <p className="text-xs text-foreground-50 mt-0.5">{item.description}</p>
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Source detail panel
 */
function SourceDetail({ source, workspaceId }: { source: LoadedSource; workspaceId: string | null }) {
  const api = usePlatformAPI()
  const [tools, setTools] = useState<Array<{ name: string; description?: string; allowed: boolean }>>([])
  const [isLoadingTools, setIsLoadingTools] = useState(false)

  useEffect(() => {
    if (workspaceId && source.config.slug) {
      setIsLoadingTools(true)
      api.getMcpTools(workspaceId, source.config.slug)
        .then(result => {
          if (result.success && result.tools) {
            setTools(result.tools)
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingTools(false))
    }
  }, [api, workspaceId, source.config.slug])

  return (
    <div className="flex-1 bg-foreground-1.5 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <Plug className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{source.config.name}</h1>
            <p className="text-foreground-50">{source.config.type === 'mcp' ? 'MCP Server' : 'API Source'}</p>
          </div>
        </div>

        {source.config.tagline && (
          <p className="text-foreground-70 mb-6">{source.config.tagline}</p>
        )}

        <div className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <h2 className="font-semibold text-foreground mb-4">Available Tools</h2>
          {isLoadingTools ? (
            <div className="flex items-center gap-2 text-foreground-50">
              <Spinner className="text-sm" />
              <span>Loading tools...</span>
            </div>
          ) : tools.length === 0 ? (
            <p className="text-foreground-40 text-sm">No tools available</p>
          ) : (
            <ul className="space-y-2">
              {tools.map((tool) => (
                <li key={tool.name} className="flex items-start gap-3 p-2 rounded-lg bg-foreground/5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${tool.allowed ? 'bg-success' : 'bg-foreground-30'}`} />
                  <div>
                    <div className="font-medium text-sm text-foreground">{tool.name}</div>
                    {tool.description && (
                      <p className="text-xs text-foreground-50 mt-0.5">{tool.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Empty state component
 */
function EmptyState({ section, onNewChat }: { section: NavSection; onNewChat: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-foreground-1.5 p-4">
      <div className="text-center">
        <CraftAgentLogo className="w-16 h-16 text-foreground-10 mx-auto mb-4" />
        {section === 'chats' || section === 'flagged' ? (
          <>
            <p className="text-foreground-50 text-lg mb-1">Welcome to Craft Agents</p>
            <p className="text-foreground-30 text-sm mb-4">Select a chat or create a new one to get started</p>
            <button
              onClick={onNewChat}
              className="px-4 py-3 md:py-2 bg-accent text-white rounded-lg font-medium hover:opacity-90 active:opacity-80 transition-opacity"
            >
              New Chat
            </button>
          </>
        ) : section === 'sources' ? (
          <>
            <p className="text-foreground-50 text-lg mb-1">Sources</p>
            <p className="text-foreground-30 text-sm">Select a source to view its details</p>
          </>
        ) : section === 'skills' ? (
          <>
            <p className="text-foreground-50 text-lg mb-1">Skills</p>
            <p className="text-foreground-30 text-sm">Create SKILL.md files to add custom agent skills</p>
          </>
        ) : null}
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
