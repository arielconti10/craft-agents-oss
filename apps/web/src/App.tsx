/**
 * Craft Agents Web App
 *
 * Main application component with responsive layout:
 * - Desktop: 3-panel layout (nav sidebar, list panel, content)
 * - Mobile: Single panel with bottom navigation and slide-out drawer
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth, usePlatformAPI, usePlatformCapabilities } from './contexts/PlatformContext'
import { LoginPage } from './pages/LoginPage'
import { ChatPage } from './pages/ChatPage'
import type { Session, WorkspaceSettings } from '@craft-agent/shared/platform'
import type { LoadedSource } from '@craft-agent/shared/sources/types'
import type { LoadedSkill } from '@craft-agent/shared/skills/types'
import { Spinner } from '@craft-agent/ui'
import {
  MessageSquare,
  Plug,
  Wand2,
  Settings,
  Flag,
  Plus,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

// Navigation sections
type NavSection = 'chats' | 'flagged' | 'sources' | 'skills' | 'settings'

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

  // Navigation state
  const [activeSection, setActiveSection] = useState<NavSection>('chats')

  // Mobile UI state
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [showListPanel, setShowListPanel] = useState(true)

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

  // Settings state
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings | null>(null)
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)

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

  // Load settings when section changes
  useEffect(() => {
    if (activeSection === 'settings' && workspaceId && !workspaceSettings) {
      setIsLoadingSettings(true)
      api.getWorkspaceSettings(workspaceId)
        .then(setWorkspaceSettings)
        .catch(console.error)
        .finally(() => setIsLoadingSettings(false))
    }
  }, [activeSection, workspaceId, api, workspaceSettings])

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
      setIsMobileNavOpen(false)
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  // Select a session
  const handleSelectSession = async (session: Session) => {
    const fullSession = await api.getSessionMessages(session.id)
    setSelectedSession(fullSession)
    setShowListPanel(false) // Show chat on mobile
    setIsMobileNavOpen(false)
  }

  // Update session in list after changes
  const handleSessionUpdate = useCallback((updatedSession: Session) => {
    setSessions(prev => prev.map(s =>
      s.id === updatedSession.id ? { ...s, name: updatedSession.name } : s
    ))
    setSelectedSession(updatedSession)
  }, [])

  // Handle section change
  const handleSectionChange = (section: NavSection) => {
    setActiveSection(section)
    setShowListPanel(true)
    setIsMobileNavOpen(false)
  }

  // Handle back button on mobile
  const handleBackToList = () => {
    setShowListPanel(true)
  }

  // Filter flagged sessions
  const flaggedSessions = sessions.filter(s => s.isFlagged)

  // Check if we should show the detail view
  const hasDetailView = (activeSection === 'chats' || activeSection === 'flagged') && selectedSession
    || activeSection === 'sources' && selectedSource
    || activeSection === 'settings'

  return (
    <div className="h-screen bg-background flex flex-col md:flex-row overflow-hidden">
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between p-3 bg-foreground-2 border-b border-foreground/5 shrink-0">
        <div className="flex items-center gap-3">
          {!showListPanel && hasDetailView && (
            <button
              onClick={handleBackToList}
              className="p-2 -ml-2 rounded-lg text-foreground-50 hover:bg-foreground/5"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <CraftAgentLogo className="w-7 h-7 text-accent" />
          <span className="font-semibold text-foreground">Craft Agents</span>
        </div>
        <button
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className="p-2 rounded-lg text-foreground-50 hover:bg-foreground/5"
        >
          {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile navigation overlay */}
      {isMobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      {/* Mobile navigation drawer */}
      <div className={`md:hidden fixed top-14 right-0 bottom-0 w-64 bg-foreground-2 z-50 transform transition-transform duration-200 ease-out ${
        isMobileNavOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <nav className="p-4 space-y-1">
          <MobileNavButton
            icon={<MessageSquare className="w-5 h-5" />}
            label="All Chats"
            isActive={activeSection === 'chats'}
            onClick={() => handleSectionChange('chats')}
          />
          <MobileNavButton
            icon={<Flag className="w-5 h-5" />}
            label="Flagged"
            isActive={activeSection === 'flagged'}
            onClick={() => handleSectionChange('flagged')}
            badge={flaggedSessions.length > 0 ? flaggedSessions.length : undefined}
          />
          <MobileNavButton
            icon={<Plug className="w-5 h-5" />}
            label="Sources"
            isActive={activeSection === 'sources'}
            onClick={() => handleSectionChange('sources')}
          />
          <MobileNavButton
            icon={<Wand2 className="w-5 h-5" />}
            label="Skills"
            isActive={activeSection === 'skills'}
            onClick={() => handleSectionChange('skills')}
          />
          <MobileNavButton
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            isActive={activeSection === 'settings'}
            onClick={() => handleSectionChange('settings')}
          />
          <div className="pt-4 mt-4 border-t border-foreground/10">
            <MobileNavButton
              icon={<LogOut className="w-5 h-5" />}
              label="Logout"
              onClick={logout}
            />
          </div>
        </nav>
      </div>

      {/* Desktop Left Sidebar - Navigation */}
      <div className="hidden md:flex w-14 flex-col items-center py-3 bg-foreground-3 border-r border-foreground/5 shrink-0">
        {/* Logo */}
        <div className="mb-4">
          <CraftAgentLogo className="w-8 h-8 text-accent" />
        </div>

        {/* Navigation buttons */}
        <nav className="flex-1 flex flex-col gap-1">
          <NavButton
            icon={<MessageSquare className="w-5 h-5" />}
            label="Chats"
            isActive={activeSection === 'chats'}
            onClick={() => setActiveSection('chats')}
          />
          <NavButton
            icon={<Flag className="w-5 h-5" />}
            label="Flagged"
            isActive={activeSection === 'flagged'}
            onClick={() => setActiveSection('flagged')}
            badge={flaggedSessions.length > 0 ? flaggedSessions.length : undefined}
          />
          <NavButton
            icon={<Plug className="w-5 h-5" />}
            label="Sources"
            isActive={activeSection === 'sources'}
            onClick={() => setActiveSection('sources')}
          />
          <NavButton
            icon={<Wand2 className="w-5 h-5" />}
            label="Skills"
            isActive={activeSection === 'skills'}
            onClick={() => setActiveSection('skills')}
          />
        </nav>

        {/* Bottom nav */}
        <div className="flex flex-col gap-1">
          <NavButton
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            isActive={activeSection === 'settings'}
            onClick={() => setActiveSection('settings')}
          />
          <NavButton
            icon={<LogOut className="w-5 h-5" />}
            label="Logout"
            onClick={logout}
          />
        </div>
      </div>

      {/* Navigator Panel - List view (desktop always, mobile conditionally) */}
      <div className={`${
        showListPanel ? 'flex' : 'hidden'
      } md:flex w-full md:w-72 flex-col bg-foreground-2 md:shadow-middle shrink-0`}>
        {/* Section header */}
        <div className="p-4 border-b border-foreground/5">
          <h2 className="text-base font-semibold text-foreground capitalize">
            {activeSection === 'flagged' ? 'Flagged Chats' : activeSection}
          </h2>
          <p className="text-xs text-foreground-50 mt-0.5">
            {activeSection === 'chats' && `${sessions.length} conversations`}
            {activeSection === 'flagged' && `${flaggedSessions.length} flagged`}
            {activeSection === 'sources' && `${sources.length} sources`}
            {activeSection === 'skills' && `${skills.length} skills`}
            {activeSection === 'settings' && 'Workspace settings'}
          </p>
        </div>

        {/* Action button (for chats) */}
        {(activeSection === 'chats' || activeSection === 'flagged') && (
          <div className="p-3 border-b border-foreground/5">
            <button
              onClick={handleNewSession}
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
              sessions={sessions}
              selectedSession={selectedSession}
              isLoading={isLoadingSessions}
              onSelect={handleSelectSession}
            />
          )}

          {/* Flagged list */}
          {activeSection === 'flagged' && (
            <SessionList
              sessions={flaggedSessions}
              selectedSession={selectedSession}
              isLoading={isLoadingSessions}
              onSelect={handleSelectSession}
              emptyMessage="No flagged chats"
            />
          )}

          {/* Sources list */}
          {activeSection === 'sources' && (
            <SourcesList
              sources={sources}
              selectedSource={selectedSource}
              isLoading={isLoadingSources}
              onSelect={(source) => {
                setSelectedSource(source)
                setShowListPanel(false)
              }}
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
            <SettingsList onSelect={() => setShowListPanel(false)} />
          )}
        </div>

        {/* Platform info - desktop only */}
        <div className="hidden md:block p-3 border-t border-foreground/5">
          <div className="text-foreground-40 text-xs">
            {capabilities.canRunLocalMcp ? 'Local MCP' : 'Remote MCP'} •
            {capabilities.hasMultiWindow ? ' Multi-window' : ' Single-window'}
          </div>
        </div>
      </div>

      {/* Main Content Panel */}
      <div className={`flex-1 flex flex-col min-w-0 ${
        !showListPanel ? 'flex' : 'hidden md:flex'
      }`}>
        {(activeSection === 'chats' || activeSection === 'flagged') && selectedSession ? (
          <ChatPage
            session={selectedSession}
            onSessionUpdate={handleSessionUpdate}
          />
        ) : activeSection === 'sources' && selectedSource ? (
          <SourceDetail source={selectedSource} workspaceId={workspaceId} />
        ) : activeSection === 'settings' ? (
          <SettingsDetail
            settings={workspaceSettings}
            isLoading={isLoadingSettings}
            workspaceId={workspaceId}
          />
        ) : (
          <EmptyState section={activeSection} onNewChat={handleNewSession} />
        )}
      </div>
    </div>
  )
}

/**
 * Desktop Navigation button component
 */
function NavButton({
  icon,
  label,
  isActive,
  onClick,
  badge,
}: {
  icon: React.ReactNode
  label: string
  isActive?: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative ${
        isActive
          ? 'bg-accent text-white'
          : 'text-foreground-50 hover:bg-foreground/5 hover:text-foreground'
      }`}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

/**
 * Mobile Navigation button component
 */
function MobileNavButton({
  icon,
  label,
  isActive,
  onClick,
  badge,
}: {
  icon: React.ReactNode
  label: string
  isActive?: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive
          ? 'bg-accent text-white'
          : 'text-foreground hover:bg-foreground/5'
      }`}
    >
      {icon}
      <span className="flex-1 text-left font-medium">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`px-2 py-0.5 text-xs rounded-full ${
          isActive ? 'bg-white/20' : 'bg-accent text-white'
        }`}>
          {badge}
        </span>
      )}
    </button>
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
}: {
  sessions: Session[]
  selectedSession: Session | null
  isLoading: boolean
  onSelect: (session: Session) => void
  emptyMessage?: string
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

  return (
    <ul className="px-2 py-1">
      {sessions.map((session) => (
        <li key={session.id}>
          <button
            onClick={() => onSelect(session)}
            className={`w-full text-left px-3 py-3 md:py-2.5 rounded-lg transition-colors ${
              selectedSession?.id === session.id
                ? 'bg-accent text-white'
                : 'text-foreground hover:bg-foreground/5 active:bg-foreground/10'
            }`}
          >
            <div className="flex items-center gap-2">
              {session.isFlagged && (
                <Flag className={`w-3 h-3 shrink-0 ${
                  selectedSession?.id === session.id ? 'text-white' : 'text-accent'
                }`} />
              )}
              <span className="font-medium truncate text-sm">
                {session.name || 'New Chat'}
              </span>
            </div>
            {session.preview && (
              <p className={`text-xs truncate mt-0.5 ${
                selectedSession?.id === session.id ? 'text-white/70' : 'text-foreground-50'
              }`}>
                {session.preview}
              </p>
            )}
          </button>
        </li>
      ))}
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
 * Settings detail panel
 */
function SettingsDetail({
  settings,
  isLoading,
  workspaceId,
}: {
  settings: WorkspaceSettings | null
  isLoading: boolean
  workspaceId: string | null
}) {
  if (isLoading) {
    return (
      <div className="flex-1 bg-foreground-1.5 flex items-center justify-center">
        <Spinner className="text-2xl text-foreground-30" />
      </div>
    )
  }

  return (
    <div className="flex-1 bg-foreground-1.5 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        <h1 className="text-xl md:text-2xl font-bold text-foreground mb-6">Settings</h1>

        {/* Workspace Settings */}
        <div className="bg-foreground-2 rounded-xl p-4 md:p-6 mb-6">
          <h2 className="font-semibold text-foreground mb-4">Workspace</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground-70 mb-1">Name</label>
              <p className="text-foreground">{settings?.name || 'Default Workspace'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-70 mb-1">Default Model</label>
              <p className="text-foreground">{settings?.model || 'claude-sonnet-4-20250514'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-70 mb-1">Permission Mode</label>
              <p className="text-foreground capitalize">{settings?.permissionMode || 'ask'}</p>
            </div>
          </div>
        </div>

        {/* App Settings */}
        <div className="bg-foreground-2 rounded-xl p-4 md:p-6">
          <h2 className="font-semibold text-foreground mb-4">App</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground-70 mb-1">Theme</label>
              <p className="text-foreground">System (Auto)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-70 mb-1">Platform</label>
              <p className="text-foreground">Web Edition</p>
            </div>
          </div>
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
