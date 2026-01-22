/**
 * Server-side Session Manager
 *
 * Manages sessions, workspaces, and agent execution for web users.
 * Adapted from the Electron SessionManager for server-side use.
 *
 * Key differences from Electron:
 * - Multi-tenant: sessions are scoped per user
 * - Events broadcast via WebSocket instead of IPC
 * - Credentials stored per-user on server
 */

import type {
  Session,
  CreateSessionOptions,
  SessionCommand,
  ShareResult,
  RefreshTitleResult,
  SessionEvent,
  WorkspaceSettings,
  BillingMethodInfo,
} from '@craft-agent/shared/platform/types'
import type { Workspace } from '@craft-agent/core/types'
import type { LoadedSource, FolderSourceConfig } from '@craft-agent/shared/sources/types'
import type { LoadedSkill } from '@craft-agent/shared/skills/types'
import type { StatusConfig } from '@craft-agent/shared/statuses'
import type { AuthType } from '@craft-agent/shared/config/types'
import type { ThemeOverrides, PresetTheme } from '@craft-agent/shared/config/theme'
import type { PermissionsConfigFile } from '@craft-agent/shared/agent'
import { broadcastSessionEvent } from '../ws/handler'

/**
 * User session state
 */
interface UserState {
  sessions: Map<string, Session>
  workspaces: Map<string, Workspace>
  drafts: Map<string, string>
  settings: {
    model: string | null
    colorTheme: string
    billingMethod: BillingMethodInfo
  }
}

/**
 * Server-side session manager
 *
 * In production, this would be backed by a database.
 * For now, uses in-memory storage.
 */
class ServerSessionManager {
  private users = new Map<string, UserState>()

