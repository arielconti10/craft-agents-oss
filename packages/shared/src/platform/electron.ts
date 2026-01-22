/**
 * Electron implementation of PlatformAPI
 *
 * This is a thin wrapper around window.electronAPI that implements
 * the platform-agnostic PlatformAPI interface.
 *
 * The Electron app continues to work exactly as before - this wrapper
 * just provides a consistent interface that can be swapped for web.
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
 * Get the Electron API from the window object
 * Throws if not running in Electron
 */
function getElectronAPI() {
  if (typeof window === 'undefined' || !window.electronAPI) {
    throw new Error('ElectronPlatformAPI can only be used in Electron renderer process')
  }
  return window.electronAPI
}

/**
 * Electron implementation of PlatformAPI
 *
 * Simply delegates all calls to window.electronAPI.
 * This allows the existing Electron app to work unchanged while
 * providing a consistent interface for the shared UI code.
 */
export class ElectronPlatformAPI implements PlatformAPI {
  // ==========================================
  // Session Management
  // ==========================================

  getSessions(): Promise<Session[]> {
    return getElectronAPI().getSessions()
  }

  getSessionMessages(sessionId: string): Promise<Session | null> {
    return getElectronAPI().getSessionMessages(sessionId)
  }

  createSession(workspaceId: string, options?: CreateSessionOptions): Promise<Session> {
    return getElectronAPI().createSession(workspaceId, options)
  }

  deleteSession(sessionId: string): Promise<void> {
    return getElectronAPI().deleteSession(sessionId)
  }

  sendMessage(
    sessionId: string,
    message: string,
    attachments?: FileAttachment[],
    storedAttachments?: StoredAttachment[],
    options?: SendMessageOptions
  ): Promise<void> {
    return getElectronAPI().sendMessage(sessionId, message, attachments, storedAttachments, options)
  }

  cancelProcessing(sessionId: string, silent?: boolean): Promise<void> {
    return getElectronAPI().cancelProcessing(sessionId, silent)
  }

  killShell(sessionId: string, shellId: string): Promise<{ success: boolean; error?: string }> {
    return getElectronAPI().killShell(sessionId, shellId)
  }

  getTaskOutput(taskId: string): Promise<string | null> {
    return getElectronAPI().getTaskOutput(taskId)
  }

  respondToPermission(
    sessionId: string,
    requestId: string,
    allowed: boolean,
    alwaysAllow: boolean
  ): Promise<boolean> {
    return getElectronAPI().respondToPermission(sessionId, requestId, allowed, alwaysAllow)
  }

  respondToCredential(
    sessionId: string,
    requestId: string,
    response: CredentialResponse
  ): Promise<boolean> {
    return getElectronAPI().respondToCredential(sessionId, requestId, response)
  }

  sessionCommand(
    sessionId: string,
    command: SessionCommand
  ): Promise<void | ShareResult | RefreshTitleResult> {
    return getElectronAPI().sessionCommand(sessionId, command)
  }

  // ==========================================
  // Workspace Management
  // ==========================================

  getWorkspaces(): Promise<Workspace[]> {
    return getElectronAPI().getWorkspaces()
  }

  createWorkspace(folderPath: string, name: string): Promise<Workspace> {
    return getElectronAPI().createWorkspace(folderPath, name)
  }

  getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings | null> {
    return getElectronAPI().getWorkspaceSettings(workspaceId)
  }

  updateWorkspaceSetting<K extends keyof WorkspaceSettings>(
    workspaceId: string,
    key: K,
    value: WorkspaceSettings[K]
  ): Promise<void> {
    return getElectronAPI().updateWorkspaceSetting(workspaceId, key, value)
  }

  // ==========================================
  // Sources
  // ==========================================

  getSources(workspaceId: string): Promise<LoadedSource[]> {
    return getElectronAPI().getSources(workspaceId)
  }

  createSource(workspaceId: string, config: Partial<FolderSourceConfig>): Promise<FolderSourceConfig> {
    return getElectronAPI().createSource(workspaceId, config)
  }

  deleteSource(workspaceId: string, sourceSlug: string): Promise<void> {
    return getElectronAPI().deleteSource(workspaceId, sourceSlug)
  }

  startSourceOAuth(workspaceId: string, sourceSlug: string): Promise<OAuthResult> {
    return getElectronAPI().startSourceOAuth(workspaceId, sourceSlug)
  }

  saveSourceCredentials(workspaceId: string, sourceSlug: string, credential: string): Promise<void> {
    return getElectronAPI().saveSourceCredentials(workspaceId, sourceSlug, credential)
  }

  getMcpTools(workspaceId: string, sourceSlug: string): Promise<McpToolsResult> {
    return getElectronAPI().getMcpTools(workspaceId, sourceSlug)
  }

  getSourcePermissionsConfig(workspaceId: string, sourceSlug: string): Promise<PermissionsConfigFile | null> {
    return getElectronAPI().getSourcePermissionsConfig(workspaceId, sourceSlug)
  }

  getWorkspacePermissionsConfig(workspaceId: string): Promise<PermissionsConfigFile | null> {
    return getElectronAPI().getWorkspacePermissionsConfig(workspaceId)
  }

  // ==========================================
  // Skills
  // ==========================================

