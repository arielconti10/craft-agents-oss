/**
 * Web implementation of PlatformAPI
 *
 * Implements PlatformAPI using REST API + WebSocket for the web app.
 * The backend server handles MCP orchestration and session management.
 */

import type {
  PlatformAPI,
  PlatformCapabilities,
  Session,
  CreateSessionOptions,
  FileAttachment,
  SendMessageOptions,
  SessionCommand,
  ShareResult,
  RefreshTitleResult,
  CredentialResponse,
  OAuthResult,
  McpToolsResult,
  BillingMethodInfo,
  WorkspaceSettings,
  SessionEvent,
} from './types'
import type { Workspace, StoredAttachment } from '@craft-agent/core/types'
import type { LoadedSource, FolderSourceConfig } from '../sources/types'
import type { LoadedSkill } from '../skills/types'
import type { AuthState } from '../auth/types'
import type { AuthType } from '../config/types'
import type { ThemeOverrides, PresetTheme } from '../config/theme'
import type { StatusConfig } from '../statuses'
import type { PermissionsConfigFile } from '../agent'

/**
 * Configuration for WebPlatformAPI
 */
export interface WebPlatformConfig {
  /** Base URL for REST API (e.g., 'https://api.example.com' or '/api') */
  baseUrl: string
  /** WebSocket URL (e.g., 'wss://api.example.com/ws' or derived from baseUrl) */
  wsUrl?: string
}

/**
 * WebSocket message types
 */
interface WebSocketMessage {
  type: 'session_event' | 'pong' | 'error' | 'connected'
  sessionId?: string
  event?: SessionEvent
  message?: string
}

/**
 * Web implementation of PlatformAPI
 *
 * Uses REST API for request/response operations and WebSocket
 * for real-time streaming of session events.
 */
export class WebPlatformAPI implements PlatformAPI {
  private baseUrl: string
  private wsUrl: string
  private ws: WebSocket | null = null
  private wsReconnectAttempts = 0
  private wsMaxReconnectAttempts = 5
  private wsReconnectDelay = 1000
  private authToken: string | null = null

  // Event handlers by session ID
  private sessionEventHandlers = new Set<(event: SessionEvent) => void>()
  private systemThemeHandlers = new Set<(isDark: boolean) => void>()
  private sourcesHandlers = new Set<(sources: LoadedSource[]) => void>()
  private skillsHandlers = new Set<(skills: LoadedSkill[]) => void>()
  private statusesHandlers = new Set<(workspaceId: string) => void>()
  private themeHandlers = new Set<(theme: ThemeOverrides | null) => void>()

  // Subscribed session IDs for WebSocket filtering
  private subscribedSessions = new Set<string>()

