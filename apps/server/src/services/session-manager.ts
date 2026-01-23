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
import type { PermissionsConfigFile, PermissionMode } from '@craft-agent/shared/agent'
import type { AgentEvent, Message, TokenUsage } from '@craft-agent/core/types'
import { generateMessageId } from '@craft-agent/core/types'
import { CraftAgent } from '@craft-agent/shared/agent'
import { broadcastSessionEvent } from '../ws/handler'

/**
 * Extended session with messages
 */
interface SessionWithMessages extends Session {
  messages: Message[]
}

/**
 * Managed session state - holds agent instance and runtime state
 */
interface ManagedSession {
  id: string
  userId: string
  workspaceId: string
  workspaceName: string
  agent: CraftAgent | null
  messages: Message[]
  isProcessing: boolean
  lastMessageAt: number
  streamingText: string
  abortController?: AbortController
  name?: string
  isFlagged: boolean
  permissionMode?: PermissionMode
  sdkSessionId?: string
  tokenUsage?: TokenUsage
  todoState?: string
  thinkingLevel?: 'off' | 'think' | 'max'
  model?: string
  // Pending permission request resolvers
  pendingPermissions: Map<string, (allowed: boolean, alwaysAllow?: boolean) => void>
}

/**
 * User session state
 */
interface UserState {
  sessions: Map<string, ManagedSession>
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

  /**
   * Get or create an agent for a session
   */
  private async getOrCreateAgent(managed: ManagedSession, userId: string): Promise<CraftAgent> {
    if (managed.agent) {
      return managed.agent
    }

    const state = this.getUserState(userId)
    const workspace = state.workspaces.get(managed.workspaceId)

    // Create workspace object for agent
    const workspaceConfig: Workspace = {
      id: managed.workspaceId,
      name: workspace?.name || managed.workspaceName,
      rootPath: workspace?.rootPath || '/tmp/workspace',
      createdAt: Date.now(),
    }

    // Get model from session, user settings, or default
    const model = managed.model || state.settings.model || undefined

    // Create the agent
    managed.agent = new CraftAgent({
      workspace: workspaceConfig,
      model,
      thinkingLevel: managed.thinkingLevel || 'think',
      session: {
        id: managed.id,
        workspaceRootPath: workspaceConfig.rootPath,
        sdkSessionId: managed.sdkSessionId,
        createdAt: managed.lastMessageAt,
        lastUsedAt: managed.lastMessageAt,
      },
      onSdkSessionIdUpdate: (sdkSessionId: string) => {
        managed.sdkSessionId = sdkSessionId
        console.log(`SDK session ID captured for ${managed.id}: ${sdkSessionId}`)
      },
    })

    // Set up permission handler
    managed.agent.onPermissionRequest = (request) => {
      console.log(`Permission request for session ${managed.id}:`, request.command)
      this.broadcast(managed.id, {
        type: 'permission_request',
        sessionId: managed.id,
        request: {
          sessionId: managed.id,
          requestId: request.requestId,
          toolName: request.toolName,
          toolInput: { command: request.command, description: request.description },
        },
      } as SessionEvent)
    }

    // Set up permission mode change handler
    managed.agent.onPermissionModeChange = (mode) => {
      console.log(`Permission mode changed for session ${managed.id}:`, mode)
      managed.permissionMode = mode
      this.broadcast(managed.id, {
        type: 'permission_mode_changed',
        sessionId: managed.id,
        permissionMode: mode,
      } as SessionEvent)
    }

    console.log(`Created agent for session ${managed.id}`)
    return managed.agent
  }

  /**
   * Convert ManagedSession to Session for API responses
   */
  private toSession(managed: ManagedSession): Session {
    return {
      id: managed.id,
      workspaceId: managed.workspaceId,
      workspaceName: managed.workspaceName,
      lastMessageAt: managed.lastMessageAt,
      messages: managed.messages,
      isProcessing: managed.isProcessing,
      name: managed.name,
      isFlagged: managed.isFlagged,
      permissionMode: managed.permissionMode,
      todoState: managed.todoState,
      thinkingLevel: managed.thinkingLevel,
      tokenUsage: managed.tokenUsage,
    }
  }

  // ==========================================
  // Session Management
  // ==========================================

  async getSessions(userId: string): Promise<Session[]> {
    const state = this.getUserState(userId)
    return Array.from(state.sessions.values()).map(m => this.toSession(m))
  }

