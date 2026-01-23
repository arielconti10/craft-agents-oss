/**
 * Platform-agnostic API interface
 *
 * This interface abstracts the communication layer between the UI and backend.
 * - Electron: Implemented via IPC (window.electronAPI)
 * - Web: Implemented via REST API + WebSocket
 *
 * Design principles:
 * - Core functionality only (no platform-specific features)
 * - Async by default (Promise-based)
 * - Event subscriptions return cleanup functions
 */

import type { Message, Workspace, StoredAttachment, ContentBadge } from '@craft-agent/core/types'
import type { PermissionMode } from '../agent/mode-types'
import type { ThinkingLevel } from '../agent/thinking-levels'
import type { LoadedSource, FolderSourceConfig } from '../sources/types'
import type { LoadedSkill } from '../skills/types'
import type { AuthState } from '../auth/types'
import type { AuthType } from '../config/types'
import type { ThemeOverrides, PresetTheme } from '../config/theme'
import type { StatusConfig } from '../statuses'
import type { PermissionsConfigFile } from '../agent'

// ============================================
// Core Types (re-exported for convenience)
// ============================================

export type { PermissionMode, ThinkingLevel }

/**
 * Todo state for sessions (dynamic status ID)
 */
export type TodoState = string

/**
 * Session with messages and runtime state
 */
export interface Session {
  id: string
  workspaceId: string
  workspaceName: string
  name?: string
  preview?: string
  lastMessageAt: number
  messages: Message[]
  isProcessing: boolean
  isFlagged?: boolean
  permissionMode?: PermissionMode
  todoState?: TodoState
  lastReadMessageId?: string
  enabledSourceSlugs?: string[]
  workingDirectory?: string
  sessionFolderPath?: string
  sharedUrl?: string
  sharedId?: string
  model?: string
  thinkingLevel?: ThinkingLevel
  lastMessageRole?: 'user' | 'assistant' | 'plan' | 'tool' | 'error'
  isAsyncOperationOngoing?: boolean
  currentStatus?: {
    message: string
    statusType?: string
  }
  tokenUsage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    contextTokens: number
    costUsd: number
    cacheReadTokens?: number
    cacheCreationTokens?: number
    contextWindow?: number
  }
}

/**
 * Options for creating a new session
 */
export interface CreateSessionOptions {
  permissionMode?: PermissionMode
  workingDirectory?: string | 'user_default' | 'none'
}

/**
 * File attachment for messages
 */
export interface FileAttachment {
  type: 'image' | 'text' | 'pdf' | 'office' | 'unknown'
  path: string
  name: string
  mimeType: string
  base64?: string
  text?: string
  size: number
  thumbnailBase64?: string
}

/**
 * Options for sending messages
 */
export interface SendMessageOptions {
  ultrathinkEnabled?: boolean
  skillSlugs?: string[]
  badges?: ContentBadge[]
}

/**
 * Session command for consolidated operations
 */
export type SessionCommand =
  | { type: 'flag' }
  | { type: 'unflag' }
  | { type: 'rename'; name: string }
  | { type: 'setTodoState'; state: TodoState }
  | { type: 'markRead' }
  | { type: 'markUnread' }
  | { type: 'setPermissionMode'; mode: PermissionMode }
  | { type: 'setThinkingLevel'; level: ThinkingLevel }
  | { type: 'updateWorkingDirectory'; dir: string }
  | { type: 'setSources'; sourceSlugs: string[] }
  | { type: 'shareToViewer' }
  | { type: 'updateShare' }
  | { type: 'revokeShare' }
  | { type: 'startOAuth'; requestId: string }
  | { type: 'refreshTitle' }

/**
 * Result of sharing a session
 */
export interface ShareResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * Result of refreshing session title
 */
export interface RefreshTitleResult {
  success: boolean
  title?: string
  error?: string
}

/**
 * Permission request from agent
 */
export interface PermissionRequest {
  sessionId: string
  requestId: string
  toolName: string
  toolInput: Record<string, unknown>
  riskLevel?: 'low' | 'medium' | 'high'
}

/**
 * Credential input modes
 */
export type CredentialInputMode = 'bearer' | 'header' | 'query' | 'basic'

/**
 * Credential request from agent
 */
export interface CredentialRequest {
  requestId: string
  sourceSlug: string
  sourceName: string
  mode: CredentialInputMode
  headerName?: string
  queryParam?: string
}