  constructor(config: WebPlatformConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.wsUrl = config.wsUrl || this.deriveWsUrl(this.baseUrl)

    // Set up system theme listener using browser API
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', (e) => {
        this.systemThemeHandlers.forEach(handler => handler(e.matches))
      })
    }
  }

  /**
   * Derive WebSocket URL from base URL
   */
  private deriveWsUrl(baseUrl: string): string {
    const url = new URL(baseUrl, window.location.origin)
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${url.host}${url.pathname}/ws`
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string | null): void {
    this.authToken = token
    // Reconnect WebSocket with new token
    if (this.ws) {
      this.disconnectWebSocket()
      if (token) {
        this.connectWebSocket()
      }
    }
  }

  /**
   * Connect to WebSocket for real-time events
   */
  connectWebSocket(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return
    if (!this.authToken) return

    const url = `${this.wsUrl}?token=${encodeURIComponent(this.authToken)}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.wsReconnectAttempts = 0
      // Re-subscribe to all sessions
      this.subscribedSessions.forEach(sessionId => {
        this.sendWsMessage({ type: 'subscribe', sessionId })
      })
    }

    this.ws.onmessage = (event) => {
      try {
        const msg: WebSocketMessage = JSON.parse(event.data)
        this.handleWebSocketMessage(msg)
      } catch {
        console.error('Failed to parse WebSocket message:', event.data)
      }
    }

    this.ws.onclose = () => {
      this.ws = null
      this.scheduleReconnect()
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Schedule WebSocket reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.wsReconnectAttempts >= this.wsMaxReconnectAttempts) {
      console.error('Max WebSocket reconnect attempts reached')
      return
    }

    const delay = this.wsReconnectDelay * Math.pow(2, this.wsReconnectAttempts)
    this.wsReconnectAttempts++

    setTimeout(() => {
      if (this.authToken) {
        this.connectWebSocket()
      }
    }, delay)
  }

  /**
   * Send a message over WebSocket
   */
  private sendWsMessage(msg: { type: string; sessionId?: string }): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleWebSocketMessage(msg: WebSocketMessage): void {
    switch (msg.type) {
      case 'session_event':
        if (msg.event) {
          this.sessionEventHandlers.forEach(handler => handler(msg.event!))
        }
        break
      case 'pong':
        // Heartbeat response
        break
      case 'error':
        console.error('WebSocket error:', msg.message)
        break
    }
  }

  /**
   * Subscribe to a session's events
   */
  private subscribeToSession(sessionId: string): void {
    this.subscribedSessions.add(sessionId)
    this.sendWsMessage({ type: 'subscribe', sessionId })
  }

  /**
   * Unsubscribe from a session's events
   */
  private unsubscribeFromSession(sessionId: string): void {
    this.subscribedSessions.delete(sessionId)
    this.sendWsMessage({ type: 'unsubscribe', sessionId })
  }

  /**
   * Make an authenticated fetch request
   */
  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error ${response.status}: ${errorText}`)
    }

    // Handle empty responses
    const text = await response.text()
    if (!text) return undefined as T

    return JSON.parse(text)
  }

  // ==========================================
  // Session Management
  // ==========================================

  async getSessions(): Promise<Session[]> {
    return this.fetch('/sessions')
  }

  async getSessionMessages(sessionId: string): Promise<Session | null> {
    try {
      const session = await this.fetch<Session>(`/sessions/${sessionId}`)
      // Subscribe to this session's events
      this.subscribeToSession(sessionId)
      return session
    } catch {
      return null
    }
  }

  async createSession(workspaceId: string, options?: CreateSessionOptions): Promise<Session> {
    const session = await this.fetch<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ workspaceId, options }),
    })
    // Subscribe to new session's events
    this.subscribeToSession(session.id)
    return session
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.fetch(`/sessions/${sessionId}`, { method: 'DELETE' })
    this.unsubscribeFromSession(sessionId)
  }

  async sendMessage(
    sessionId: string,
    message: string,
    attachments?: FileAttachment[],
    storedAttachments?: StoredAttachment[],
    options?: SendMessageOptions
  ): Promise<void> {
    await this.fetch(`/sessions/${sessionId}/message`, {
      method: 'POST',
      body: JSON.stringify({ message, attachments, storedAttachments, options }),
    })
    // Response streams via WebSocket
  }

  async cancelProcessing(sessionId: string, silent?: boolean): Promise<void> {
    await this.fetch(`/sessions/${sessionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ silent }),
    })
  }

  async killShell(sessionId: string, shellId: string): Promise<{ success: boolean; error?: string }> {
    return this.fetch(`/sessions/${sessionId}/shells/${shellId}`, {
      method: 'DELETE',
    })
  }

  async getTaskOutput(taskId: string): Promise<string | null> {
    try {
      const result = await this.fetch<{ output: string | null }>(`/tasks/${taskId}/output`)
      return result.output
    } catch {
      return null
    }
  }

  async respondToPermission(
    sessionId: string,
    requestId: string,
    allowed: boolean,
    alwaysAllow: boolean
  ): Promise<boolean> {
    const result = await this.fetch<{ success: boolean }>(`/sessions/${sessionId}/permission`, {
      method: 'POST',
      body: JSON.stringify({ requestId, allowed, alwaysAllow }),
    })
    return result.success
  }

  async respondToCredential(
    sessionId: string,
    requestId: string,
    response: CredentialResponse
  ): Promise<boolean> {
    const result = await this.fetch<{ success: boolean }>(`/sessions/${sessionId}/credential`, {
      method: 'POST',
      body: JSON.stringify({ requestId, response }),
    })
    return result.success
  }

  async sessionCommand(
    sessionId: string,
    command: SessionCommand
  ): Promise<void | ShareResult | RefreshTitleResult> {
    return this.fetch(`/sessions/${sessionId}/command`, {
      method: 'POST',
      body: JSON.stringify(command),
    })
  }

  // ==========================================
  // Workspace Management
  // ==========================================

  async getWorkspaces(): Promise<Workspace[]> {
    return this.fetch('/workspaces')
  }

  async createWorkspace(folderPath: string, name: string): Promise<Workspace> {
    return this.fetch('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ folderPath, name }),
    })
  }

  async getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings | null> {
    try {
      return await this.fetch(`/workspaces/${workspaceId}/settings`)
    } catch {
      return null
    }
  }

  async updateWorkspaceSetting<K extends keyof WorkspaceSettings>(
    workspaceId: string,
    key: K,
    value: WorkspaceSettings[K]
  ): Promise<void> {
    await this.fetch(`/workspaces/${workspaceId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({ [key]: value }),
    })
  }

  // ==========================================
  // Sources
  // ==========================================

  async getSources(workspaceId: string): Promise<LoadedSource[]> {
    return this.fetch(`/workspaces/${workspaceId}/sources`)
  }

  async createSource(workspaceId: string, config: Partial<FolderSourceConfig>): Promise<FolderSourceConfig> {
    return this.fetch(`/workspaces/${workspaceId}/sources`, {
      method: 'POST',
      body: JSON.stringify(config),
    })
  }

  async deleteSource(workspaceId: string, sourceSlug: string): Promise<void> {
    await this.fetch(`/workspaces/${workspaceId}/sources/${sourceSlug}`, {
      method: 'DELETE',
    })
  }

  async startSourceOAuth(workspaceId: string, sourceSlug: string): Promise<OAuthResult> {
    return this.fetch(`/workspaces/${workspaceId}/sources/${sourceSlug}/oauth`, {
      method: 'POST',
    })
  }

  async saveSourceCredentials(workspaceId: string, sourceSlug: string, credential: string): Promise<void> {
    await this.fetch(`/workspaces/${workspaceId}/sources/${sourceSlug}/credentials`, {
      method: 'PUT',
      body: JSON.stringify({ credential }),
    })
  }

  async getMcpTools(workspaceId: string, sourceSlug: string): Promise<McpToolsResult> {
    return this.fetch(`/workspaces/${workspaceId}/sources/${sourceSlug}/tools`)
  }

  async getSourcePermissionsConfig(workspaceId: string, sourceSlug: string): Promise<PermissionsConfigFile | null> {
    try {
      return await this.fetch(`/workspaces/${workspaceId}/sources/${sourceSlug}/permissions`)
    } catch {
      return null
    }
  }

  async getWorkspacePermissionsConfig(workspaceId: string): Promise<PermissionsConfigFile | null> {
    try {
      return await this.fetch(`/workspaces/${workspaceId}/permissions`)
    } catch {
      return null
    }
  }

  // ==========================================
  // Skills
  // ==========================================

  async getSkills(workspaceId: string): Promise<LoadedSkill[]> {
    return this.fetch(`/workspaces/${workspaceId}/skills`)
  }

  async deleteSkill(workspaceId: string, skillSlug: string): Promise<void> {
    await this.fetch(`/workspaces/${workspaceId}/skills/${skillSlug}`, {
      method: 'DELETE',
    })
  }

  // ==========================================
  // Statuses
  // ==========================================

  async listStatuses(workspaceId: string): Promise<StatusConfig[]> {
    return this.fetch(`/workspaces/${workspaceId}/statuses`)
  }

  // ==========================================
  // Auth & Settings
  // ==========================================

  async getAuthState(): Promise<AuthState> {
    return this.fetch('/auth/state')
  }

  async logout(): Promise<void> {
    await this.fetch('/auth/logout', { method: 'POST' })
    this.setAuthToken(null)
  }

  async getBillingMethod(): Promise<BillingMethodInfo> {
    return this.fetch('/settings/billing')
  }

  async updateBillingMethod(
    authType: AuthType,
    credential?: string,
    anthropicBaseUrl?: string | null,
    customModelNames?: { opus?: string; sonnet?: string; haiku?: string } | null
  ): Promise<void> {
    await this.fetch('/settings/billing', {
      method: 'PUT',
      body: JSON.stringify({ authType, credential, anthropicBaseUrl, customModelNames }),
    })
  }

  async testApiConnection(
    apiKey: string,
    baseUrl?: string,
    modelName?: string
  ): Promise<{ success: boolean; error?: string; modelCount?: number }> {
    return this.fetch('/settings/test-api', {
      method: 'POST',
      body: JSON.stringify({ apiKey, baseUrl, modelName }),
    })
  }

  async getModel(): Promise<string | null> {
    const result = await this.fetch<{ model: string | null }>('/settings/model')
    return result.model
  }

  async setModel(model: string): Promise<void> {
    await this.fetch('/settings/model', {
      method: 'PUT',
      body: JSON.stringify({ model }),
    })
  }

  async getSessionModel(sessionId: string, workspaceId: string): Promise<string | null> {
    const result = await this.fetch<{ model: string | null }>(
      `/workspaces/${workspaceId}/sessions/${sessionId}/model`
    )
    return result.model
  }

  async setSessionModel(sessionId: string, workspaceId: string, model: string | null): Promise<void> {
    await this.fetch(`/workspaces/${workspaceId}/sessions/${sessionId}/model`, {
      method: 'PUT',
      body: JSON.stringify({ model }),
    })
  }

  // ==========================================
  // Theme
  // ==========================================

  async getSystemTheme(): Promise<boolean> {
    // Use browser API directly
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  }

  async getAppTheme(): Promise<ThemeOverrides | null> {
    try {
      return await this.fetch('/settings/theme')
    } catch {
      return null
    }
  }

  async loadPresetThemes(): Promise<PresetTheme[]> {
    return this.fetch('/themes/presets')
  }

  async loadPresetTheme(themeId: string): Promise<PresetTheme | null> {
    try {
      return await this.fetch(`/themes/presets/${themeId}`)
    } catch {
      return null
    }
  }

  async getColorTheme(): Promise<string> {
    const result = await this.fetch<{ themeId: string }>('/settings/color-theme')
    return result.themeId
  }

  async setColorTheme(themeId: string): Promise<void> {
    await this.fetch('/settings/color-theme', {
      method: 'PUT',
      body: JSON.stringify({ themeId }),
    })
  }

  // ==========================================
  // User Preferences
  // ==========================================

  async readPreferences(): Promise<{ content: string; exists: boolean; path: string }> {
    return this.fetch('/settings/preferences')
  }

  async writePreferences(content: string): Promise<{ success: boolean; error?: string }> {
    return this.fetch('/settings/preferences', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    })
  }

  // ==========================================
  // Session Drafts
  // ==========================================

  async getDraft(sessionId: string): Promise<string | null> {
    try {
      const result = await this.fetch<{ draft: string | null }>(`/sessions/${sessionId}/draft`)
      return result.draft
    } catch {
      return null
    }
  }

  async setDraft(sessionId: string, text: string): Promise<void> {
    await this.fetch(`/sessions/${sessionId}/draft`, {
      method: 'PUT',
      body: JSON.stringify({ text }),
    })
  }

  async deleteDraft(sessionId: string): Promise<void> {
    await this.fetch(`/sessions/${sessionId}/draft`, {
      method: 'DELETE',
    })
  }

  async getAllDrafts(): Promise<Record<string, string>> {
    return this.fetch('/drafts')
  }

  // ==========================================
  // Event Subscriptions
  // ==========================================

  onSessionEvent(callback: (event: SessionEvent) => void): () => void {
    this.sessionEventHandlers.add(callback)
    // Ensure WebSocket is connected
    this.connectWebSocket()
    return () => {
      this.sessionEventHandlers.delete(callback)
    }
  }

  onSystemThemeChange(callback: (isDark: boolean) => void): () => void {
    this.systemThemeHandlers.add(callback)
    return () => {
      this.systemThemeHandlers.delete(callback)
    }
  }

  onSourcesChanged(callback: (sources: LoadedSource[]) => void): () => void {
    this.sourcesHandlers.add(callback)
    return () => {
      this.sourcesHandlers.delete(callback)
    }
  }

  onSkillsChanged(callback: (skills: LoadedSkill[]) => void): () => void {
    this.skillsHandlers.add(callback)
    return () => {
      this.skillsHandlers.delete(callback)
    }
  }

  onStatusesChanged(callback: (workspaceId: string) => void): () => void {
    this.statusesHandlers.add(callback)
    return () => {
      this.statusesHandlers.delete(callback)
    }
  }

  onAppThemeChange(callback: (theme: ThemeOverrides | null) => void): () => void {
    this.themeHandlers.add(callback)
    return () => {
      this.themeHandlers.delete(callback)
    }
  }
}

/**
 * Web platform capabilities
 */
export const webCapabilities: PlatformCapabilities = {
  hasNativeFileDialog: false, // Use <input type="file"> instead
  hasNativeFileDrop: true, // HTML5 drag-drop works
  hasNativeNotifications: true, // Web Notifications API
  hasNativeClipboard: true, // navigator.clipboard
  hasMultiWindow: false, // Single tab experience
  hasTrafficLights: false,
  canRunLocalMcp: false, // MCP runs on server
  hasDeepLinks: false,
  canShowInFolder: false,
  canOpenFile: false, // Can only download
  hasAutoUpdate: false,
}

/**
 * Create Web platform context
 */
export function createWebPlatform(config: WebPlatformConfig): {
  api: WebPlatformAPI
  capabilities: PlatformCapabilities
} {
  return {
    api: new WebPlatformAPI(config),
    capabilities: webCapabilities,
  }
}