  async getSessionMessages(userId: string, sessionId: string): Promise<Session | null> {
    const state = this.getUserState(userId)
    const managed = state.sessions.get(sessionId)
    return managed ? this.toSession(managed) : null
  }

  async createSession(
    userId: string,
    workspaceId: string,
    options?: CreateSessionOptions
  ): Promise<Session> {
    const state = this.getUserState(userId)

    const workspace = state.workspaces.get(workspaceId)
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`

    const managed: ManagedSession = {
      id: sessionId,
      userId,
      workspaceId,
      workspaceName: workspace?.name || 'Workspace',
      agent: null,
      messages: [],
      isProcessing: false,
      lastMessageAt: Date.now(),
      streamingText: '',
      isFlagged: false,
      permissionMode: options?.permissionMode as PermissionMode | undefined,
      pendingPermissions: new Map(),
    }

    state.sessions.set(sessionId, managed)
    return this.toSession(managed)
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const state = this.getUserState(userId)
    const managed = state.sessions.get(sessionId)

    // Clean up agent if exists
    if (managed?.agent) {
      // Agent cleanup would go here
    }

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
    const managed = state.sessions.get(sessionId)

    if (!managed) {
      throw new Error('Session not found')
    }

    // Check if API key is configured
    const billingMethod = state.settings.billingMethod
    if (!billingMethod.hasCredential || !billingMethod.apiKey) {
      // Send error event
      this.broadcast(sessionId, {
        type: 'error',
        sessionId,
        error: 'No API key configured. Please add your Anthropic API key in Settings.',
      } as SessionEvent)
      return
    }

    // Set the API key in environment for the agent
    process.env.ANTHROPIC_API_KEY = billingMethod.apiKey
    if (billingMethod.anthropicBaseUrl) {
      process.env.ANTHROPIC_BASE_URL = billingMethod.anthropicBaseUrl
    }

    // Mark as processing
    managed.isProcessing = true
    managed.streamingText = ''
    managed.abortController = new AbortController()

    // Add user message
    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }
    managed.messages.push(userMessage)
    managed.lastMessageAt = Date.now()

    // Broadcast user message event
    this.broadcast(sessionId, {
      type: 'user_message',
      sessionId,
      message: userMessage,
      status: 'processing',
    } as SessionEvent)

    // Generate title from first message
    if (!managed.name && managed.messages.filter(m => m.role === 'user').length === 1) {
      const initialTitle = message.slice(0, 50) + (message.length > 50 ? '...' : '')
      managed.name = initialTitle
      this.broadcast(sessionId, {
        type: 'title_generated',
        sessionId,
        title: initialTitle,
      } as SessionEvent)
    }

    try {
      // Get or create agent
      const agent = await this.getOrCreateAgent(managed, userId)

      console.log(`Starting chat for session ${sessionId}`)
      console.log(`Message: ${message}`)
      console.log(`Model: ${agent.getModel()}`)

      // Process the message through the agent
      const chatIterator = agent.chat(message)

      // Current turn ID for grouping events
      let currentTurnId: string | undefined

      for await (const event of chatIterator) {
        // Log events (skip noisy text_delta)
        if (event.type !== 'text_delta') {
          console.log(`Event: ${event.type}`, event)
        }

        // Process and broadcast the event
        this.processAgentEvent(managed, event)

        // Handle complete event
        if (event.type === 'complete') {
          console.log('Chat completed')
          managed.isProcessing = false

          // Update token usage
          if (event.usage) {
            managed.tokenUsage = {
              inputTokens: event.usage.inputTokens,
              outputTokens: event.usage.outputTokens,
              totalTokens: event.usage.inputTokens + event.usage.outputTokens,
              contextTokens: event.usage.inputTokens,
              costUsd: event.usage.costUsd || 0,
              cacheReadTokens: event.usage.cacheReadTokens,
              cacheCreationTokens: event.usage.cacheCreationTokens,
            }
          }

          this.broadcast(sessionId, {
            type: 'complete',
            sessionId,
            tokenUsage: managed.tokenUsage,
          } as SessionEvent)
          return
        }

        // Check if processing was cancelled
        if (!managed.isProcessing) {
          console.log('Processing cancelled, breaking')
          break
        }
      }
    } catch (error) {
      console.error('Error in chat:', error)

      const isAbortError = error instanceof Error && (
        error.name === 'AbortError' ||
        error.message === 'Request was aborted.' ||
        error.message.includes('aborted')
      )

      if (isAbortError) {
        console.log('Chat aborted by user')
        this.broadcast(sessionId, {
          type: 'interrupted',
          sessionId,
        } as SessionEvent)
      } else {
        // Handle error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Add error message to session
        const errorMsg: Message = {
          id: generateMessageId(),
          role: 'error',
          content: errorMessage,
          timestamp: Date.now(),
          isError: true,
        }
        managed.messages.push(errorMsg)

        this.broadcast(sessionId, {
          type: 'error',
          sessionId,
          error: errorMessage,
        } as SessionEvent)
      }
    } finally {
      managed.isProcessing = false
      managed.abortController = undefined

      // Send complete event
      this.broadcast(sessionId, {
        type: 'complete',
        sessionId,
        tokenUsage: managed.tokenUsage,
      } as SessionEvent)
    }
  }

  /**
   * Process an agent event and broadcast to WebSocket
   */
  private processAgentEvent(managed: ManagedSession, event: AgentEvent): void {
    const sessionId = managed.id

    switch (event.type) {
      case 'text_delta':
        // Accumulate streaming text
        managed.streamingText += event.text
        this.broadcast(sessionId, {
          type: 'text_delta',
          sessionId,
          delta: event.text,
          turnId: event.turnId,
        } as SessionEvent)
        break

      case 'text_complete':
        // Add complete assistant message
        const assistantMessage: Message = {
          id: generateMessageId(),
          role: 'assistant',
          content: event.text,
          timestamp: Date.now(),
          isIntermediate: event.isIntermediate,
          turnId: event.turnId,
        }
        managed.messages.push(assistantMessage)
        managed.streamingText = ''

        this.broadcast(sessionId, {
          type: 'text_complete',
          sessionId,
          text: event.text,
          isIntermediate: event.isIntermediate,
          turnId: event.turnId,
        } as SessionEvent)
        break

      case 'tool_start':
        // Add tool message
        const toolMessage: Message = {
          id: generateMessageId(),
          role: 'tool',
          content: '',
          timestamp: Date.now(),
          toolName: event.toolName,
          toolUseId: event.toolUseId,
          toolInput: event.input,
          toolStatus: 'executing',
          toolIntent: event.intent,
          toolDisplayName: event.displayName,
          turnId: event.turnId,
          parentToolUseId: event.parentToolUseId,
        }
        managed.messages.push(toolMessage)

        this.broadcast(sessionId, {
          type: 'tool_start',
          sessionId,
          toolName: event.toolName,
          toolUseId: event.toolUseId,
          toolInput: event.input,
          toolIntent: event.intent,
          toolDisplayName: event.displayName,
          turnId: event.turnId,
          parentToolUseId: event.parentToolUseId,
        } as SessionEvent)
        break

      case 'tool_result':
        // Update existing tool message with result
        const toolMsg = managed.messages.find(m => m.toolUseId === event.toolUseId)
        const toolName = toolMsg?.toolName || 'unknown'
        if (toolMsg) {
          toolMsg.toolResult = event.result
          toolMsg.toolStatus = event.isError ? 'error' : 'completed'
          toolMsg.isError = event.isError
        }

        this.broadcast(sessionId, {
          type: 'tool_result',
          sessionId,
          toolUseId: event.toolUseId,
          toolName,
          result: event.result,
          isError: event.isError,
          turnId: event.turnId,
        } as SessionEvent)
        break

      case 'permission_request':
        this.broadcast(sessionId, {
          type: 'permission_request',
          sessionId,
          request: {
            sessionId,
            requestId: event.requestId,
            toolName: event.toolName,
            toolInput: { command: event.command, description: event.description },
          },
        } as SessionEvent)
        break

      case 'error':
        const errMsg: Message = {
          id: generateMessageId(),
          role: 'error',
          content: event.message,
          timestamp: Date.now(),
          isError: true,
        }
        managed.messages.push(errMsg)

        this.broadcast(sessionId, {
          type: 'error',
          sessionId,
          error: event.message,
        } as SessionEvent)
        break

      case 'typed_error':
        const typedErrMsg: Message = {
          id: generateMessageId(),
          role: 'error',
          content: event.error.message,
          timestamp: Date.now(),
          isError: true,
          errorCode: event.error.code,
          errorTitle: event.error.title,
          errorDetails: event.error.details,
          errorOriginal: event.error.originalError,
          errorCanRetry: event.error.canRetry,
        }
        managed.messages.push(typedErrMsg)

        this.broadcast(sessionId, {
          type: 'typed_error',
          sessionId,
          error: event.error,
        } as SessionEvent)
        break

      case 'status':
        this.broadcast(sessionId, {
          type: 'status',
          sessionId,
          message: event.message,
        } as SessionEvent)
        break

      case 'info':
        this.broadcast(sessionId, {
          type: 'info',
          sessionId,
          message: event.message,
        } as SessionEvent)
        break

      case 'usage_update':
        this.broadcast(sessionId, {
          type: 'usage_update',
          sessionId,
          tokenUsage: {
            inputTokens: event.usage.inputTokens,
            contextWindow: event.usage.contextWindow,
          },
        } as SessionEvent)
        break

      case 'task_backgrounded':
      case 'shell_backgrounded':
      case 'task_progress':
      case 'shell_killed':
        // Forward background task events
        this.broadcast(sessionId, {
          ...event,
          sessionId,
        } as SessionEvent)
        break

      // Ignore events that don't need broadcasting
      case 'complete':
      case 'working_directory_changed':
      case 'source_activated':
      case 'parent_update':
        break

      default:
        console.log(`Unhandled event type: ${(event as AgentEvent).type}`)
    }
  }

  async cancelProcessing(userId: string, sessionId: string, _silent?: boolean): Promise<void> {
    const state = this.getUserState(userId)
    const managed = state.sessions.get(sessionId)

    if (managed && managed.isProcessing) {
      managed.isProcessing = false

      // Abort the agent
      if (managed.agent) {
        managed.agent.forceAbort()
      }

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
    userId: string,
    sessionId: string,
    requestId: string,
    allowed: boolean,
    _alwaysAllow: boolean
  ): Promise<boolean> {
    const state = this.getUserState(userId)
    const managed = state.sessions.get(sessionId)

    if (!managed?.agent) {
      return false
    }

    // Resolve the pending permission
    const resolver = managed.pendingPermissions.get(requestId)
    if (resolver) {
      resolver(allowed)
      managed.pendingPermissions.delete(requestId)
    }

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
    const managed = state.sessions.get(sessionId)

    if (!managed) {
      throw new Error('Session not found')
    }

    switch (command.type) {
      case 'flag':
        managed.isFlagged = true
        this.broadcast(sessionId, { type: 'session_flagged', sessionId })
        break

      case 'unflag':
        managed.isFlagged = false
        this.broadcast(sessionId, { type: 'session_unflagged', sessionId })
        break

      case 'rename':
        managed.name = command.name
        this.broadcast(sessionId, { type: 'title_generated', sessionId, title: command.name })
        break

      case 'setTodoState':
        managed.todoState = command.state
        this.broadcast(sessionId, { type: 'todo_state_changed', sessionId, todoState: command.state })
        break

      case 'setPermissionMode':
        managed.permissionMode = command.mode as PermissionMode
        this.broadcast(sessionId, { type: 'permission_mode_changed', sessionId, permissionMode: command.mode })
        break

      case 'setThinkingLevel':
        managed.thinkingLevel = command.level
        break

      case 'shareToViewer':
        // TODO: Implement sharing
        return { success: false, error: 'Sharing not yet implemented' }

      case 'refreshTitle':
        // TODO: Implement title generation
        return { success: true, title: managed.name || 'New Chat' }

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
        rootPath: '/workspace',
        createdAt: Date.now(),
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
      rootPath: `/workspaces/${id}`,
      createdAt: Date.now(),
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
      { id: 'todo', label: 'To Do', color: '#6B7280', category: 'open', isFixed: true, isDefault: false, order: 0 },
      { id: 'in-progress', label: 'In Progress', color: '#3B82F6', category: 'open', isFixed: false, isDefault: true, order: 1 },
      { id: 'needs-review', label: 'Needs Review', color: '#F59E0B', category: 'open', isFixed: false, isDefault: true, order: 2 },
      { id: 'done', label: 'Done', color: '#10B981', category: 'closed', isFixed: true, isDefault: false, order: 3 },
      { id: 'cancelled', label: 'Cancelled', color: '#EF4444', category: 'closed', isFixed: true, isDefault: false, order: 4 },
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
    // Return some default themes with minimal theme data
    return [
      { id: 'system', path: '/themes/system.json', theme: { name: 'System' } },
      { id: 'light', path: '/themes/light.json', theme: { name: 'Light' } },
      { id: 'dark', path: '/themes/dark.json', theme: { name: 'Dark' } },
      { id: 'dracula', path: '/themes/dracula.json', theme: { name: 'Dracula' } },
      { id: 'nord', path: '/themes/nord.json', theme: { name: 'Nord' } },
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