  getSkills(workspaceId: string): Promise<LoadedSkill[]> {
    return getElectronAPI().getSkills(workspaceId)
  }

  deleteSkill(workspaceId: string, skillSlug: string): Promise<void> {
    return getElectronAPI().deleteSkill(workspaceId, skillSlug)
  }

  // ==========================================
  // Statuses
  // ==========================================

  listStatuses(workspaceId: string): Promise<StatusConfig[]> {
    return getElectronAPI().listStatuses(workspaceId)
  }

  // ==========================================
  // Auth & Settings
  // ==========================================

  getAuthState(): Promise<AuthState> {
    return getElectronAPI().getAuthState()
  }

  logout(): Promise<void> {
    return getElectronAPI().logout()
  }

  getBillingMethod(): Promise<BillingMethodInfo> {
    return getElectronAPI().getBillingMethod()
  }

  updateBillingMethod(
    authType: AuthType,
    credential?: string,
    anthropicBaseUrl?: string | null,
    customModelNames?: { opus?: string; sonnet?: string; haiku?: string } | null
  ): Promise<void> {
    return getElectronAPI().updateBillingMethod(authType, credential, anthropicBaseUrl, customModelNames)
  }

  testApiConnection(
    apiKey: string,
    baseUrl?: string,
    modelName?: string
  ): Promise<{ success: boolean; error?: string; modelCount?: number }> {
    return getElectronAPI().testApiConnection(apiKey, baseUrl, modelName)
  }

  getModel(): Promise<string | null> {
    return getElectronAPI().getModel()
  }

  setModel(model: string): Promise<void> {
    return getElectronAPI().setModel(model)
  }

  getSessionModel(sessionId: string, workspaceId: string): Promise<string | null> {
    return getElectronAPI().getSessionModel(sessionId, workspaceId)
  }

  setSessionModel(sessionId: string, workspaceId: string, model: string | null): Promise<void> {
    return getElectronAPI().setSessionModel(sessionId, workspaceId, model)
  }

  // ==========================================
  // Theme
  // ==========================================

  getSystemTheme(): Promise<boolean> {
    return getElectronAPI().getSystemTheme()
  }

  getAppTheme(): Promise<ThemeOverrides | null> {
    return getElectronAPI().getAppTheme()
  }

  loadPresetThemes(): Promise<PresetTheme[]> {
    return getElectronAPI().loadPresetThemes()
  }

  loadPresetTheme(themeId: string): Promise<PresetTheme | null> {
    return getElectronAPI().loadPresetTheme(themeId)
  }

  getColorTheme(): Promise<string> {
    return getElectronAPI().getColorTheme()
  }

  setColorTheme(themeId: string): Promise<void> {
    return getElectronAPI().setColorTheme(themeId)
  }

  // ==========================================
  // User Preferences
  // ==========================================

  readPreferences(): Promise<{ content: string; exists: boolean; path: string }> {
    return getElectronAPI().readPreferences()
  }

  writePreferences(content: string): Promise<{ success: boolean; error?: string }> {
    return getElectronAPI().writePreferences(content)
  }

  // ==========================================
  // Session Drafts
  // ==========================================

  getDraft(sessionId: string): Promise<string | null> {
    return getElectronAPI().getDraft(sessionId)
  }

  setDraft(sessionId: string, text: string): Promise<void> {
    return getElectronAPI().setDraft(sessionId, text)
  }

  deleteDraft(sessionId: string): Promise<void> {
    return getElectronAPI().deleteDraft(sessionId)
  }

  getAllDrafts(): Promise<Record<string, string>> {
    return getElectronAPI().getAllDrafts()
  }

  // ==========================================
  // Event Subscriptions
  // ==========================================

  onSessionEvent(callback: (event: SessionEvent) => void): () => void {
    return getElectronAPI().onSessionEvent(callback)
  }

  onSystemThemeChange(callback: (isDark: boolean) => void): () => void {
    return getElectronAPI().onSystemThemeChange(callback)
  }

  onSourcesChanged(callback: (sources: LoadedSource[]) => void): () => void {
    return getElectronAPI().onSourcesChanged(callback)
  }

  onSkillsChanged(callback: (skills: LoadedSkill[]) => void): () => void {
    return getElectronAPI().onSkillsChanged(callback)
  }

  onStatusesChanged(callback: (workspaceId: string) => void): () => void {
    return getElectronAPI().onStatusesChanged(callback)
  }

  onAppThemeChange(callback: (theme: ThemeOverrides | null) => void): () => void {
    return getElectronAPI().onAppThemeChange(callback)
  }
}

/**
 * Electron platform capabilities
 */
export const electronCapabilities: PlatformCapabilities = {
  hasNativeFileDialog: true,
  hasNativeFileDrop: true,
  hasNativeNotifications: true,
  hasNativeClipboard: true,
  hasMultiWindow: true,
  hasTrafficLights: typeof process !== 'undefined' && process.platform === 'darwin',
  canRunLocalMcp: true,
  hasDeepLinks: true,
  canShowInFolder: true,
  canOpenFile: true,
  hasAutoUpdate: true,
}

/**
 * Create Electron platform context
 */
export function createElectronPlatform(): { api: PlatformAPI; capabilities: PlatformCapabilities } {
  return {
    api: new ElectronPlatformAPI(),
    capabilities: electronCapabilities,
  }
}