/**
 * Credential response from user
 */
export interface CredentialResponse {
  type: 'credential'
  value?: string
  username?: string
  password?: string
  cancelled: boolean
}

/**
 * OAuth result
 */
export interface OAuthResult {
  success: boolean
  error?: string
  accessToken?: string
}

/**
 * MCP tools result
 */
export interface McpToolsResult {
  success: boolean
  error?: string
  tools?: Array<{
    name: string
    description?: string
    allowed: boolean
  }>
}

/**
 * Billing method info
 */
export interface BillingMethodInfo {
  authType: AuthType
  hasCredential: boolean
  apiKey?: string
  anthropicBaseUrl?: string
  customModelNames?: {
    opus?: string
    sonnet?: string
    haiku?: string
  }
}

/**
 * Workspace settings
 */
export interface WorkspaceSettings {
  name?: string
  model?: string
  permissionMode?: PermissionMode
  cyclablePermissionModes?: PermissionMode[]
  thinkingLevel?: ThinkingLevel
  workingDirectory?: string
  localMcpEnabled?: boolean
}

// ============================================
// Session Events (streamed from backend)
// ============================================

import type { Message as CoreMessage, TypedError } from '@craft-agent/core/types'
import type { AuthRequest } from '../agent'

export type SessionEvent =
  | { type: 'text_delta'; sessionId: string; delta: string; turnId?: string }
  | { type: 'text_complete'; sessionId: string; text: string; isIntermediate?: boolean; turnId?: string; parentToolUseId?: string }
  | { type: 'tool_start'; sessionId: string; toolName: string; toolUseId: string; toolInput: Record<string, unknown>; toolIntent?: string; toolDisplayName?: string; turnId?: string; parentToolUseId?: string }
  | { type: 'tool_result'; sessionId: string; toolUseId: string; toolName: string; result: string; turnId?: string; parentToolUseId?: string; isError?: boolean }
  | { type: 'parent_update'; sessionId: string; toolUseId: string; parentToolUseId: string }
  | { type: 'error'; sessionId: string; error: string }
  | { type: 'typed_error'; sessionId: string; error: TypedError }
  | { type: 'complete'; sessionId: string; tokenUsage?: Session['tokenUsage'] }
  | { type: 'interrupted'; sessionId: string; message?: CoreMessage }
  | { type: 'status'; sessionId: string; message: string; statusType?: 'compacting' }
  | { type: 'info'; sessionId: string; message: string; statusType?: 'compaction_complete'; level?: 'info' | 'warning' | 'error' | 'success' }
  | { type: 'title_generated'; sessionId: string; title: string }
  | { type: 'title_regenerating'; sessionId: string; isRegenerating: boolean }
  | { type: 'async_operation'; sessionId: string; isOngoing: boolean }
  | { type: 'working_directory_changed'; sessionId: string; workingDirectory: string }
  | { type: 'permission_request'; sessionId: string; request: PermissionRequest }
  | { type: 'credential_request'; sessionId: string; request: CredentialRequest }
  | { type: 'permission_mode_changed'; sessionId: string; permissionMode: PermissionMode }
  | { type: 'plan_submitted'; sessionId: string; message: CoreMessage }
  | { type: 'sources_changed'; sessionId: string; enabledSourceSlugs: string[] }
  | { type: 'task_backgrounded'; sessionId: string; toolUseId: string; taskId: string; intent?: string; turnId?: string }
  | { type: 'shell_backgrounded'; sessionId: string; toolUseId: string; shellId: string; intent?: string; command?: string; turnId?: string }
  | { type: 'task_progress'; sessionId: string; toolUseId: string; elapsedSeconds: number; turnId?: string }
  | { type: 'shell_killed'; sessionId: string; shellId: string }
  | { type: 'user_message'; sessionId: string; message: CoreMessage; status: 'accepted' | 'queued' | 'processing' }
  | { type: 'session_flagged'; sessionId: string }
  | { type: 'session_unflagged'; sessionId: string }
  | { type: 'session_model_changed'; sessionId: string; model: string | null }
  | { type: 'todo_state_changed'; sessionId: string; todoState: TodoState }
  | { type: 'session_deleted'; sessionId: string }
  | { type: 'session_shared'; sessionId: string; sharedUrl: string }
  | { type: 'session_unshared'; sessionId: string }
  | { type: 'auth_request'; sessionId: string; message: CoreMessage; request: AuthRequest }
  | { type: 'auth_completed'; sessionId: string; requestId: string; success: boolean; cancelled?: boolean; error?: string }
  | { type: 'source_activated'; sessionId: string; sourceSlug: string; originalMessage: string }
  | { type: 'usage_update'; sessionId: string; tokenUsage: { inputTokens: number; contextWindow?: number } }