  /**
   * Get or create user state
   */
  private getUserState(userId: string): UserState {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        sessions: new Map(),
        workspaces: new Map(),
        drafts: new Map(),
        settings: {
          model: null,
          colorTheme: 'system',
          billingMethod: {
            authType: 'api_key',
            hasCredential: false,
          },
        },
      })
    }
    return this.users.get(userId)!
  }

  /**
   * Broadcast an event to WebSocket subscribers
   */
  private broadcast(sessionId: string, event: SessionEvent): void {
    broadcastSessionEvent(sessionId, event)
  }

  // ==========================================
  // Session Management
  // ==========================================

  async getSessions(userId: string): Promise<Session[]> {
    const state = this.getUserState(userId)
    return Array.from(state.sessions.values())
  }

  async getSessionMessages(userId: string, sessionId: string): Promise<Session | null> {
    const state = this.getUserState(userId)
    return state.sessions.get(sessionId) ?? null
  }

  async createSession(
    userId: string,
    workspaceId: string,
    options?: CreateSessionOptions
  ): Promise<Session> {
    const state = this.getUserState(userId)

    const workspace = state.workspaces.get(workspaceId)
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`

    const session: Session = {
      id: sessionId,
      workspaceId,
      workspaceName: workspace?.name || 'Workspace',
      lastMessageAt: Date.now(),
      messages: [],
      isProcessing: false,
      permissionMode: options?.permissionMode,
      workingDirectory: options?.workingDirectory === 'none' ? undefined : options?.workingDirectory,
    }

    state.sessions.set(sessionId, session)
    return session
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const state = this.getUserState(userId)
    state.sessions.delete(sessionId)
    state.drafts.delete(sessionId)

    this.broadcast(sessionId, { type: 'session_deleted', sessionId })
  }

  async sendMessage(
    userId: string,
    sessionId: string,
    message: string,
    _attachments?: unknown[],
    _storedAttachments?: unknown[],
    _options?: unknown
  ): Promise<void> {
    const state = this.getUserState(userId)
    const session = state.sessions.get(sessionId)

    if (!session) {
      throw new Error('Session not found')
    }

    // Mark as processing
    session.isProcessing = true

    // Add user message
    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content: message,
      timestamp: Date.now(),
    }
    session.messages.push(userMessage)
    session.lastMessageAt = Date.now()

    // Broadcast user message event
    this.broadcast(sessionId, {
      type: 'user_message',
      sessionId,
      message: userMessage,
      status: 'processing',
    })

    // TODO: Implement actual agent execution
    // For now, simulate a response
    setTimeout(() => {
      const assistantMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant' as const,
        content: `This is a placeholder response. The server-side agent execution is not yet implemented.\n\nYour message was: "${message}"`,
        timestamp: Date.now(),
      }
      session.messages.push(assistantMessage)
      session.isProcessing = false

      this.broadcast(sessionId, {
        type: 'text_complete',
        sessionId,
        text: assistantMessage.content,
      })

      this.broadcast(sessionId, {
        type: 'complete',
        sessionId,
      })
    }, 1000)
  }

  async cancelProcessing(userId: string, sessionId: string, _silent?: boolean): Promise<void> {
    const state = this.getUserState(userId)
    const session = state.sessions.get(sessionId)

    if (session) {
      session.isProcessing = false
      this.broadcast(sessionId, { type: 'interrupted', sessionId })
    }
  }

  async killShell(
    _userId: string,
    _sessionId: string,
    _shellId: string
  ): Promise<{ success: boolean; error?: string }> {
    // TODO: Implement shell management
    return { success: true }
  }

  async getTaskOutput(_userId: string, _taskId: string): Promise<string | null> {
    // TODO: Implement task output retrieval
    return null
  }

  async respondToPermission(
    _userId: string,
    _sessionId: string,
    _requestId: string,
    _allowed: boolean,
    _alwaysAllow: boolean
  ): Promise<boolean> {
    // TODO: Implement permission response
    return true
  }

  async respondToCredential(
    _userId: string,
    _sessionId: string,
    _requestId: string,
    _response: unknown
  ): Promise<boolean> {
    // TODO: Implement credential response
    return true
  }

  async sessionCommand(
    userId: string,
    sessionId: string,
    command: SessionCommand
  ): Promise<void | ShareResult | RefreshTitleResult> {
    const state = this.getUserState(userId)
    const session = state.sessions.get(sessionId)

    if (!session) {
      throw new Error('Session not found')
    }

    switch (command.type) {
      case 'flag':
        session.isFlagged = true
        this.broadcast(sessionId, { type: 'session_flagged', sessionId })
        break

      case 'unflag':
        session.isFlagged = false
        this.broadcast(sessionId, { type: 'session_unflagged', sessionId })
        break

      case 'rename':
        session.name = command.name
        this.broadcast(sessionId, { type: 'title_generated', sessionId, title: command.name })
        break

      case 'setTodoState':
        session.todoState = command.state
        this.broadcast(sessionId, { type: 'todo_state_changed', sessionId, todoState: command.state })
        break

      case 'setPermissionMode':
        session.permissionMode = command.mode
        this.broadcast(sessionId, { type: 'permission_mode_changed', sessionId, permissionMode: command.mode })
        break

      case 'setThinkingLevel':
        session.thinkingLevel = command.level
        break

      case 'shareToViewer':
        // TODO: Implement sharing
        return { success: false, error: 'Sharing not yet implemented' }

      case 'refreshTitle':
        // TODO: Implement title generation
        return { success: true, title: session.name || 'New Chat' }

      default:
        // Other commands handled silently
        break
    }
  }

  // ==========================================
  // Workspace Management
  // ==========================================

  async getWorkspaces(userId: string): Promise<Workspace[]> {
    const state = this.getUserState(userId)

    // Create a default workspace if none exist
    if (state.workspaces.size === 0) {
      const defaultWorkspace: Workspace = {
        id: 'default',
        name: 'Default Workspace',
        slug: 'default',
        rootPath: '/workspace',
      }
      state.workspaces.set('default', defaultWorkspace)
    }

    return Array.from(state.workspaces.values())
  }

  async createWorkspace(userId: string, _folderPath: string, name: string): Promise<Workspace> {
    const state = this.getUserState(userId)

    const id = `workspace_${Date.now()}`
    const workspace: Workspace = {
      id,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      rootPath: `/workspaces/${id}`,
    }

    state.workspaces.set(id, workspace)
    return workspace
  }

  async getWorkspaceSettings(_userId: string, _workspaceId: string): Promise<WorkspaceSettings | null> {
    // TODO: Implement workspace settings storage
    return {
      permissionMode: 'ask',
      thinkingLevel: 'think',
    }
  }

  async updateWorkspaceSetting(
    _userId: string,
    _workspaceId: string,
    _key: string,
    _value: unknown
  ): Promise<void> {
    // TODO: Implement workspace settings update
  }

  async getWorkspacePermissionsConfig(
    _userId: string,
    _workspaceId: string
  ): Promise<PermissionsConfigFile | null> {
    return null
  }

  // ==========================================
  // Sources
  // ==========================================

  async getSources(_userId: string, _workspaceId: string): Promise<LoadedSource[]> {
    // TODO: Implement source storage
    return []
  }

  async createSource(
    _userId: string,
    _workspaceId: string,
    config: Partial<FolderSourceConfig>
  ): Promise<FolderSourceConfig> {
    // TODO: Implement source creation
    return config as FolderSourceConfig
  }

  async deleteSource(_userId: string, _workspaceId: string, _sourceSlug: string): Promise<void> {
    // TODO: Implement source deletion
  }

  async startSourceOAuth(
    _userId: string,
    _workspaceId: string,
    _sourceSlug: string
  ): Promise<{ success: boolean; error?: string; accessToken?: string }> {
    return { success: false, error: 'OAuth not yet implemented' }
  }

  async saveSourceCredentials(
    _userId: string,
    _workspaceId: string,
    _sourceSlug: string,
    _credential: string
  ): Promise<void> {
    // TODO: Implement credential storage
  }

  async getMcpTools(
    _userId: string,
    _workspaceId: string,
    _sourceSlug: string
  ): Promise<{ success: boolean; error?: string; tools?: unknown[] }> {
    return { success: true, tools: [] }
  }

  async getSourcePermissionsConfig(
    _userId: string,
    _workspaceId: string,
    _sourceSlug: string
  ): Promise<PermissionsConfigFile | null> {
    return null
  }

  // ==========================================
  // Skills
  // ==========================================

  async getSkills(_userId: string, _workspaceId: string): Promise<LoadedSkill[]> {
    return []
  }

  async deleteSkill(_userId: string, _workspaceId: string, _skillSlug: string): Promise<void> {
    // TODO: Implement skill deletion
  }

  // ==========================================
  // Statuses
  // ==========================================

  async listStatuses(_userId: string, _workspaceId: string): Promise<StatusConfig[]> {
    // Return default statuses
    return [
      { id: 'todo', name: 'To Do', color: '#6B7280' },
      { id: 'in-progress', name: 'In Progress', color: '#3B82F6' },
      { id: 'needs-review', name: 'Needs Review', color: '#F59E0B' },
      { id: 'done', name: 'Done', color: '#10B981' },
      { id: 'cancelled', name: 'Cancelled', color: '#EF4444' },
    ]
  }

  // ==========================================
  // Settings
  // ==========================================

  async getBillingMethod(userId: string): Promise<BillingMethodInfo> {
    const state = this.getUserState(userId)
    return state.settings.billingMethod
  }

  async updateBillingMethod(
    userId: string,
    authType: AuthType,
    credential?: string,
    anthropicBaseUrl?: string | null,
    customModelNames?: { opus?: string; sonnet?: string; haiku?: string } | null
  ): Promise<void> {
    const state = this.getUserState(userId)
    state.settings.billingMethod = {
      authType,
      hasCredential: !!credential,
      apiKey: authType === 'api_key' ? credential : undefined,
      anthropicBaseUrl: anthropicBaseUrl ?? undefined,
      customModelNames: customModelNames ?? undefined,
    }
  }

  async testApiConnection(
    apiKey: string,
    _baseUrl?: string,
    _modelName?: string
  ): Promise<{ success: boolean; error?: string; modelCount?: number }> {
    // TODO: Implement actual API test
    if (!apiKey.startsWith('sk-')) {
      return { success: false, error: 'Invalid API key format' }
    }
    return { success: true, modelCount: 3 }
  }

  async getModel(userId: string): Promise<string | null> {
    const state = this.getUserState(userId)
    return state.settings.model
  }

  async setModel(userId: string, model: string): Promise<void> {
    const state = this.getUserState(userId)
    state.settings.model = model
  }

  // ==========================================
  // Theme
  // ==========================================

  async getAppTheme(_userId: string): Promise<ThemeOverrides | null> {
    return null
  }

  async getColorTheme(userId: string): Promise<string> {
    const state = this.getUserState(userId)
    return state.settings.colorTheme
  }

  async setColorTheme(userId: string, themeId: string): Promise<void> {
    const state = this.getUserState(userId)
    state.settings.colorTheme = themeId
  }

  async loadPresetThemes(): Promise<PresetTheme[]> {
    // Return some default themes
    return [
      { id: 'system', name: 'System', colors: {} },
      { id: 'light', name: 'Light', colors: {} },
      { id: 'dark', name: 'Dark', colors: {} },
      { id: 'dracula', name: 'Dracula', colors: {} },
      { id: 'nord', name: 'Nord', colors: {} },
    ]
  }

  async loadPresetTheme(themeId: string): Promise<PresetTheme | null> {
    const presets = await this.loadPresetThemes()
    return presets.find(p => p.id === themeId) ?? null
  }

  // ==========================================
  // Preferences
  // ==========================================

  async readPreferences(_userId: string): Promise<{ content: string; exists: boolean; path: string }> {
    return {
      content: '',
      exists: false,
      path: '/preferences.json',
    }
  }

  async writePreferences(
    _userId: string,
    _content: string
  ): Promise<{ success: boolean; error?: string }> {
    return { success: true }
  }

  // ==========================================
  // Drafts
  // ==========================================

  async getDraft(userId: string, sessionId: string): Promise<string | null> {
    const state = this.getUserState(userId)
    return state.drafts.get(sessionId) ?? null
  }

  async setDraft(userId: string, sessionId: string, text: string): Promise<void> {
    const state = this.getUserState(userId)
    state.drafts.set(sessionId, text)
  }

  async deleteDraft(userId: string, sessionId: string): Promise<void> {
    const state = this.getUserState(userId)
    state.drafts.delete(sessionId)
  }

  async getAllDrafts(userId: string): Promise<Record<string, string>> {
    const state = this.getUserState(userId)
    return Object.fromEntries(state.drafts)
  }
}

// Global session manager instance
let sessionManager: ServerSessionManager | null = null

/**
 * Get the global session manager instance
 */
export function getSessionManager(): ServerSessionManager {
  if (!sessionManager) {
    sessionManager = new ServerSessionManager()
  }
  return sessionManager
}