// ============================================
// Platform API Interface
// ============================================

/**
 * Core platform-agnostic API
 *
 * All methods that both Electron and Web platforms must implement.
 * Platform-specific features (file dialogs, notifications, etc.)
 * are handled separately via PlatformCapabilities.
 */
export interface PlatformAPI {
  // ==========================================
  // Session Management
  // ==========================================

  /** Get all sessions for the current workspace */
  getSessions(): Promise<Session[]>

  /** Get session with full message history */
  getSessionMessages(sessionId: string): Promise<Session | null>

  /** Create a new session */
  createSession(workspaceId: string, options?: CreateSessionOptions): Promise<Session>

  /** Delete a session */
  deleteSession(sessionId: string): Promise<void>

  /** Send a message to a session (response streams via events) */
  sendMessage(
    sessionId: string,
    message: string,
    attachments?: FileAttachment[],
    storedAttachments?: StoredAttachment[],
    options?: SendMessageOptions
  ): Promise<void>

  /** Cancel ongoing processing */
  cancelProcessing(sessionId: string, silent?: boolean): Promise<void>

  /** Kill a background shell */
  killShell(sessionId: string, shellId: string): Promise<{ success: boolean; error?: string }>

  /** Get output from a background task */
  getTaskOutput(taskId: string): Promise<string | null>

  /** Respond to a permission request */
  respondToPermission(
    sessionId: string,
    requestId: string,
    allowed: boolean,
    alwaysAllow: boolean
  ): Promise<boolean>

  /** Respond to a credential request */
  respondToCredential(
    sessionId: string,
    requestId: string,
    response: CredentialResponse
  ): Promise<boolean>

  /** Execute a session command */
  sessionCommand(
    sessionId: string,
    command: SessionCommand
  ): Promise<void | ShareResult | RefreshTitleResult>

  // ==========================================
  // Workspace Management
  // ==========================================

  /** Get all workspaces */
  getWorkspaces(): Promise<Workspace[]>

  /** Create a new workspace */
  createWorkspace(folderPath: string, name: string): Promise<Workspace>

  /** Get workspace settings */
  getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings | null>

  /** Update a workspace setting */
  updateWorkspaceSetting<K extends keyof WorkspaceSettings>(
    workspaceId: string,
    key: K,
    value: WorkspaceSettings[K]
  ): Promise<void>

  // ==========================================
  // Sources (MCP/API connections)
  // ==========================================

  /** Get all sources for a workspace */
  getSources(workspaceId: string): Promise<LoadedSource[]>

  /** Create a new source */
  createSource(workspaceId: string, config: Partial<FolderSourceConfig>): Promise<FolderSourceConfig>

  /** Delete a source */
  deleteSource(workspaceId: string, sourceSlug: string): Promise<void>

  /** Start OAuth flow for a source */
  startSourceOAuth(workspaceId: string, sourceSlug: string): Promise<OAuthResult>

  /** Save credentials for a source */
  saveSourceCredentials(workspaceId: string, sourceSlug: string, credential: string): Promise<void>

  /** Get MCP tools for a source */
  getMcpTools(workspaceId: string, sourceSlug: string): Promise<McpToolsResult>

  /** Get source permissions config */
  getSourcePermissionsConfig(workspaceId: string, sourceSlug: string): Promise<PermissionsConfigFile | null>

  /** Get workspace permissions config */
  getWorkspacePermissionsConfig(workspaceId: string): Promise<PermissionsConfigFile | null>

  // ==========================================
  // Skills
  // ==========================================

  /** Get all skills for a workspace */
  getSkills(workspaceId: string): Promise<LoadedSkill[]>

  /** Delete a skill */
  deleteSkill(workspaceId: string, skillSlug: string): Promise<void>

  // ==========================================
  // Statuses
  // ==========================================

  /** List all statuses for a workspace */
  listStatuses(workspaceId: string): Promise<StatusConfig[]>

  // ==========================================
  // Auth & Settings
  // ==========================================

  /** Get current auth state */
  getAuthState(): Promise<AuthState>

  /** Logout */
  logout(): Promise<void>

  /** Get billing method info */
  getBillingMethod(): Promise<BillingMethodInfo>

  /** Update billing method */
  updateBillingMethod(
    authType: AuthType,
    credential?: string,
    anthropicBaseUrl?: string | null,
    customModelNames?: { opus?: string; sonnet?: string; haiku?: string } | null
  ): Promise<void>

  /** Test API connection */
  testApiConnection(
    apiKey: string,
    baseUrl?: string,
    modelName?: string
  ): Promise<{ success: boolean; error?: string; modelCount?: number }>

  /** Get global model setting */
  getModel(): Promise<string | null>

  /** Set global model */
  setModel(model: string): Promise<void>

  /** Get session-specific model */
  getSessionModel(sessionId: string, workspaceId: string): Promise<string | null>

  /** Set session-specific model */
  setSessionModel(sessionId: string, workspaceId: string, model: string | null): Promise<void>

  // ==========================================
  // Theme
  // ==========================================

  /** Get system theme preference (true = dark) */
  getSystemTheme(): Promise<boolean>

  /** Get app-level theme overrides */
  getAppTheme(): Promise<ThemeOverrides | null>

  /** Load preset themes */
  loadPresetThemes(): Promise<PresetTheme[]>

  /** Load a specific preset theme */
  loadPresetTheme(themeId: string): Promise<PresetTheme | null>

  /** Get current color theme ID */
  getColorTheme(): Promise<string>

  /** Set color theme */
  setColorTheme(themeId: string): Promise<void>

  // ==========================================
  // User Preferences
  // ==========================================

  /** Read user preferences file */
  readPreferences(): Promise<{ content: string; exists: boolean; path: string }>

  /** Write user preferences file */
  writePreferences(content: string): Promise<{ success: boolean; error?: string }>

  // ==========================================
  // Session Drafts
  // ==========================================

  /** Get draft for a session */
  getDraft(sessionId: string): Promise<string | null>

  /** Set draft for a session */
  setDraft(sessionId: string, text: string): Promise<void>

  /** Delete draft for a session */
  deleteDraft(sessionId: string): Promise<void>

  /** Get all drafts */
  getAllDrafts(): Promise<Record<string, string>>

  // ==========================================
  // Event Subscriptions
  // All return cleanup functions
  // ==========================================

  /** Subscribe to session events */
  onSessionEvent(callback: (event: SessionEvent) => void): () => void

  /** Subscribe to system theme changes */
  onSystemThemeChange(callback: (isDark: boolean) => void): () => void

  /** Subscribe to sources changes */
  onSourcesChanged(callback: (sources: LoadedSource[]) => void): () => void

  /** Subscribe to skills changes */
  onSkillsChanged(callback: (skills: LoadedSkill[]) => void): () => void

  /** Subscribe to statuses changes */
  onStatusesChanged(callback: (workspaceId: string) => void): () => void

  /** Subscribe to app theme changes */
  onAppThemeChange(callback: (theme: ThemeOverrides | null) => void): () => void
}

// ============================================
// Platform Capabilities
// ============================================

/**
 * Platform-specific capabilities
 *
 * Features that vary between Electron and Web platforms.
 * UI code can check these to show/hide platform-specific features.
 */
export interface PlatformCapabilities {
  /** Has native file picker dialog */
  hasNativeFileDialog: boolean

  /** Has native file drag-and-drop */
  hasNativeFileDrop: boolean

  /** Has native desktop notifications */
  hasNativeNotifications: boolean

  /** Has native clipboard access */
  hasNativeClipboard: boolean

  /** Supports multiple windows */
  hasMultiWindow: boolean

  /** Has macOS-style traffic lights */
  hasTrafficLights: boolean

  /** Can run stdio MCP servers locally (false for web - runs on server) */
  canRunLocalMcp: boolean

  /** Supports deep links (craftagents://) */
  hasDeepLinks: boolean

  /** Can show files in system file manager */
  canShowInFolder: boolean

  /** Can open files with system default app */
  canOpenFile: boolean

  /** Has auto-update capability */
  hasAutoUpdate: boolean
}

// ============================================
// Platform Context
// ============================================

/**
 * Combined platform context for React components
 */
export interface PlatformContext {
  api: PlatformAPI
  capabilities: PlatformCapabilities
}
